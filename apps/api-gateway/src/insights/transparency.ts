import type { ImpactRecord, Issue } from "@pramaan/shared-types";

// k-anonymity-style floor (docs/06-public-transparency-ledger.md): no stat is
// published for a state with fewer issues than this.
export const MIN_PUBLIC_COUNT = 5;
const VERIFIED_OR_BEYOND = new Set(["verified", "prioritized", "funded", "in_progress", "resolved"]);
const FUNDED_OR_BEYOND = new Set(["funded", "in_progress", "resolved"]);

export type TransparencyStats =
  | { state_id: string; status: "insufficient_data"; min_required: number }
  | {
      state_id: string;
      status: "ok";
      total_reported: number;
      pct_verified: number;
      pct_funded: number;
      pct_resolved: number;
      avg_days_to_resolved: number | null;
    };

const pct = (n: number, d: number) => Math.round((n / d) * 100);

// Aggregate-only by construction: this function never receives, and so can never
// leak, submissions, photos, locations or citizen identifiers.
export function computeTransparency(
  stateId: string,
  issues: Pick<Issue, "status" | "first_reported_at" | "issue_id">[],
  impacts: Pick<ImpactRecord, "issue_id" | "resolved_at">[],
): TransparencyStats {
  if (issues.length < MIN_PUBLIC_COUNT) {
    return { state_id: stateId, status: "insufficient_data", min_required: MIN_PUBLIC_COUNT };
  }
  const impactByIssue = new Map(impacts.map((i) => [i.issue_id, i]));
  const days = issues
    .filter((i) => i.status === "resolved" && impactByIssue.has(i.issue_id))
    .map((i) => (Date.parse(impactByIssue.get(i.issue_id)!.resolved_at) - Date.parse(i.first_reported_at)) / 86_400_000);
  return {
    state_id: stateId,
    status: "ok",
    total_reported: issues.length,
    pct_verified: pct(issues.filter((i) => VERIFIED_OR_BEYOND.has(i.status)).length, issues.length),
    pct_funded: pct(issues.filter((i) => FUNDED_OR_BEYOND.has(i.status)).length, issues.length),
    pct_resolved: pct(issues.filter((i) => i.status === "resolved").length, issues.length),
    avg_days_to_resolved: days.length ? Number((days.reduce((a, b) => a + b, 0) / days.length).toFixed(1)) : null,
  };
}

export function priorityBand(composite: number | null): "high" | "medium" | "low" | "pending" {
  if (composite === null) return "pending";
  return composite >= 0.6 ? "high" : composite >= 0.35 ? "medium" : "low";
}
