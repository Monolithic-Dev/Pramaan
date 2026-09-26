import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Issue, Submission } from "@pramaan/shared-types";
import { haversineMeters } from "@pramaan/shared-utils";
import type { Deps } from "../deps.js";
import { normalizeTrackingCode } from "../lib/trackingCode.js";
import { requireAuth } from "../middleware/auth.js";
import { MIN_PUBLIC_COUNT, priorityBand } from "../insights/transparency.js";
import { SCHEMES } from "../data/schemes.js";
import { computeImpact, computeScorecards, GRADE_FORMULA } from "../services/analytics.js";
import { issueLocation, regionNameMap } from "../services/consoleData.js";
import { bad, notFound, publicRateLimit } from "./helpers.js";
import { sendResolutionOutcome } from "./projects.js";
import { toCsv } from "./reports.js";
import { recordResolutionResponse } from "../services/impactLoop.js";

/** Who is answering, as identifiedReporters() counts them: the account for a signed-in reporter
 *  (so keeping the code never buys a second vote), the report itself for an anonymous one. */
const responderOf = (s: Pick<Submission, "citizen_id" | "submission_id">) =>
  s.citizen_id !== "anonymous" ? s.citizen_id : `sub:${s.submission_id}`;

const STAGES = ["received", "understood", "verified", "funded", "fixed"] as const;
const BEYOND_OPEN = new Set(["verified", "prioritized", "funded", "in_progress", "resolved"]);
const FUNDED = new Set(["funded", "in_progress", "resolved"]);

/** ~1.1 km precision. A public map must show where a problem is, never which front door reported it. */
const coarse = (n: number) => Math.round(n * 100) / 100;

/** How far along an issue is, as a stage name. Shared by the citizen's own tracker and the public code lookup. */
export function journeyStage(issue: Pick<Issue, "status"> | null): (typeof STAGES)[number] {
  if (!issue) return "received";
  if (issue.status === "resolved") return "fixed";
  if (FUNDED.has(issue.status)) return "funded";
  if (BEYOND_OPEN.has(issue.status)) return "verified";
  return "understood";
}

