import type { ImpactRecord, Issue, PriorityScore, Project } from "@pramaan/shared-types";
import { SCHEME_BY_ID } from "../data/schemes.js";
import type { RegionInfo } from "../lib/bigquery.js";
import { inferSettlement, matchSchemes } from "./schemes.js";

// The problem statement's third failure: "no way to measure the impact of large-scale ... initiatives".
// Every project is attributed to the national scheme funding it, so each programme gets a delivery
// record built from the ground up: money committed, fixes delivered, speed, people reached, and, the
// part no dashboard has today, whether the citizens who asked for the fix say it actually worked.

const COMMITTED = new Set(["funded", "in_progress", "completed"]);
const DAY = 86_400_000;

/** The scheme a project is attributed to: the one recorded on it, else the best match for its issue. */
export function schemeOf(project: Project, issue: Issue | undefined, regions: Map<string, RegionInfo>): string | null {
  if (project.scheme_id && SCHEME_BY_ID.has(project.scheme_id)) return project.scheme_id;
  if (!issue) return null;
  const region = issue.admin_region_id ? regions.get(issue.admin_region_id) : undefined;
  return matchSchemes(issue, inferSettlement(region).settlement, project.budget_estimate_inr)[0]?.scheme.id ?? null;
}

export interface SchemePerformanceRow {
  scheme_id: string;
  short: string;
  name: string;
  ministry: string;
  priority: string;
  centre_share: number;
  projects: number;
  pipeline: { recommended: number; funded: number; in_progress: number; completed: number };
  committed_inr: number;
  central_inr: number;
  completed: number;
  /** Completed out of everything that received money. */
  delivery_rate: number | null;
  avg_days_to_fix: number | null;
  people_benefited: number;
  cost_per_person_inr: number | null;
  /** Share of citizens' answers saying the fix worked (0-100). */
  citizen_confirmation: number | null;
  /** Projects that citizens sent back as "not fixed" at least once. */
  reopened: number;
  categories: string[];
  /** Plain reading for a policymaker: where this programme stands. */
  signal: "delivering" | "slow" | "quality_concerns" | "early";
}

export function computeSchemePerformance(
  projects: Project[],
  issues: Map<string, Issue>,
  impacts: Map<string, ImpactRecord>,
  scores: Map<string, PriorityScore>,
  regions: Map<string, RegionInfo>,
) {
  const byScheme = new Map<string, { projects: Project[] }>();
  for (const p of projects) {
    const id = schemeOf(p, issues.get(p.issue_id), regions);
    if (!id) continue;
    byScheme.set(id, { projects: [...(byScheme.get(id)?.projects ?? []), p] });
  }

  const rows: SchemePerformanceRow[] = [];
  for (const [id, { projects: ps }] of byScheme) {
    const scheme = SCHEME_BY_ID.get(id)!;
    const pipeline = { recommended: 0, funded: 0, in_progress: 0, completed: 0 };
    for (const p of ps) pipeline[p.status] += 1;
    const committed = ps.filter((p) => COMMITTED.has(p.status));
    const committedInr = committed.reduce((n, p) => n + p.budget_estimate_inr, 0);
    const done = ps.filter((p) => p.status === "completed");

    const days: number[] = [];
    let people = 0;
    let yes = 0;
    let no = 0;
    let reopened = 0;
    for (const p of ps) {
      const impact = impacts.get(p.project_id);
      const issue = issues.get(p.issue_id);
      if (impact) {
        yes += impact.confirmations_received;
        no += impact.confirmations_negative;
        if ((impact.reopened_count ?? 0) > 0) reopened += 1;
      }
      if (p.status === "completed" && issue) {
        people += scores.get(issue.issue_id)?.estimated_impact_population ?? 0;
        if (impact?.resolved_at) {
          const d = (Date.parse(impact.resolved_at) - Date.parse(issue.first_reported_at)) / DAY;
          if (Number.isFinite(d) && d >= 0) days.push(d);
        }
      }
    }
    const completedSpend = done.reduce((n, p) => n + p.budget_estimate_inr, 0);
    const avgDays = days.length ? Number((days.reduce((a, b) => a + b, 0) / days.length).toFixed(1)) : null;
    const confirmation = yes + no > 0 ? Math.round((yes / (yes + no)) * 100) : null;
    const deliveryRate = committed.length ? Number((done.length / committed.length).toFixed(3)) : null;
    const signal: SchemePerformanceRow["signal"] =
      done.length < 2 ? "early" : confirmation !== null && confirmation < 70 ? "quality_concerns" : avgDays !== null && avgDays > 90 ? "slow" : "delivering";

    rows.push({
      scheme_id: id,
      short: scheme.short,
      name: scheme.name,
      ministry: scheme.ministry,
      priority: scheme.priority,
      centre_share: scheme.centre_share,
      projects: ps.length,
      pipeline,
      committed_inr: committedInr,
      central_inr: Math.round(committedInr * scheme.centre_share),
      completed: done.length,
      delivery_rate: deliveryRate,
      avg_days_to_fix: avgDays,
      people_benefited: people,
      cost_per_person_inr: people > 0 && completedSpend > 0 ? Math.round(completedSpend / people) : null,
      citizen_confirmation: confirmation,
      reopened,
      categories: [...new Set(ps.map((p) => issues.get(p.issue_id)?.category).filter((c): c is string => Boolean(c)))],
      signal,
    });
  }
  rows.sort((a, b) => b.committed_inr - a.committed_inr);

  const totals = {
    schemes: rows.length,
    projects: rows.reduce((n, r) => n + r.projects, 0),
    committed_inr: rows.reduce((n, r) => n + r.committed_inr, 0),
    central_inr: rows.reduce((n, r) => n + r.central_inr, 0),
    completed: rows.reduce((n, r) => n + r.completed, 0),
    people_benefited: rows.reduce((n, r) => n + r.people_benefited, 0),
  };
  return { totals, schemes: rows };
}
