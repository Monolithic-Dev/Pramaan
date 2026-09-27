import type { Issue } from "@pramaan/shared-types";
import type { InfraIndexRow, InvestmentRow, RegionInfo } from "../lib/bigquery.js";

// "Is money going where the need is?" The problem statement's second failure, misaligned public
// spending, made measurable per district. Need combines how under-served an area is (its
// infrastructure indices) with how many people are waiting on unresolved problems there; spend is
// what was sanctioned there recently, per resident. Both are percentiles within the country, so a
// Brazilian município is never ranked against an Indian district.

/** Higher value = better outcome for these, so deprivation is (1 - value). Same rule the scoring worker uses. */
const HIGHER_IS_BETTER = new Set(["road_density", "water_access", "health_facility_ratio", "literacy_rate", "electrification_rate"]);
const LEAF_LEVELS = new Set(["district", "município"]);
const SPEND_WINDOW_FISCAL_YEARS = 4; // the current fiscal year and the three before it
const OPEN = new Set(["open", "verified", "disputed", "prioritized", "funded", "in_progress"]);

export type Quadrant = "underserved" | "targeted" | "over_indexed" | "stable";

export interface NeedVsSpendRow {
  region_id: string;
  name: string;
  state_name: string | null;
  country_code: string;
  population: number;
  /** 0-1, from infrastructure indices; null when the district and its state have none. */
  vulnerability: number | null;
  open_issues: number;
  /** Distinct people behind unresolved issues. */
  waiting_reporters: number;
  demand_per_100k: number;
  investment: number;
  currency: string;
  investment_per_capita: number;
  /** 0-1 percentiles within the country. */
  need_index: number;
  spend_index: number;
  /** need_index - spend_index: positive means spending lags need. */
  gap: number;
  quadrant: Quadrant;
  top_unmet_categories: { category: string; reporters: number }[];
}

/** Fiscal year "2024-25" starts in April 2024; the current one depends on the month. */
function fiscalStart(fy: string): number {
  return Number(fy.slice(0, 4));
}
function currentFiscalStart(now: Date): number {
  return now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

/** Share of values that are <= v (0..1). A single value is 0.5: no peer to compare against. */
function percentileOf(values: number[], v: number): number {
  if (values.length <= 1) return 0.5;
  return values.filter((x) => x <= v).length / values.length;
}

function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return dx === 0 || dy === 0 ? null : Number((num / Math.sqrt(dx * dy)).toFixed(2));
}

