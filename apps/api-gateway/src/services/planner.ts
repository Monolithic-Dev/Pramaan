import type { BudgetPlanItem, Issue, PriorityScore, Project } from "@pramaan/shared-types";
import { computeCompositeScore, type ScoreWeights } from "@pramaan/shared-utils";
import type { RegionInfo } from "../lib/bigquery.js";
import { estimateBudget } from "./costing.js";
import { inferSettlement, matchSchemes } from "./schemes.js";

export const VULNERABLE_THRESHOLD = 0.66;
// Issues in these states are already being handled, closed, or contested: funding them again
// would double-spend, so they are never plan candidates.
export const NOT_PLANNABLE = new Set(["funded", "in_progress", "resolved", "disputed", "tombstoned"]);

export interface Candidate extends BudgetPlanItem {
  reports: number;
  has_project: boolean;
}

/** value = priority score x reach factor. Score alone would fund the most severe tiny problem
 *  first; reach alone would ignore need. Multiplying keeps both honest. */
export function buildCandidates(
  issues: Issue[],
  scores: Map<string, PriorityScore>,
  projects: Map<string, Project>,
  regions: Map<string, RegionInfo>,
): Candidate[] {
  const rows = issues
    .filter((i) => !NOT_PLANNABLE.has(i.status))
    .flatMap((issue) => {
      const score = scores.get(issue.issue_id);
      if (!score) return []; // unscored issues have no defensible value
      const project = projects.get(issue.issue_id);
      return [{ issue, score, project }];
    });
  const maxReach = Math.max(1, ...rows.map((r) => r.score.estimated_impact_population ?? 0));

  return rows.map(({ issue, score, project }) => {
    const beneficiaries = score.estimated_impact_population ?? 0;
    const region = issue.admin_region_id ? regions.get(issue.admin_region_id) : undefined;
    const best = matchSchemes(issue, inferSettlement(region).settlement)[0];
    return {
      issue_id: issue.issue_id,
      category: issue.category,
      region_id: issue.admin_region_id,
      cost_inr: project?.budget_estimate_inr ?? estimateBudget(issue),
      composite_score: score.composite_score,
      vulnerability_score: score.vulnerability_score,
      beneficiaries,
      value: Number((score.composite_score * (0.6 + 0.4 * (beneficiaries / maxReach))).toFixed(4)),
      scheme_id: best?.scheme.id ?? null,
      reports: issue.report_count,
      has_project: Boolean(project),
    };
  });
}

/** Classic 0/1 knapsack on a budget discretised into at most ~5,000 units, so runtime and memory
 *  stay flat whether the budget is 10 lakh or 1,000 crore. Costs round *up* to whole units, so the
 *  chosen set can never exceed the real budget. */
export function knapsack(items: Candidate[], budgetInr: number): Candidate[] {
  if (items.length === 0 || budgetInr <= 0) return [];
  const unit = Math.max(10_000, Math.ceil(budgetInr / 5_000));
  const capacity = Math.floor(budgetInr / unit);
  const weights = items.map((i) => Math.max(1, Math.ceil(i.cost_inr / unit)));

  const best = new Float64Array(capacity + 1);
  const taken = items.map(() => new Uint8Array(capacity + 1));
  for (let i = 0; i < items.length; i++) {
    for (let c = capacity; c >= weights[i]; c--) {
      const withItem = best[c - weights[i]] + items[i].value;
      if (withItem > best[c]) {
        best[c] = withItem;
        taken[i][c] = 1;
      }
    }
  }
  const chosen: Candidate[] = [];
  let c = capacity;
  for (let i = items.length - 1; i >= 0; i--) {
    if (taken[i][c]) {
      chosen.push(items[i]);
      c -= weights[i];
    }
  }
  return chosen;
}

export interface PlanParams {
  budget_inr: number;
  /** Share of the budget reserved for issues in high-vulnerability areas (0..1). */
  min_vulnerable_share: number;
}

export interface PlanOutcome {
  items: Candidate[];
  cost_inr: number;
  beneficiaries: number;
  vulnerable_share: number;
  avg_score: number;
}

function summarise(items: Candidate[]): PlanOutcome {
  const cost = items.reduce((n, i) => n + i.cost_inr, 0);
  const vulnCost = items.filter((i) => i.vulnerability_score >= VULNERABLE_THRESHOLD).reduce((n, i) => n + i.cost_inr, 0);
  return {
    items,
    cost_inr: cost,
    beneficiaries: items.reduce((n, i) => n + i.beneficiaries, 0),
    vulnerable_share: cost ? Number((vulnCost / cost).toFixed(3)) : 0,
    avg_score: items.length ? Number((items.reduce((n, i) => n + i.composite_score, 0) / items.length).toFixed(3)) : 0,
  };
}

