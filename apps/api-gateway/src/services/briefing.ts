import type { Issue } from "@jansetu/shared-types";
import type { Deps } from "../deps.js";
import { stripUngroundedSentences } from "../agent/groundedness.js";
import { getForecasts } from "../insights/service.js";
import { computeOverview, getIssuesInScope, regionNameMap } from "./consoleData.js";
import { computeAlignment } from "./schemes.js";
import { slaFor } from "./sla.js";

const DAY = 86_400_000;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Indian digit grouping: 4,50,000 is "₹4.5 lakh", 1,20,00,000 is "₹1.2 crore". */
export function inr(amount: number): string {
  const trim = (n: number) => String(Number(n.toFixed(2)));
  if (amount >= 10_000_000) return `₹${trim(amount / 10_000_000)} crore`;
  if (amount >= 100_000) return `₹${trim(amount / 100_000)} lakh`;
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export interface BriefingFacts {
  region: { id: string; name: string };
  generated_at: string;
  totals: ReturnType<typeof computeOverview>["totals"];
  last_7_days: { new_issues: number; actions_taken: number };
  top_priorities: { issue_id: string; category: string; region_name: string | null; score: number | null; reports: number; status: string; has_project: boolean }[];
  overdue: { count: number; oldest_days: number | null };
  forecasts: { region_name: string; category: string; risk_level: string; month: string }[];
  funding: { needed: string; central_drawable: string; central_share_pct: number };
  recommended_actions: string[];
}

/** Every number in the briefing is computed here, deterministically. The model only rephrases. */
export async function buildBriefingFacts(deps: Deps, regionId: string, now = new Date()): Promise<BriefingFacts> {
  const [issues, regions, log, projects] = await Promise.all([
    getIssuesInScope(deps, regionId),
    regionNameMap(deps),
    deps.store.listAuditLog(500),
    deps.store.listProjects(),
  ]);
  const overview = computeOverview(issues, regions, now);
  const withProject = new Set(projects.map((p) => p.issue_id));
  const inScopeIds = new Set(issues.map((i) => i.issue_id));
  const weekAgo = new Date(now.getTime() - 7 * DAY).toISOString();
  const nameOf = (i: Issue) => (i.admin_region_id ? regions.get(i.admin_region_id)?.name ?? null : null);

  const open = issues.filter((i) => i.status === "open");
  const overdue = open.filter((i) => slaFor(i, now).state === "overdue");
  const oldest = overdue.length ? Math.max(...overdue.map((i) => Math.floor((now.getTime() - Date.parse(slaFor(i, now).due_at)) / DAY))) : null;

  const top = issues
    .filter((i) => i.status !== "resolved" && i.composite_score !== null)
    .sort((a, b) => (b.composite_score ?? 0) - (a.composite_score ?? 0))
    .slice(0, 5);

  const leafRegions = [...new Set(issues.map((i) => i.admin_region_id).filter((id): id is string => Boolean(id)))].slice(0, 12);
  const forecastRows: BriefingFacts["forecasts"] = [];
  for (const id of leafRegions) {
    for (const f of (await getForecasts(deps, id, undefined, now)).forecasts) {
      forecastRows.push({
        region_name: regions.get(id)?.name ?? id,
        category: f.category,
        risk_level: f.risk_level,
        month: MONTHS[new Date(f.predicted_window_start).getUTCMonth()],
      });
    }
  }

  const alignment = computeAlignment(issues, regions);
  const bestScheme = alignment.by_scheme.find((s) => s.centre_inr > 0);

  const actions: string[] = [];
  if (overdue.length > 0) actions.push(`Clear ${overdue.length} overdue issues; the oldest has waited ${oldest} days past its deadline.`);
  const emergencies = issues.filter((i) => i.emergency_override && i.status === "open");
  if (emergencies.length > 0) actions.push(`Review ${emergencies.length} emergency-flagged issues that are still open.`);
  const unfunded = top.filter((i) => !withProject.has(i.issue_id)).slice(0, 3);
  if (unfunded.length > 0) actions.push(`Recommend projects for the ${unfunded.length} highest-scoring issues that have none yet.`);
  if (forecastRows.length > 0) actions.push(`Pre-position resources for ${forecastRows[0].category.replace("_", " ")} in ${forecastRows[0].region_name} before ${forecastRows[0].month}.`);
  if (bestScheme) actions.push(`Route ${bestScheme.issues} open issues through ${bestScheme.short} to draw ${inr(bestScheme.centre_inr)} of central funding.`);

  return {
    region: { id: regionId, name: regions.get(regionId)?.name ?? regionId },
    generated_at: now.toISOString(),
    totals: overview.totals,
    last_7_days: {
      new_issues: issues.filter((i) => i.first_reported_at >= weekAgo).length,
      actions_taken: log.filter((a) => a.timestamp >= weekAgo && a.target_id && inScopeIds.has(a.target_id)).length,
    },
    top_priorities: top.map((i) => ({
      issue_id: i.issue_id,
      category: i.category,
      region_name: nameOf(i),
      score: i.composite_score,
      reports: i.report_count,
      status: i.status,
      has_project: withProject.has(i.issue_id),
    })),
    overdue: { count: overdue.length, oldest_days: oldest },
    forecasts: forecastRows.slice(0, 5),
    funding: { needed: inr(alignment.total_cost_inr), central_drawable: inr(alignment.centre_inr), central_share_pct: Math.round(alignment.centre_share * 100) },
    recommended_actions: actions,
  };
}

/** Plain deterministic summary: the fallback when the model is unavailable, and the guarantee that
 *  a briefing never fails just because an AI call did. */
export function templateNarrative(f: BriefingFacts): string {
  const t = f.totals;
  return [
    `${f.region.name} has ${t.issues} distinct issues from ${t.reports} citizen reports; ${t.resolved} are resolved (${t.resolution_rate}%). ${f.last_7_days.new_issues} new issues arrived in the last 7 days and officers took ${f.last_7_days.actions_taken} actions.`,
    f.overdue.count > 0
      ? `${f.overdue.count} issues are past their response deadline, the oldest by ${f.overdue.oldest_days} days, and ${t.high_priority} issues score as high priority.`
      : `No issues are past their response deadline, and ${t.high_priority} issues score as high priority.`,
    f.recommended_actions[0] ? `Start with this: ${f.recommended_actions[0]}` : "No urgent action is required this week.",
  ].join("\n\n");
}

export async function narrateBriefing(deps: Deps, facts: BriefingFacts, languageName: string, log?: { warn: (o: object, m: string) => void }) {
  try {
    const text = await deps.narrator.narrate(facts, languageName);
    // Same numeric guardrail the copilot uses: a sentence whose figures are not in the facts is dropped.
    // Paragraph by paragraph, so the briefing keeps its shape after unverifiable sentences are dropped.
    const grounded = text
      .split(/\n{2,}/)
      .map((p) => stripUngroundedSentences(p, [facts]).trim())
      .filter(Boolean)
      .join("\n\n");
    if (grounded.trim().length >= 20) return { text: grounded, source: "gemini" as const };
  } catch (err) {
    log?.warn({ err }, "briefing narration failed; using the template");
  }
  return { text: templateNarrative(facts), source: "template" as const };
}
