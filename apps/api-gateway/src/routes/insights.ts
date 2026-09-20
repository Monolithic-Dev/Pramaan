import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getCountryProfile } from "@jansetu/shared-types";
import { geohashDecodeCenter } from "@jansetu/shared-utils";
import type { Deps } from "../deps.js";
import { isWithinScope } from "../agent/scopeGuard.js";
import { getEquityAudit, getForecasts } from "../insights/service.js";
import { computeTransparency, priorityBand } from "../insights/transparency.js";
import { requireAuth, requireOfficer } from "../middleware/auth.js";

const PUBLIC_RATE_LIMIT_PER_MINUTE = 60;

const addStateSchema = z.object({
  state_id: z.string().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/, "state_id may only contain letters, digits, - and _"),
  name: z.string().min(1).max(100),
  country_code: z.string().length(2).optional(),
});

const bad = (message: string | undefined) => ({ error: { code: "VALIDATION_ERROR", message } });

export function registerInsightRoutes(app: FastifyInstance, deps: Deps) {
  // Feature 1 — docs/01-predictive-early-warning.md
  app.get("/forecasts", { preHandler: [requireOfficer(deps.authVerifier)] }, async (request, reply) => {
    const q = z.object({ region: z.string().min(1), category: z.string().optional() }).safeParse(request.query);
    if (!q.success) return reply.code(400).send(bad(q.error.issues[0]?.message));

    const officer = request.officer!;
    if (!officer.regionId || !(await isWithinScope(deps.bigqueryAgent, q.data.region, officer.regionId))) {
      return reply.code(403).send({
        error: { code: "JURISDICTION_MISMATCH", message: `${q.data.region} is outside your jurisdiction.` },
      });
    }
    return reply.code(200).send(await getForecasts(deps, q.data.region, q.data.category));
  });

  // Officer map: real issues (solid) and forecasts (dashed) as separate layers.
  // A forecast has no coordinates of its own, so it is placed at the centroid of
  // the historical issues it was derived from.
  app.get("/map/markers", { preHandler: [requireOfficer(deps.authVerifier)] }, async (request, reply) => {
    const q = z.object({ region: z.string().min(1) }).safeParse(request.query);
    if (!q.success) return reply.code(400).send(bad(q.error.issues[0]?.message));
    const officer = request.officer!;
    if (!officer.regionId || !(await isWithinScope(deps.bigqueryAgent, q.data.region, officer.regionId))) {
      return reply.code(403).send({
        error: { code: "JURISDICTION_MISMATCH", message: `${q.data.region} is outside your jurisdiction.` },
      });
    }
    const issues = (await deps.store.getIssuesByRegion(q.data.region)).filter(
      (i) => i.status !== "tombstoned" && i.geohash,
    );
    const centre = (i: (typeof issues)[number]) => geohashDecodeCenter(i.geohash as string);
    const forecastResult = await getForecasts(deps, q.data.region, undefined);
    return reply.code(200).send({
      issues: issues.map((i) => ({
        issue_id: i.issue_id,
        category: i.category,
        status: i.status,
        report_count: i.report_count,
        composite_score: i.composite_score,
        ...centre(i),
      })),
      forecasts: forecastResult.forecasts.flatMap((f) => {
        const pts = issues.filter((i) => i.category === f.category).map(centre);
        if (pts.length === 0) return [];
        return [{
          forecast_id: f.forecast_id,
          category: f.category,
          risk_level: f.risk_level,
          window_start: f.predicted_window_start,
          window_end: f.predicted_window_end,
          lat: pts.reduce((a, p) => a + p.lat, 0) / pts.length,
          lng: pts.reduce((a, p) => a + p.lng, 0) / pts.length,
        }];
      }),
    });
  });

  // Feature 2 — docs/02-equity-fairness-audit.md
  app.get("/equity-audit", { preHandler: [requireOfficer(deps.authVerifier)] }, async (request, reply) => {
    const q = z.object({ state: z.string().min(1) }).safeParse(request.query);
    if (!q.success) return reply.code(400).send(bad(q.error.issues[0]?.message));

    const officer = request.officer!;
    if (officer.role !== "state_admin") {
      return reply.code(403).send({
        error: { code: "FORBIDDEN", message: "The equity audit is restricted to state administrators." },
      });
    }
    if (!officer.regionId || !(await isWithinScope(deps.bigqueryAgent, q.data.state, officer.regionId))) {
      return reply.code(403).send({
        error: { code: "JURISDICTION_MISMATCH", message: `${q.data.state} is outside your jurisdiction.` },
      });
    }
    return reply.code(200).send(await getEquityAudit(deps, q.data.state));
  });

  // Feature 3 — docs/03-citizen-explainability-portal.md. Aggregate counts and
  // the same public brief text an officer sees; never other reporters' data.
  app.get(
    "/my-reports/:submissionId/status",
    { preHandler: [requireAuth(deps.authVerifier)] },
    async (request, reply) => {
      const { submissionId } = request.params as { submissionId: string };
      const submission = await deps.store.getSubmission(submissionId);
      if (!submission || submission.citizen_id !== request.citizenId) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Report not found." } });
      }
      const citizen = await deps.store.getCitizen(submission.citizen_id);
      const issue = submission.issue_id ? await deps.store.getIssue(submission.issue_id) : null;
      if (!issue || issue.status === "tombstoned") {
        return reply.code(200).send({
          submission_status: submission.status,
          issue_status: null,
          other_reporters: 0,
          priority: "pending",
          explanation: null,
          preferred_language: citizen?.preferred_language ?? null,
        });
      }
      const project = await deps.store.getProjectByIssue(issue.issue_id);
      let explanation = project?.generated_brief ?? null;
      const language = (citizen?.preferred_language ?? "en").split("-")[0];
      let explanationLanguage = "en";
      if (explanation && language !== "en") {
        try {
          explanation = await deps.translator.translate(explanation, language);
          explanationLanguage = language;
        } catch (err) {
          // Translation is a nicety: fall back to the original text, never fail the page.
          request.log.warn({ err }, "brief translation failed");
        }
      }
      return reply.code(200).send({
        submission_status: submission.status,
        issue_status: issue.status,
        other_reporters: Math.max(0, issue.distinct_reporter_count - 1),
        priority: priorityBand(issue.composite_score),
        // Existing grounded brief, reused verbatim: no new AI call, no new hallucination surface.
        explanation,
        explanation_language: explanationLanguage,
        preferred_language: citizen?.preferred_language ?? null,
      });
    },
  );

  // Feature 6 — docs/06-public-transparency-ledger.md. Deliberately unauthenticated.
  app.get("/public/transparency", async (request, reply) => {
    const count = await deps.store.incrementRateLimit(`public-transparency:${request.ip}`, 60_000);
    if (count > PUBLIC_RATE_LIMIT_PER_MINUTE) {
      return reply.code(429).send({ error: { code: "RATE_LIMITED", message: "Too many requests." } });
    }
    const q = z.object({ state: z.string().min(1) }).safeParse(request.query);
    if (!q.success) return reply.code(400).send(bad(q.error.issues[0]?.message));

    const issues = await deps.store.listIssues(q.data.state);
    const impacts = (
      await Promise.all(issues.map((i) => deps.store.getImpactRecordByIssue(i.issue_id)))
    ).filter((r) => r !== null);
    return reply.code(200).send(computeTransparency(q.data.state, issues, impacts));
  });

  // Feature 5 — docs/05-instant-state-onboarding-demo.md
  app.get("/states", { preHandler: [requireOfficer(deps.authVerifier)] }, async (_request, reply) => {
    return reply.code(200).send({ states: await deps.store.listStates() });
  });

  app.post("/admin/states", { preHandler: [requireOfficer(deps.authVerifier)] }, async (request, reply) => {
    if (request.officer!.role !== "state_admin") {
      return reply.code(403).send({
        error: { code: "FORBIDDEN", message: "Only state administrators can add states." },
      });
    }
    const parsed = addStateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send(bad(parsed.error.issues[0]?.message));

    const existing = (await deps.store.listStates()).find((s) => s.state_id === parsed.data.state_id);
    if (existing) {
      return reply.code(409).send({ error: { code: "ALREADY_EXISTS", message: "State already exists." } });
    }
    const state = {
      state_id: parsed.data.state_id,
      name: parsed.data.name,
      country_code: getCountryProfile(parsed.data.country_code ?? request.officer!.countryCode).country_code,
      created_at: new Date().toISOString(),
      created_by: request.citizenId ?? "unknown-officer",
    };
    await deps.store.putState(state);
    return reply.code(201).send(state);
  });
}
