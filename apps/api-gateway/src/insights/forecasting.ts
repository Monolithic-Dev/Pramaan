import type { Issue } from "@jansetu/shared-types";

export const FORECAST_MODEL_VERSION = "seasonal-heuristic-v1";
export const RISK_WINDOW_DAYS = 45;

export type SeasonalRiskResult =
  | { status: "insufficient_data"; reason: string }
  | { status: "no_risk"; reason: string }
  | {
      status: "forecast";
      risk_level: "medium" | "high";
      window_start: string;
      window_end: string;
      factors: string[];
    };

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// docs/01-predictive-early-warning.md: a deterministic, explainable seasonal
// heuristic, never a trained model. A month is "recurring" only if issues in
// it were first reported in >=2 distinct years; a cold-start region returns an
// explicit insufficient_data, never a fabricated risk level (EDGE_CASES.md #7).
export function computeSeasonalRisk(
  history: Pick<Issue, "first_reported_at">[],
  opts: { now: Date; hasRecentInvestment: boolean; windowDays?: number },
): SeasonalRiskResult {
  const windowDays = opts.windowDays ?? RISK_WINDOW_DAYS;
  const dates = history.map((h) => new Date(h.first_reported_at)).filter((d) => !Number.isNaN(d.getTime()));
  const years = new Set(dates.map((d) => d.getUTCFullYear()));
  if (dates.length < 3 || years.size < 2) {
    return {
      status: "insufficient_data",
      reason: `need >=3 historical reports across >=2 years; have ${dates.length} across ${years.size}`,
    };
  }

  const yearsByMonth = new Map<number, Set<number>>();
  const countByMonth = new Map<number, number>();
  for (const d of dates) {
    const m = d.getUTCMonth();
    if (!yearsByMonth.has(m)) yearsByMonth.set(m, new Set());
    yearsByMonth.get(m)!.add(d.getUTCFullYear());
    countByMonth.set(m, (countByMonth.get(m) ?? 0) + 1);
  }
  let peak = -1;
  for (const [m, ys] of yearsByMonth) {
    if (peak === -1) {
      peak = m;
      continue;
    }
    const best = yearsByMonth.get(peak)!;
    if (ys.size > best.size || (ys.size === best.size && countByMonth.get(m)! > countByMonth.get(peak)!)) {
      peak = m;
    }
  }
  const peakYears = yearsByMonth.get(peak)!;
  if (peakYears.size < 2) {
    return { status: "no_risk", reason: "no month recurs across multiple years" };
  }

  const nowMs = opts.now.getTime();
  let year = opts.now.getUTCFullYear();
  let start = Date.UTC(year, peak, 1);
  let end = Date.UTC(year, peak + 1, 1) - 1;
  if (end < nowMs) {
    year += 1;
    start = Date.UTC(year, peak, 1);
    end = Date.UTC(year, peak + 1, 1) - 1;
  }
  if (start - nowMs > windowDays * 86_400_000) {
    return {
      status: "no_risk",
      reason: `next seasonal peak (${MONTH_NAMES[peak]}) is outside the ${windowDays}-day window`,
    };
  }
  if (opts.hasRecentInvestment) {
    return {
      status: "no_risk",
      reason: "recent investment on record for this category, pattern likely addressed",
    };
  }

  return {
    status: "forecast",
    risk_level: peakYears.size >= 3 ? "high" : "medium",
    window_start: new Date(start).toISOString(),
    window_end: new Date(end).toISOString(),
    factors: [
      `${MONTH_NAMES[peak]} reports recurred in ${peakYears.size} distinct years (${countByMonth.get(peak)} reports total)`,
      "no investment recorded for this category in the last 2 fiscal years",
    ],
  };
}

/** "2024-25" -> 2024; true if any record started within the last 2 fiscal years. */
export function hasRecentInvestment(fiscalYears: string[], now: Date): boolean {
  const current = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return fiscalYears.some((fy) => current - Number(fy.split("-")[0]) <= 1);
}
