import { randomUUID } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import type { DataFallback, InfraIndexType, Issue, PriorityScore } from "@jansetu/shared-types";
import { computeCompositeScore, demandScore, gapScore, percentile } from "@jansetu/shared-utils";
import type { AncestryStep } from "../lib/bigquery.js";
import { currentFiscalYearStart, parseFiscalYearStart } from "../lib/bigquery.js";
import { DEFAULT_SCORE_WEIGHTS } from "../lib/weights.js";
import type { Deps } from "../deps.js";

const MODEL_VERSION = "formula-v1";
const DUPLICATION_WINDOW_FISCAL_YEARS = 2;

// Higher value = better outcome for these index types, so vulnerability is
// (1 - value); poverty_index runs the other way (higher = worse) and isn't inverted.
const INVERT_INDEX_TYPE: Record<InfraIndexType, boolean> = {
  road_density: true,
  water_access: true,
  health_facility_ratio: true,
  literacy_rate: true,
  electrification_rate: true,
  poverty_index: false,
};

export interface ScoringRunSummary {
  issuesScored: number;
  meanComposite: number;
  p95Country: number;
  fallbackCountsByComponent: Record<string, number>;
}

async function resolveVulnerability(
  deps: Deps,
  ancestry: AncestryStep[],
): Promise<{ value: number; fallback: DataFallback | null }> {
  for (let i = 0; i < ancestry.length; i++) {
    const infra = await deps.referenceData.getInfraIndex(ancestry[i].regionId);
    const entries = infra ? Object.entries(infra.normalisedValuesByType) : [];
    if (entries.length === 0) continue;

    const values = entries.map(([type, value]) =>
      INVERT_INDEX_TYPE[type as InfraIndexType] ? 1 - value : value,
    );
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const fallback: DataFallback | null =
      i > 0
        ? {
            component: "vulnerability_score",
            used_level: ancestry[i].level,
            reason: `no ${ancestry[0].level}-level InfraIndex for ${ancestry[0].regionId}`,
          }
        : null;
    return { value: mean, fallback };
  }
  // Truly no InfraIndex anywhere in the ancestry chain — a neutral midpoint,
  // never a silent guess dressed up as a real measurement (docs/EDGE_CASES.md #7).
  return {
    value: 0.5,
    fallback: {
      component: "vulnerability_score",
      used_level: "none",
      reason: `no InfraIndex found anywhere in the ancestry chain for ${ancestry[0]?.regionId ?? "unresolved region"}`,
    },
  };
}

async function resolveGapAndDuplication(
  deps: Deps,
  regionId: string,
  category: string,
): Promise<{ gap: number; duplicationPenalty: number; fallback: DataFallback | null }> {
  const latest = await deps.referenceData.getLatestInvestment(regionId, category);
  if (!latest) {
    return {
      gap: gapScore(null),
      duplicationPenalty: 0,
      fallback: {
        component: "duplication_penalty",
        used_level: "unverified",
        reason: `no InvestmentRecord for category "${category}" in region ${regionId}`,
      },
    };
  }
  const yearsSince = currentFiscalYearStart(new Date()) - parseFiscalYearStart(latest.fiscalYear);
  const duplicationPenalty = yearsSince <= DUPLICATION_WINDOW_FISCAL_YEARS ? 1.0 : 0;
  return { gap: gapScore(yearsSince), duplicationPenalty, fallback: null };
}

async function scoreIssue(deps: Deps, issue: Issue, p95Country: number): Promise<PriorityScore> {
  const dataFallbacks: DataFallback[] = [];
  const demand = demandScore(issue.distinct_reporter_count, p95Country);

  let vulnerability = 0.5;
  let gap = 1.0;
  let duplicationPenalty = 0;
  let ancestry: AncestryStep[] = [];

  if (issue.admin_region_id) {
    ancestry = await deps.referenceData.getAncestryChain(issue.admin_region_id);
    const vulnResult = await resolveVulnerability(deps, ancestry);
    vulnerability = vulnResult.value;
    if (vulnResult.fallback) dataFallbacks.push(vulnResult.fallback);

    const gapResult = await resolveGapAndDuplication(deps, issue.admin_region_id, issue.category);
    gap = gapResult.gap;
    duplicationPenalty = gapResult.duplicationPenalty;
    if (gapResult.fallback) dataFallbacks.push(gapResult.fallback);
  } else {
    // Every submission currently lands in the "UNRESOLVED" bucket until Phase
    // 4.6's point-in-polygon resolution lands — see docs/phases/phase-5-manual-checklist.md.
    const reason = "issue has no resolved admin_region_id yet";
    dataFallbacks.push(
      { component: "vulnerability_score", used_level: "none", reason },
      { component: "gap_score", used_level: "none", reason },
      { component: "duplication_penalty", used_level: "unverified", reason },
    );
  }

  const impactEfficacy =
    ancestry.length > 0
      ? await deps.store.getImpactEfficacy(
          issue.category,
          ancestry.map((a) => a.regionId),
        )
      : null;

  const { base, composite } = computeCompositeScore(
    { demand, vulnerability, gap, duplicationPenalty, impactEfficacy },
    DEFAULT_SCORE_WEIGHTS,
  );

  return {
    score_id: `score_${issue.issue_id}_${randomUUID().slice(0, 8)}`,
    issue_id: issue.issue_id,
    country_code: issue.country_code,
    state_id: issue.state_id,
    demand_score: demand,
    vulnerability_score: vulnerability,
    gap_score: gap,
    duplication_penalty: duplicationPenalty,
    impact_efficacy: impactEfficacy,
    base_score: base,
    composite_score: composite,
    weights: DEFAULT_SCORE_WEIGHTS,
    data_fallbacks: dataFallbacks,
    model_version: MODEL_VERSION,
    computed_at: new Date().toISOString(),
    is_canonical: true,
  };
}

// docs/phases/phase-5-scoring.md §5.4 — the only writer of canonical scores.
// Simulation (Phase 6's agent tool) must never call this or write is_canonical: true.
export async function runScoringBatch(
  deps: Deps,
  log: FastifyBaseLogger,
  countryCode = "IN",
): Promise<ScoringRunSummary> {
  const [eligibleIssues, allCounts] = await Promise.all([
    deps.store.getEligibleIssuesForScoring(countryCode),
    deps.store.getAllDistinctReporterCounts(countryCode),
  ]);
  // Recomputed per batch and stored on each score — recomputing at query time
  // would make historical scores non-reproducible (phase doc "Traps").
  const p95Country = percentile(allCounts, 95);

  const fallbackCountsByComponent: Record<string, number> = {};
  let sumComposite = 0;

  for (const issue of eligibleIssues) {
    const score = await scoreIssue(deps, issue, p95Country);
    await deps.store.putPriorityScore(score);
    await deps.store.updateIssueScore(issue.issue_id, {
      composite_score: score.composite_score,
      latest_score_id: score.score_id,
    });
    sumComposite += score.composite_score;
    for (const fallback of score.data_fallbacks) {
      fallbackCountsByComponent[fallback.component] =
        (fallbackCountsByComponent[fallback.component] ?? 0) + 1;
    }
  }

  const summary: ScoringRunSummary = {
    issuesScored: eligibleIssues.length,
    meanComposite: eligibleIssues.length > 0 ? sumComposite / eligibleIssues.length : 0,
    p95Country,
    fallbackCountsByComponent,
  };
  log.info(summary, "scoring batch complete");
  return summary;
}
