import type { ImpactRecord, Issue, PriorityScore, Project } from "@pramaan/shared-types";
import type { RegionInfo } from "../lib/bigquery.js";
import { MIN_PUBLIC_COUNT } from "../insights/transparency.js";
import { slaFor } from "./sla.js";

const DAY = 86_400_000;
const FUNDED_PROJECT = new Set(["funded", "in_progress", "completed"]);
const round1 = (n: number) => Number(n.toFixed(1));
const avg = (xs: number[]) => (xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

/** Days from first report to confirmed resolution, for issues that really finished the loop. */
function resolutionDays(issues: Issue[], impacts: Map<string, ImpactRecord>): Map<string, number> {
  const days = new Map<string, number>();
  for (const i of issues) {
    const impact = impacts.get(i.issue_id);
    if (i.status !== "resolved" || !impact?.resolved_at) continue;
    const d = (Date.parse(impact.resolved_at) - Date.parse(i.first_reported_at)) / DAY;
    if (Number.isFinite(d) && d >= 0) days.set(i.issue_id, d);
  }
  return days;
}

/** The impact ledger: what has actually changed for people, not just what was reported. */
export function computeImpact(issues: Issue[], scores: Map<string, PriorityScore>, projects: Project[], impacts: ImpactRecord[], now = new Date()) {
  const impactByIssue = new Map(impacts.map((r) => [r.issue_id, r]));
  const days = resolutionDays(issues, impactByIssue);
  const resolved = issues.filter((i) => i.status === "resolved");
  const inScope = new Set(issues.map((i) => i.issue_id));
  const scopedProjects = projects.filter((p) => inScope.has(p.issue_id));

  const peopleBenefited = resolved.reduce((n, i) => n + (scores.get(i.issue_id)?.estimated_impact_population ?? 0), 0);
  const completedSpend = scopedProjects.filter((p) => p.status === "completed").reduce((n, p) => n + p.budget_estimate_inr, 0);
  const committed = scopedProjects.filter((p) => FUNDED_PROJECT.has(p.status)).reduce((n, p) => n + p.budget_estimate_inr, 0);

  const scopedImpacts = impacts.filter((r) => inScope.has(r.issue_id));
  const positive = scopedImpacts.reduce((n, r) => n + r.confirmations_received, 0);
  const negative = scopedImpacts.reduce((n, r) => n + r.confirmations_negative, 0);

  const byCategory = new Map<string, { category: string; resolved: number; days: number[]; efficacy: number[] }>();
  for (const i of resolved) {
    const row = byCategory.get(i.category) ?? { category: i.category, resolved: 0, days: [], efficacy: [] };
    row.resolved += 1;
    if (days.has(i.issue_id)) row.days.push(days.get(i.issue_id)!);
    const eff = impactByIssue.get(i.issue_id)?.efficacy;
    if (typeof eff === "number") row.efficacy.push(eff);
    byCategory.set(i.category, row);
  }

  const monthly = new Map<string, number>();
  for (let m = 11; m >= 0; m--) monthly.set(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - m, 1)).toISOString().slice(0, 7), 0);
  for (const i of resolved) {
    const month = impactByIssue.get(i.issue_id)?.resolved_at?.slice(0, 7);
    if (month && monthly.has(month)) monthly.set(month, (monthly.get(month) ?? 0) + 1);
  }

  return {
    issues: issues.length,
    resolved: resolved.length,
    resolution_rate: issues.length ? Math.round((resolved.length / issues.length) * 100) : 0,
    avg_days_to_resolve: avg([...days.values()]),
    people_benefited: peopleBenefited,
    funds_committed_inr: committed,
    funds_completed_inr: completedSpend,
    cost_per_beneficiary_inr: peopleBenefited > 0 && completedSpend > 0 ? Math.round(completedSpend / peopleBenefited) : null,
    citizen_confirmations: positive,
    confirmation_rate: positive + negative > 0 ? Math.round((positive / (positive + negative)) * 100) : null,
    by_category: [...byCategory.values()]
      .map((r) => ({ category: r.category, resolved: r.resolved, avg_days: avg(r.days), efficacy: avg(r.efficacy.map((e) => e * 100)) }))
      .sort((a, b) => b.resolved - a.resolved),
    monthly_resolved: [...monthly].map(([month, count]) => ({ month, count })),
  };
}

export type Grade = "A" | "B" | "C" | "D" | "E";

/** Documented on the public page so a district can see exactly why it got its grade. */
export const GRADE_FORMULA = { resolution: 0.5, responsiveness: 0.3, speed: 0.2, speed_days_zero_score: 120 } as const;

export function gradeFor(resolutionRate: number, overdueShare: number, avgDays: number | null): { grade: Grade; points: number } {
  const speed = avgDays === null ? 0.5 : Math.min(1, Math.max(0, 1 - avgDays / GRADE_FORMULA.speed_days_zero_score));
  const points = GRADE_FORMULA.resolution * resolutionRate + GRADE_FORMULA.responsiveness * (1 - overdueShare) + GRADE_FORMULA.speed * speed;
  const grade: Grade = points >= 0.8 ? "A" : points >= 0.65 ? "B" : points >= 0.5 ? "C" : points >= 0.35 ? "D" : "E";
  return { grade, points: Number(points.toFixed(3)) };
}

export type Scorecard =
  | { region_id: string; name: string; status: "insufficient_data"; min_required: number }
  | {
      region_id: string;
      name: string;
      state_id: string;
      status: "ok";
      issues: number;
      resolved: number;
      resolution_rate: number;
      avg_days_to_resolve: number | null;
      open_backlog: number;
      overdue_share: number;
      grade: Grade;
      points: number;
    };

/** Public accountability: one card per region, grouped by district (or by state). Aggregate only,
 *  and withheld below the k-anonymity floor so a region with a handful of reports is never singled out. */
export function computeScorecards(
  issues: Issue[],
  impacts: ImpactRecord[],
  regions: Map<string, RegionInfo>,
  groupBy: "district" | "state",
  now = new Date(),
): Scorecard[] {
  const impactByIssue = new Map(impacts.map((r) => [r.issue_id, r]));
  const days = resolutionDays(issues, impactByIssue);
  const groups = new Map<string, Issue[]>();
  for (const i of issues) {
    const key = groupBy === "state" ? i.state_id : i.admin_region_id;
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), i]);
  }

  return [...groups]
    .map(([id, group]): Scorecard => {
      const name = regions.get(id)?.name ?? id;
      if (group.length < MIN_PUBLIC_COUNT) return { region_id: id, name, status: "insufficient_data", min_required: MIN_PUBLIC_COUNT };
      const resolved = group.filter((i) => i.status === "resolved");
      const open = group.filter((i) => i.status === "open");
      const overdue = open.filter((i) => slaFor(i, now).state === "overdue").length;
      const rate = resolved.length / group.length;
      const overdueShare = open.length ? overdue / open.length : 0;
      const avgDays = avg(group.flatMap((i) => (days.has(i.issue_id) ? [days.get(i.issue_id)!] : [])));
      const { grade, points } = gradeFor(rate, overdueShare, avgDays);
      return {
        region_id: id,
        name,
        state_id: group[0].state_id,
        status: "ok",
        issues: group.length,
        resolved: resolved.length,
        resolution_rate: Math.round(rate * 100),
        avg_days_to_resolve: avgDays,
        open_backlog: open.length,
        overdue_share: Math.round(overdueShare * 100),
        grade,
        points,
      };
    })
    .sort((a, b) => (a.status === "ok" ? b.status === "ok" ? b.points - a.points : -1 : b.status === "ok" ? 1 : 0));
}
