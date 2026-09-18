import type {
  EquityAuditReport,
  ImpactRecord,
  Issue,
  PriorityScore,
  VulnerabilityBand,
} from "@jansetu/shared-types";

export const MIN_BAND_SAMPLE = 5;
const FUNDED_STATUSES = new Set(["funded", "in_progress", "resolved"]);

export function bandFor(vulnerability: number): VulnerabilityBand {
  return vulnerability >= 0.66 ? "high" : vulnerability >= 0.33 ? "medium" : "low";
}

const avg = (xs: number[]) =>
  xs.length ? Number((xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(3)) : null;

export interface EquityInput {
  issue: Issue;
  score: PriorityScore | null;
  impact: ImpactRecord | null;
}

// docs/02-equity-fairness-audit.md. avg_days_to_verified is omitted: Issue has
// no verified_at timestamp, and fabricating one would be the opposite of the
// feature's point. Days-to-resolved comes from ImpactRecord.resolved_at.
export function computeEquityAudit(
  stateId: string,
  inputs: EquityInput[],
  now: Date,
): { bands: EquityAuditReport[]; verdict: string } {
  const bands: EquityAuditReport[] = (["low", "medium", "high"] as const).map((band) => {
    const rows = inputs.filter((r) => r.score && bandFor(r.score.vulnerability_score) === band);
    const days = rows
      .filter((r) => r.issue.status === "resolved" && r.impact)
      .map((r) => (Date.parse(r.impact!.resolved_at) - Date.parse(r.issue.first_reported_at)) / 86_400_000);
    const ok = rows.length >= MIN_BAND_SAMPLE;
    return {
      report_id: `eq_${stateId}_${band}`,
      state_id: stateId,
      period_start: rows.length ? rows.map((r) => r.issue.first_reported_at).sort()[0] : now.toISOString(),
      period_end: now.toISOString(),
      vulnerability_band: band,
      avg_composite_score: ok ? avg(rows.map((r) => r.score!.composite_score)) : null,
      avg_days_to_resolved: ok ? avg(days) : null,
      funded_ratio: ok
        ? Number((rows.filter((r) => FUNDED_STATUSES.has(r.issue.status)).length / rows.length).toFixed(3))
        : null,
      sample_size: rows.length,
      status: ok ? ("ok" as const) : ("insufficient_data" as const),
      computed_at: now.toISOString(),
    };
  });
  return { bands, verdict: verdictFor(bands) };
}

// Templated from the same numbers the chart shows: grounded by construction.
function verdictFor(bands: EquityAuditReport[]): string {
  const high = bands.find((b) => b.vulnerability_band === "high")!;
  const low = bands.find((b) => b.vulnerability_band === "low")!;
  if (high.status !== "ok" || low.status !== "ok" || high.funded_ratio === null || low.funded_ratio === null) {
    return `Not enough data to compare high- and low-vulnerability areas yet (need ${MIN_BAND_SAMPLE}+ scored issues per band; have ${high.sample_size} high, ${low.sample_size} low).`;
  }
  const hp = Math.round(high.funded_ratio * 100);
  const lp = Math.round(low.funded_ratio * 100);
  const gap = hp - lp;
  const rel =
    gap === 0
      ? "the same share of issues funded as"
      : gap > 0
        ? `${gap} percentage points more issues funded than`
        : `${-gap} percentage points fewer issues funded than`;
  return `High-vulnerability areas have ${rel} low-vulnerability areas (${hp}% vs ${lp}%).`;
}
