import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Deps } from "../deps.js";
import { requireOfficer } from "../middleware/auth.js";
import { computeImpact } from "../services/analytics.js";
import { buildBriefingFacts, narrateBriefing } from "../services/briefing.js";
import { getIssuesInScope, regionNameMap } from "../services/consoleData.js";
import { slaFor } from "../services/sla.js";
import { bad, outside, regionInScope } from "./helpers.js";

export const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", hi: "Hindi", ta: "Tamil", pt: "Brazilian Portuguese",
  bn: "Bengali", te: "Telugu", mr: "Marathi", kn: "Kannada", ml: "Malayalam", gu: "Gujarati", pa: "Punjabi",
};

/** RFC 4180 quoting, plus a leading apostrophe on cells a spreadsheet would execute as a formula. */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const toCsv = (rows: unknown[][]) => rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";

export function registerReportRoutes(app: FastifyInstance, deps: Deps) {
  const officerOnly = { preHandler: [requireOfficer(deps.authVerifier)] };

  async function scopedRegion(request: Parameters<typeof regionInScope>[1], requested: string | undefined) {
    const region = requested ?? request.officer!.regionId;
    return (await regionInScope(deps, request, region)) ? region! : null;
  }

  // The Monday-morning briefing: every figure is computed; the model only rephrases them, and any
  // sentence with a number it cannot find in the facts is dropped (services/briefing.ts).
  app.get("/reports/briefing", officerOnly, async (request, reply) => {
    const q = z.object({ region: z.string().optional(), lang: z.string().default("en") }).safeParse(request.query);
    if (!q.success) return reply.code(400).send(bad(q.error.issues[0]?.message));
    const region = await scopedRegion(request, q.data.region);
    if (!region) return reply.code(403).send(outside);

    const facts = await buildBriefingFacts(deps, region);
    const language = q.data.lang.split("-")[0];
    const narrative = language === "en" || LANGUAGE_NAMES[language]
      ? await narrateBriefing(deps, facts, LANGUAGE_NAMES[language] ?? "English", request.log)
      : await narrateBriefing(deps, facts, "English", request.log);
    return reply.code(200).send({ facts, narrative, language: LANGUAGE_NAMES[language] ? language : "en" });
  });

  app.get("/analytics/impact", officerOnly, async (request, reply) => {
    const q = z.object({ region: z.string().optional() }).safeParse(request.query);
    if (!q.success) return reply.code(400).send(bad(q.error.issues[0]?.message));
    const region = await scopedRegion(request, q.data.region);
    if (!region) return reply.code(403).send(outside);

    const [issues, scores, projects, impacts, regions] = await Promise.all([
      getIssuesInScope(deps, region),
      deps.store.listScores(),
      deps.store.listProjects(),
      deps.store.listImpactRecords(),
      regionNameMap(deps),
    ]);
    return reply.code(200).send({
      region,
      region_name: regions.get(region)?.name ?? region,
      ...computeImpact(issues, new Map(scores.map((s) => [s.issue_id, s])), projects, impacts),
    });
  });

  // Officer data export: content and counts, never reporter identity.
  app.get("/export/issues.csv", officerOnly, async (request, reply) => {
    const q = z.object({ region: z.string().optional() }).safeParse(request.query);
    if (!q.success) return reply.code(400).send(bad(q.error.issues[0]?.message));
    const region = await scopedRegion(request, q.data.region);
    if (!region) return reply.code(403).send(outside);

    const [issues, regions, projects] = await Promise.all([getIssuesInScope(deps, region), regionNameMap(deps), deps.store.listProjects()]);
    const projectByIssue = new Map(projects.map((p) => [p.issue_id, p]));
    const rows: unknown[][] = [[
      "issue_id", "category", "subcategory", "description", "status", "priority_score", "reports", "distinct_reporters",
      "district", "state", "first_reported", "last_reported", "sla_state", "assigned_to", "project_status", "budget_inr", "sample_data",
    ]];
    for (const i of issues.sort((a, b) => (b.composite_score ?? -1) - (a.composite_score ?? -1))) {
      const project = projectByIssue.get(i.issue_id);
      rows.push([
        i.issue_id, i.category, i.subcategory, i.canonical_description, i.status, i.composite_score ?? "", i.report_count, i.distinct_reporter_count,
        regions.get(i.admin_region_id ?? "")?.name ?? "", regions.get(i.state_id)?.name ?? i.state_id, i.first_reported_at, i.last_reported_at,
        slaFor(i).state, i.assigned_to_label ?? "", project?.status ?? "", project?.budget_estimate_inr ?? "", i.is_synthetic === true,
      ]);
    }
    return reply
      .code(200)
      .header("content-type", "text/csv; charset=utf-8")
      .header("content-disposition", `attachment; filename="jansetu-issues-${region}.csv"`)
      .send(toCsv(rows));
  });
}