/** Optimal portfolio under a budget with an equity floor: stage 1 spends the reserved share on
 *  high-vulnerability areas only, stage 2 spends everything left on whatever is best. */
export function optimizePlan(candidates: Candidate[], params: PlanParams) {
  const vulnerable = candidates.filter((c) => c.vulnerability_score >= VULNERABLE_THRESHOLD);
  const reserve = Math.round(params.budget_inr * Math.min(1, Math.max(0, params.min_vulnerable_share)));

  const stage1 = knapsack(vulnerable, reserve);
  const spent1 = stage1.reduce((n, i) => n + i.cost_inr, 0);
  const picked = new Set(stage1.map((i) => i.issue_id));
  const stage2 = knapsack(candidates.filter((c) => !picked.has(c.issue_id)), params.budget_inr - spent1);
  const chosen = [...stage1, ...stage2].sort((a, b) => b.value / b.cost_inr - a.value / a.cost_inr);
  const plan = summarise(chosen);

  // The obvious alternative a busy office falls back on: fund whatever has the most reports.
  const baseline: Candidate[] = [];
  let left = params.budget_inr;
  for (const c of [...candidates].sort((a, b) => b.reports - a.reports || b.composite_score - a.composite_score)) {
    if (c.cost_inr <= left) {
      baseline.push(c);
      left -= c.cost_inr;
    }
  }

  const chosenIds = new Set(chosen.map((c) => c.issue_id));
  const remaining = params.budget_inr - plan.cost_inr;

  // The floor is a reserve of *budget*. Projects are indivisible, so it is met when the reserve is spent
  // on vulnerable areas, or when no unfunded vulnerable project would still fit in what is left of it:
  // the reserve was used as fully as whole projects allow. Comparing the share of *spend* instead
  // flagged a plan at 49.3% against a 50% reserve as failing. It is honestly unmet only when there are
  // not enough vulnerable issues to fill it.
  const vulnerableSpend = chosen.filter((c) => c.vulnerability_score >= VULNERABLE_THRESHOLD).reduce((n, c) => n + c.cost_inr, 0);
  const unfundedVulnerable = vulnerable.filter((c) => !chosenIds.has(c.issue_id));
  const equityFloorMet =
    reserve === 0 ||
    vulnerableSpend >= reserve ||
    (unfundedVulnerable.length > 0 && unfundedVulnerable.every((c) => c.cost_inr > reserve - spent1));
  // Every leftover is here for one reason: an optimal portfolio leaves nothing that still fits, so
  // whatever is missing lost out to items that deliver more value for the same money.
  const left_out = candidates
    .filter((c) => !chosenIds.has(c.issue_id))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return {
    candidates: candidates.length,
    // What funding every eligible issue would cost: lets the UI pick a budget that forces real trade-offs.
    candidates_cost_inr: candidates.reduce((n, c) => n + c.cost_inr, 0),
    plan,
    remaining_inr: remaining,
    equity_floor_met: equityFloorMet,
    baseline: summarise(baseline),
    left_out,
  };
}

/** Re-scores issues under different weights, from the stored component scores, and reports how the
 *  ranking moves. Nothing is persisted: it is a lens for a policymaker, not a change to the model. */
export function simulateWeights(
  issues: Issue[],
  scores: Map<string, PriorityScore>,
  weights: ScoreWeights,
  topN = 10,
) {
  const rescored = issues.flatMap((issue) => {
    const s = scores.get(issue.issue_id);
    if (!s) return [];
    const { composite } = computeCompositeScore(
      { demand: s.demand_score, vulnerability: s.vulnerability_score, gap: s.gap_score, duplicationPenalty: s.duplication_penalty, impactEfficacy: s.impact_efficacy },
      weights,
    );
    return [{ issue_id: issue.issue_id, category: issue.category, region_id: issue.admin_region_id, current: s.composite_score, simulated: Number(composite.toFixed(3)) }];
  });
  const currentRank = new Map([...rescored].sort((a, b) => b.current - a.current).map((r, i) => [r.issue_id, i + 1]));
  return [...rescored]
    .sort((a, b) => b.simulated - a.simulated)
    .slice(0, topN)
    .map((r, i) => ({ ...r, rank: i + 1, previous_rank: currentRank.get(r.issue_id) ?? null, moved: (currentRank.get(r.issue_id) ?? i + 1) - (i + 1) }));
}
