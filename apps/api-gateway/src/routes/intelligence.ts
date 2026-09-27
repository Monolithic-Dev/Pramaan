import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Issue } from "@pramaan/shared-types";
import type { Deps } from "../deps.js";
import { SCHEME_BY_ID } from "../data/schemes.js";
import { MIN_PUBLIC_COUNT } from "../insights/transparency.js";
import { optionalAuth, requireOfficer } from "../middleware/auth.js";
import { getIssuesInScope, regionNameMap, regionsWithin } from "../services/consoleData.js";
import { handleInboundMessage } from "../services/inboundMessage.js";
import { computeNeedVsSpend } from "../services/needVsSpend.js";
import { computeSchemePerformance } from "../services/schemePerformance.js";
import { audit, bad, issueInScope, notFound, outside, publicRateLimit, regionInScope, requireRole } from "./helpers.js";
import { LANGUAGE_NAMES } from "./reports.js";

export function registerIntelligenceRoutes(app: FastifyInstance, deps: Deps) {
  const officerOnly = { preHandler: [requireOfficer(deps.authVerifier)] };

  // ---- Need vs spend: is money going where the need is? -------------------------------------------------

  async function needVsSpend(scopeRegionId: string, countryCode?: string) {
    const [regionList, issues, infra, investments] = await Promise.all([
      deps.bigqueryAgent.listRegions(),
      deps.store.listIssues(),
      deps.bigqueryAgent.listInfraIndex(),
      deps.bigqueryAgent.listInvestments(),
    ]);
    const scoped = regionsWithin(regionList, scopeRegionId).filter((r) => !countryCode || r.countryCode === countryCode);
    return computeNeedVsSpend({
      regions: regionList,
      scopeRegionIds: new Set(scoped.map((r) => r.regionId)),
      issues: issues.filter((i) => i.status !== "tombstoned"),
      infra,
      investments,
    });
  }

  app.get("/analytics/need-vs-spend", officerOnly, async (request, reply) => {
    const q = z.object({ region: z.string().optional() }).safeParse(request.query);
    if (!q.success) return reply.code(400).send(bad(q.error.issues[0]?.message));
    const region = q.data.region ?? request.officer!.regionId;
    if (!(await regionInScope(deps, request, region))) return reply.code(403).send(outside);
    return reply.code(200).send({ region, ...(await needVsSpend(region!)) });
  });

  // Public version: the same map for anyone, with the raw counts of places that have only a handful of
  // reports withheld (the need index still reflects them, the numbers are not printed).
  app.get("/public/need-vs-spend", async (request, reply) => {
    if (!(await publicRateLimit(deps, request, reply, "public-need-vs-spend"))) return;
    const q = z.object({ country: z.string().length(2).default("IN") }).safeParse(request.query);
    if (!q.success) return reply.code(400).send(bad(q.error.issues[0]?.message));
    const result = await needVsSpend(q.data.country, q.data.country);
    return reply.code(200).send({
      ...result,
      min_public_count: MIN_PUBLIC_COUNT,
      districts: result.districts.map((d) =>
        d.open_issues >= MIN_PUBLIC_COUNT ? d : { ...d, open_issues: null, waiting_reporters: null, demand_per_100k: null, top_unmet_categories: [] },
      ),
    });
  });

  // ---- Scheme impact ledger -----------------------------------------------------------------------------------

  async function schemePerformance(issueFilter: (i: Issue) => boolean) {
    const [projects, issues, impacts, scores, regions] = await Promise.all([
      deps.store.listProjects(),
      deps.store.listIssues(),
      deps.store.listImpactRecords(),
      deps.store.listScores(),
      regionNameMap(deps),
    ]);
    const kept = issues.filter((i) => i.status !== "tombstoned" && issueFilter(i));
    const issueById = new Map(kept.map((i) => [i.issue_id, i]));
    return computeSchemePerformance(
      projects.filter((p) => issueById.has(p.issue_id)),
      issueById,
      new Map(impacts.map((r) => [r.project_id, r])),
      new Map(scores.map((s) => [s.issue_id, s])),
      regions,
    );
  }

  app.get("/schemes/performance", officerOnly, async (request, reply) => {
    const q = z.object({ region: z.string().optional() }).safeParse(request.query);
    if (!q.success) return reply.code(400).send(bad(q.error.issues[0]?.message));
    const region = q.data.region ?? request.officer!.regionId;
    if (!(await regionInScope(deps, request, region))) return reply.code(403).send(outside);
    const inScope = new Set((await getIssuesInScope(deps, region!)).map((i) => i.issue_id));
    const result = await schemePerformance((i) => inScope.has(i.issue_id));
    return reply.code(200).send({ region, sample_data: (await getIssuesInScope(deps, region!)).some((i) => i.is_synthetic === true), ...result });
  });

  app.get("/public/schemes/performance", async (request, reply) => {
    if (!(await publicRateLimit(deps, request, reply, "public-scheme-performance"))) return;
    const q = z.object({ country: z.string().length(2).optional() }).safeParse(request.query);
    if (!q.success) return reply.code(400).send(bad(q.error.issues[0]?.message));
    const result = await schemePerformance((i) => !q.data.country || i.country_code === q.data.country);
    return reply.code(200).send(result);
  });

  // An officer records which programme is actually paying for a project (the automatic match is a guess).
  app.post("/projects/:projectId/scheme", officerOnly, async (request, reply) => {
    if (!requireRole(request, reply, "district_collector", "Setting a project's funding scheme")) return;
    const body = z.object({ scheme_id: z.string().refine((id) => SCHEME_BY_ID.has(id), "Unknown scheme.") }).safeParse(request.body);
    if (!body.success) return reply.code(400).send(bad(body.error.issues[0]?.message));
    const { projectId } = request.params as { projectId: string };
    const project = await deps.store.getProject(projectId);
    if (!project) return reply.code(404).send(notFound("Project"));
    const issue = await deps.store.getIssue(project.issue_id);
    if (!issue || !(await issueInScope(deps, request, reply, issue))) return;
    const updated = await deps.store.updateProject(projectId, { scheme_id: body.data.scheme_id });
    await audit(deps, request, "project_scheme_set", projectId, { scheme_id: project.scheme_id ?? null }, { scheme_id: body.data.scheme_id }, null);
    return reply.code(200).send(updated);
  });

  // ---- AI photo assistant ---------------------------------------------------------------------------------------

  app.post("/assist/photo", { preHandler: [optionalAuth(deps.authVerifier)] }, async (request, reply) => {
    if (!(await publicRateLimit(deps, request, reply, "assist-photo", 10))) return;
    const body = z.object({ photo_url: z.string().min(1), language: z.string().default("en") }).safeParse(request.body);
    if (!body.success) return reply.code(400).send(bad(body.error.issues[0]?.message));
    // Only photos this app stored itself: the assistant must never be pointed at arbitrary objects.
    if (!deps.mediaStore.owns(body.data.photo_url)) return reply.code(400).send(bad("photo_url must be a URL returned by POST /media."));
    const media = await deps.mediaStore.get(body.data.photo_url);
    if (!media || !media.contentType.startsWith("image/")) return reply.code(404).send(notFound("Photo"));

    const lang = body.data.language.split("-")[0];
    try {
      const suggestion = await deps.assistant.describePhoto({ data: media.data, mimeType: media.contentType }, LANGUAGE_NAMES[lang] ?? "English");
      if (!suggestion) return reply.code(502).send({ error: { code: "ASSIST_UNAVAILABLE", message: "The assistant could not read this photo. Please describe it yourself." } });
      return reply.code(200).send({ ...suggestion, language: LANGUAGE_NAMES[lang] ? lang : "en" });
    } catch (err) {
      request.log.warn({ err }, "photo assist failed");
      return reply.code(502).send({ error: { code: "ASSIST_UNAVAILABLE", message: "The assistant could not read this photo. Please describe it yourself." } });
    }
  });

  // ---- Live SMS / WhatsApp simulator ------------------------------------------------------------------------------

  // Lets anyone try the feature-phone channel from the website, going through exactly the same handler as
  // the real webhooks. Off unless DEMO_CHANNEL_SIMULATOR=true, and tightly rate-limited when on.
  app.post("/public/demo/message", async (request, reply) => {
    if (process.env.DEMO_CHANNEL_SIMULATOR !== "true") return reply.code(404).send(notFound("Route"));
    if (!(await publicRateLimit(deps, request, reply, "demo-message", 10))) return;
    const body = z
      .object({
        channel: z.enum(["sms", "whatsapp"]),
        text: z.string().trim().min(3).max(600),
        location_text: z.string().trim().min(2).max(120).optional(),
        country_code: z.string().length(2).optional(),
      })
      .safeParse(request.body);
    if (!body.success) return reply.code(400).send(bad(body.error.issues[0]?.message));
    const outcome = await handleInboundMessage(
      deps,
      {
        channel: body.data.channel,
        text: body.data.text,
        location_text: body.data.location_text,
        citizenId: undefined,
        idempotencyKey: `demo_${randomUUID()}`,
        consentVersion: `dpdp-notice-v1-${body.data.channel}`,
        countryCode: body.data.country_code,
      },
      request.log,
    );
    if (outcome.kind === "conflict") return reply.code(409).send({ error: { code: "IDEMPOTENCY_CONFLICT", message: "Duplicate message." } });
    if (outcome.kind === "report") return reply.code(202).send({ kind: "report", tracking_code: outcome.result.tracking_code, reply: outcome.reply });
    return reply.code(200).send(outcome);
  });
}
