// docs/AI_PIPELINE.md Stage 6 / docs/phases/phase-5-scoring.md §5.1-5.2. Pure
// functions only — no I/O. Reference-data lookups (InfraIndex, InvestmentRecord,
// ImpactRecord) live in apps/worker-ai-pipeline behind a seam and feed these.

export interface ScoreWeights {
  demand: number;
  vulnerability: number;
  gap: number;
}

export interface ScoreComponents {
  demand: number;
  vulnerability: number;
  gap: number;
  duplicationPenalty: number;
  /** null = no impact history for this (category, region ancestry) yet. */
  impactEfficacy: number | null;
}

export interface CompositeScoreResult {
  base: number;
  dupFactor: number;
  effFactor: number;
  composite: number;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function computeCompositeScore(
  components: ScoreComponents,
  weights: ScoreWeights,
): CompositeScoreResult {
  const base =
    weights.demand * components.demand +
    weights.vulnerability * components.vulnerability +
    weights.gap * components.gap;
  const dupFactor = 1 - 0.15 * components.duplicationPenalty;
  // A region with no impact history must not be penalised for having no
  // history (docs/phases/phase-5-scoring.md "Traps") — effFactor is exactly
  // 1.0 when impactEfficacy is null, not the null-coalesced-to-0 value.
  const effFactor =
    components.impactEfficacy === null ? 1.0 : 0.85 + 0.3 * components.impactEfficacy;
  // clamp01 after multiplication, not before — effFactor can exceed 1.0.
  const composite = clamp01(base * dupFactor * effFactor);
  return { base, dupFactor, effFactor, composite };
}

/** Uses distinct reporters, not raw reports — one person filing twelve times
 *  is one unit of demand. */
export function demandScore(distinctReporterCount: number, p95Country: number): number {
  if (p95Country <= 0) return distinctReporterCount > 0 ? 1 : 0;
  return clamp01(Math.log(1 + distinctReporterCount) / Math.log(1 + p95Country));
}

/** `null` = no InvestmentRecord at all for this category/region -> full gap,
 *  flagged `unverified` by the caller (docs/EDGE_CASES.md #7). */
export function gapScore(yearsSinceLastRelevantInvestment: number | null): number {
  if (yearsSinceLastRelevantInvestment === null) return 1.0;
  return clamp01(yearsSinceLastRelevantInvestment / 5);
}

/** The p-th percentile (0-100) of a batch of values, nearest-rank method —
 *  simple and adequate at hackathon batch sizes, recomputed once per run
 *  and stored on the score so historical scores stay reproducible. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(Math.max(rank, 0), sorted.length - 1)];
}
