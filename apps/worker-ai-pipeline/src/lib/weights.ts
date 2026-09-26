import type { ScoreWeights } from "@pramaan/shared-utils";

// docs/phases/phase-5-scoring.md §5.1 calls for weights sourced from
// CountryProfile rather than a code constant, so a state admin can tune them
// per-state. CountryProfile (shared-types) doesn't carry a weights field yet —
// adding one is its own schema migration, deferred (docs/phases/phase-5-manual-checklist.md).
// Env-configurable in the meantime, which is most of the intended benefit
// ("a two-line change, not a refactor") without the schema change.
export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  demand: Number(process.env.SCORE_WEIGHT_DEMAND ?? "0.40"),
  vulnerability: Number(process.env.SCORE_WEIGHT_VULNERABILITY ?? "0.30"),
  gap: Number(process.env.SCORE_WEIGHT_GAP ?? "0.30"),
};
