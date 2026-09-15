import type { AncestryStep, BigQueryAgentClient } from "../lib/bigquery.js";

// docs/phases/phase-6-agent-rag.md §6.1: every tool injects scope server-side.
// The model supplies a region_id argument — untrusted input, validated as a
// descendant of the session's pinned region_scope *before* any query runs.
// This is what makes the enforcement structural rather than a matter of the
// model's judgement (acceptance criteria: refused "at the tool layer").
export async function isWithinScope(
  bigquery: BigQueryAgentClient,
  candidateRegionId: string,
  pinnedScope: string,
): Promise<boolean> {
  if (candidateRegionId === pinnedScope) return true;
  const ancestry: AncestryStep[] = await bigquery.getAncestryChain(candidateRegionId);
  return ancestry.some((step) => step.regionId === pinnedScope);
}