export function registerPublicRoutes(app: FastifyInstance, deps: Deps) {
  const publicIssues = async () => (await deps.store.listIssues()).filter((i) => i.status !== "tombstoned");

  // ---- Follow a report without an account ---------------------------------------------------------------

  app.get("/public/track/:code", async (request, reply) => {
    // Tight limit: the code is the only credential, so enumeration must stay impractical.
    if (!(await publicRateLimit(deps, request, reply, "track", 20))) return;
    const code = normalizeTrackingCode((request.params as { code: string }).code);
    const submission = code ? await deps.store.getSubmissionByTrackingCode(code) : null;
    if (!submission || submission.status === "tombstoned") return reply.code(404).send(notFound("Report"));

    const issue = submission.issue_id ? await deps.store.getIssue(submission.issue_id) : null;
    const live = issue && issue.status !== "tombstoned" ? issue : null;
    const project = live ? await deps.store.getProjectByIssue(live.issue_id) : null;
    const impact = project?.marked_complete_at ? await deps.store.getImpactRecord(project.project_id) : null;
    return reply.code(200).send({
      // The code holder is an original reporter: ask them, like a signed-in citizen, whether it was fixed.
      awaiting_confirmation:
        Boolean(project?.marked_complete_at) && project?.status !== "completed" && !(impact?.confirmed_by ?? []).includes(responderOf(submission)),
      reopened_count: impact?.reopened_count ?? 0,
      tracking_code: submission.tracking_code,
      submitted_at: submission.submitted_at,
      channel: submission.channel,
      processing: submission.status,
      stage: journeyStage(live),
      stages: STAGES,
      category: live?.category ?? null,
      issue_status: live?.status ?? null,
      priority: live ? priorityBand(live.composite_score) : "pending",
      other_reporters: live ? Math.max(0, live.distinct_reporter_count - 1) : 0,
      project_stage: project?.status ?? null,
    });
  });

  // "Was it really fixed?" for people who reported without an account. The tracking code is the
  // credential; each report gets one answer per round, whether the reporter answers here or signed in.
  app.post("/public/track/:code/confirm", async (request, reply) => {
    if (!(await publicRateLimit(deps, request, reply, "track", 20))) return;
    const body = z.object({ confirmed: z.boolean() }).safeParse(request.body);
    if (!body.success) return reply.code(400).send(bad(body.error.issues[0]?.message));
    const code = normalizeTrackingCode((request.params as { code: string }).code);
    const submission = code ? await deps.store.getSubmissionByTrackingCode(code) : null;
    if (!submission || submission.status === "tombstoned" || !submission.issue_id) return reply.code(404).send(notFound("Report"));
    const project = await deps.store.getProjectByIssue(submission.issue_id);
    if (!project) return reply.code(409).send({ error: { code: "NOT_MARKED_COMPLETE", message: "This project hasn't been marked complete yet." } });

    return sendResolutionOutcome(reply, await recordResolutionResponse(deps, project, responderOf(submission), body.data.confirmed));
  });

  // ---- Accountability -----------------------------------------------------------------------------------------

  app.get("/public/scorecards", async (request, reply) => {
    if (!(await publicRateLimit(deps, request, reply, "public-scorecards"))) return;
    const q = z.object({ group: z.enum(["district", "state"]).default("district"), country: z.string().length(2).optional() }).safeParse(request.query);
    if (!q.success) return reply.code(400).send(bad(q.error.issues[0]?.message));

    const [issues, impacts, regions] = await Promise.all([publicIssues(), deps.store.listImpactRecords(), regionNameMap(deps)]);
    const scoped = q.data.country ? issues.filter((i) => i.country_code === q.data.country) : issues;
    return reply.code(200).send({
      group: q.data.group,
      min_public_count: MIN_PUBLIC_COUNT,
      formula: GRADE_FORMULA,
      sample_data: scoped.some((i) => i.is_synthetic === true),
      scorecards: computeScorecards(scoped, impacts, regions, q.data.group),
    });
  });

  app.get("/public/impact", async (request, reply) => {
    if (!(await publicRateLimit(deps, request, reply, "public-impact"))) return;
    const [issues, scores, projects, impacts] = await Promise.all([publicIssues(), deps.store.listScores(), deps.store.listProjects(), deps.store.listImpactRecords()]);
    if (issues.length < MIN_PUBLIC_COUNT) return reply.code(200).send({ status: "insufficient_data", min_required: MIN_PUBLIC_COUNT });
    return reply.code(200).send({
      status: "ok",
      sample_data: issues.some((i) => i.is_synthetic === true),
      ...computeImpact(issues, new Map(scores.map((s) => [s.issue_id, s])), projects, impacts),
    });
  });

  app.get("/public/schemes", async (request, reply) => {
    if (!(await publicRateLimit(deps, request, reply, "public-schemes"))) return;
    return reply.code(200).send({ schemes: SCHEMES });
  });

  // Open data: counts by place, category, status and month. Cells under 3 are suppressed so a single
  // household's report can never be picked out of the file.
  app.get("/public/opendata/issues.csv", async (request, reply) => {
    if (!(await publicRateLimit(deps, request, reply, "public-opendata", 20))) return;
    const [issues, regions] = await Promise.all([publicIssues(), regionNameMap(deps)]);
    const cells = new Map<string, { row: string[]; issues: number; reports: number }>();
    for (const i of issues) {
      const row = [
        regions.get(i.state_id)?.name ?? i.state_id,
        regions.get(i.admin_region_id ?? "")?.name ?? "",
        i.category,
        i.status,
        i.first_reported_at.slice(0, 7),
      ];
      const key = row.join("|");
      const cell = cells.get(key) ?? { row, issues: 0, reports: 0 };
      cell.issues += 1;
      cell.reports += i.report_count;
      cells.set(key, cell);
    }
    const rows: unknown[][] = [["state", "district", "category", "status", "month", "issues", "citizen_reports"]];
    for (const c of cells.values()) if (c.issues >= 3) rows.push([...c.row, c.issues, c.reports]);
    return reply
      .code(200)
      .header("content-type", "text/csv; charset=utf-8")
      .header("content-disposition", 'attachment; filename="pramaan-open-data.csv"')
      .send(toCsv(rows));
  });

  // ---- Community map ------------------------------------------------------------------------------------------

  // What is being reported near me? Coarse location and category only: no text, no reporter data.
  app.get("/public/issues", async (request, reply) => {
    if (!(await publicRateLimit(deps, request, reply, "public-issues"))) return;
    const q = z.object({ country: z.string().length(2).optional(), category: z.string().optional() }).safeParse(request.query);
    if (!q.success) return reply.code(400).send(bad(q.error.issues[0]?.message));

    const [all, regions] = await Promise.all([publicIssues(), regionNameMap(deps)]);
    const issues = all
      .filter((i) => i.fraud_flags.length === 0 && i.status !== "disputed")
      .filter((i) => !q.data.country || i.country_code === q.data.country)
      .filter((i) => !q.data.category || i.category === q.data.category)
      .slice(0, 500);
    return reply.code(200).send({
      issues: issues.flatMap((i) => {
        const loc = issueLocation(i);
        if (!loc) return [];
        return [{
          issue_id: i.issue_id,
          category: i.category,
          status: i.status,
          priority: priorityBand(i.composite_score),
          report_count: i.report_count,
          support_count: i.support_count ?? 0,
          region_name: regions.get(i.admin_region_id ?? "")?.name ?? null,
          lat: coarse(loc.lat),
          lng: coarse(loc.lng),
          first_reported_at: i.first_reported_at,
          is_synthetic: i.is_synthetic === true,
        }];
      }),
    });
  });

  // "Is this already reported?" (the FixMyStreet pattern): before filing, a citizen sees open issues
  // right around the spot they picked and can add their voice to one instead of starting a duplicate.
  // Same fields as the community map; the distance is rounded so it never pinpoints a reporter.
  app.get("/public/nearby", async (request, reply) => {
    if (!(await publicRateLimit(deps, request, reply, "public-nearby"))) return;
    const q = z
      .object({ lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180), radius: z.coerce.number().int().min(50).max(2000).default(500) })
      .safeParse(request.query);
    if (!q.success) return reply.code(400).send(bad(q.error.issues[0]?.message));
    const here = { lat: q.data.lat, lng: q.data.lng };
    const nearby = (await publicIssues())
      .filter((i) => i.fraud_flags.length === 0 && !["resolved", "disputed"].includes(i.status))
      .flatMap((i) => {
        const loc = issueLocation(i);
        if (!loc) return [];
        const distance = haversineMeters(here, loc);
        return distance <= q.data.radius ? [{ issue: i, distance }] : [];
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);
    return reply.code(200).send({
      radius_m: q.data.radius,
      issues: nearby.map(({ issue: i, distance }) => ({
        issue_id: i.issue_id,
        category: i.category,
        subcategory: i.subcategory,
        status: i.status,
        report_count: i.report_count,
        support_count: i.support_count ?? 0,
        distance_m: Math.max(50, Math.round(distance / 50) * 50),
        first_reported_at: i.first_reported_at,
      })),
    });
  });

  // "I'm affected too": a citizen endorses an existing issue instead of filing a duplicate. It is shown
  // to officers as community corroboration but never enters demand_score, so it cannot be used to game a ranking.
  app.post("/issues/:issueId/support", { preHandler: [requireAuth(deps.authVerifier)] }, async (request, reply) => {
    if (request.officer) return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Officers cannot endorse issues." } });
    const { issueId } = request.params as { issueId: string };
    const citizenId = request.citizenId!;
    if ((await deps.store.incrementRateLimit(`support:${citizenId}`, 3_600_000)) > 30) {
      return reply.code(429).send({ error: { code: "RATE_LIMITED", message: "Too many endorsements. Try again later." } });
    }
    const issue = await deps.store.getIssue(issueId);
    if (!issue || issue.status === "tombstoned") return reply.code(404).send(notFound("Issue"));

    const added = await deps.store.putSupport(issueId, citizenId);
    let count = issue.support_count ?? 0;
    if (added) {
      count += 1;
      await deps.store.updateIssue(issueId, { support_count: count });
    }
    return reply.code(200).send({ issue_id: issueId, support_count: count, already_supported: !added });
  });
}