export function computeNeedVsSpend(
  input: { regions: RegionInfo[]; scopeRegionIds: Set<string>; issues: Issue[]; infra: InfraIndexRow[]; investments: InvestmentRow[] },
  now = new Date(),
) {
  const byId = new Map(input.regions.map((r) => [r.regionId, r]));
  // Percentiles always compare a district with every district in its country, even when the caller only
  // sees one: "high need" must mean high relative to the nation, not to a jurisdiction of one.
  const leaves = input.regions.filter((r) => LEAF_LEVELS.has(r.level));

  // Deprivation per region: the mean of its indices, oriented so higher = more deprived.
  const deprivation = new Map<string, number[]>();
  for (const row of input.infra) {
    const v = HIGHER_IS_BETTER.has(row.index_type) ? 1 - row.normalised_value : row.normalised_value;
    deprivation.set(row.region_id, [...(deprivation.get(row.region_id) ?? []), v]);
  }
  const vulnerabilityOf = (id: string): number | null => {
    for (let cur: string | null = id, hops = 0; cur && hops < 6; hops++) {
      const vals = deprivation.get(cur);
      if (vals?.length) return vals.reduce((a, b) => a + b, 0) / vals.length;
      cur = byId.get(cur)?.parentRegionId ?? null;
    }
    return null;
  };

  const minFy = currentFiscalStart(now) - (SPEND_WINDOW_FISCAL_YEARS - 1);
  const spend = new Map<string, { amount: number; currency: string }>();
  for (const inv of input.investments) {
    if (fiscalStart(inv.fiscal_year) < minFy) continue;
    const cur = spend.get(inv.region_id) ?? { amount: 0, currency: inv.currency };
    cur.amount += Number(inv.amount) || 0;
    spend.set(inv.region_id, cur);
  }

  const openByRegion = new Map<string, Issue[]>();
  for (const i of input.issues) {
    if (!i.admin_region_id || !OPEN.has(i.status)) continue;
    openByRegion.set(i.admin_region_id, [...(openByRegion.get(i.admin_region_id) ?? []), i]);
  }

  const raw = leaves.map((r) => {
    const open = openByRegion.get(r.regionId) ?? [];
    const waiting = open.reduce((n, i) => n + i.distinct_reporter_count, 0);
    const cats = new Map<string, number>();
    for (const i of open) cats.set(i.category, (cats.get(i.category) ?? 0) + i.distinct_reporter_count);
    const s = spend.get(r.regionId);
    const population = Math.max(1, r.population);
    const state = r.parentRegionId ? byId.get(r.parentRegionId) : undefined;
    return {
      region: r,
      state_name: state?.name ?? null,
      vulnerability: vulnerabilityOf(r.regionId),
      open_issues: open.length,
      waiting_reporters: waiting,
      demand_per_100k: (waiting / population) * 100_000,
      investment: s?.amount ?? 0,
      currency: s?.currency ?? (r.countryCode === "BR" ? "BRL" : "INR"),
      investment_per_capita: (s?.amount ?? 0) / population,
      top_unmet_categories: [...cats].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([category, reporters]) => ({ category, reporters })),
    };
  });

  const allRows: NeedVsSpendRow[] = raw.map((x) => {
    const peers = raw.filter((p) => p.region.countryCode === x.region.countryCode);
    const demandPct = percentileOf(peers.map((p) => p.demand_per_100k), x.demand_per_100k);
    const vulnerabilityPct = x.vulnerability === null ? 0.5 : percentileOf(peers.map((p) => p.vulnerability ?? 0.5), x.vulnerability);
    const need = Number((0.5 * vulnerabilityPct + 0.5 * demandPct).toFixed(3));
    // A district with no recorded investment ranks at the bottom, not "somewhere in the middle".
    const spendIdx = x.investment === 0 ? 0 : Number(percentileOf(peers.map((p) => p.investment_per_capita), x.investment_per_capita).toFixed(3));
    const quadrant: Quadrant = need >= 0.5 ? (spendIdx < 0.5 ? "underserved" : "targeted") : spendIdx >= 0.5 ? "over_indexed" : "stable";
    return {
      region_id: x.region.regionId,
      name: x.region.name,
      state_name: x.state_name,
      country_code: x.region.countryCode,
      population: x.region.population,
      vulnerability: x.vulnerability === null ? null : Number(x.vulnerability.toFixed(3)),
      open_issues: x.open_issues,
      waiting_reporters: x.waiting_reporters,
      demand_per_100k: Number(x.demand_per_100k.toFixed(1)),
      investment: x.investment,
      currency: x.currency,
      investment_per_capita: Number(x.investment_per_capita.toFixed(2)),
      need_index: need,
      spend_index: spendIdx,
      gap: Number((need - spendIdx).toFixed(3)),
      quadrant,
      top_unmet_categories: x.top_unmet_categories,
    };
  });

  const rows = allRows.filter((r) => input.scopeRegionIds.has(r.region_id));
  const counts = { underserved: 0, targeted: 0, over_indexed: 0, stable: 0 } as Record<Quadrant, number>;
  for (const r of rows) counts[r.quadrant] += 1;
  const correlation = pearson(rows.map((r) => r.need_index), rows.map((r) => r.spend_index));
  const underserved = rows.filter((r) => r.quadrant === "underserved");

  return {
    fiscal_years_from: `${minFy}-${String((minFy + 1) % 100).padStart(2, "0")}`,
    districts: rows.sort((a, b) => b.gap - a.gap),
    quadrants: counts,
    /** Pearson correlation between need and spend: near +1 = money follows need, near 0 or negative = it does not. */
    alignment: correlation,
    verdict:
      correlation === null
        ? "insufficient_data"
        : correlation >= 0.5
          ? "aligned"
          : correlation >= 0.2
            ? "partly_aligned"
            : "misaligned",
    underserved_people_waiting: underserved.reduce((n, r) => n + r.waiting_reporters, 0),
    underserved_population: underserved.reduce((n, r) => n + r.population, 0),
  };
}
