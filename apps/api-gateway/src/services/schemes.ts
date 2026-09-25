import type { Issue } from "@jansetu/shared-types";
import { SCHEMES, type Scheme } from "../data/schemes.js";
import type { RegionInfo } from "../lib/bigquery.js";
import { estimateBudget } from "./costing.js";

export type Settlement = "urban" | "rural" | "unknown";

const URBAN_LEVELS = new Set(["município", "ward", "bairro"]);
const FALLBACK_SCHEMES = new Set(["state_plan", "mplads", "xvfc"]);

/** A hint, never a fact: no region carries an urban/rural flag, so this infers one from what is
 *  known and says so. The officer can override it in the UI. */
export function inferSettlement(region: Pick<RegionInfo, "population" | "level" | "name"> | undefined): { settlement: Settlement; basis: string } {
  if (!region) return { settlement: "unknown", basis: "Location not resolved to a region" };
  if (URBAN_LEVELS.has(region.level)) return { settlement: "urban", basis: `${region.name} is a ${region.level}` };
  if (/urban|city|metropolitan/i.test(region.name)) return { settlement: "urban", basis: `${region.name} is an urban area` };
  if (region.population >= 2_500_000) {
    return { settlement: "urban", basis: `Inferred from population (${(region.population / 1_000_000).toFixed(1)} M)` };
  }
  return { settlement: "unknown", basis: "Urban/rural status not recorded; showing both kinds of scheme" };
}

export interface SchemeMatch {
  scheme: Scheme;
  fit: number;
  reasons: string[];
  funding: { budget_inr: number; centre_inr: number; state_inr: number };
}

export function matchSchemes(
  issue: Pick<Issue, "category" | "subcategory" | "canonical_description" | "report_count">,
  settlement: Settlement,
  budgetInr = estimateBudget(issue),
): SchemeMatch[] {
  const haystack = `${issue.subcategory} ${issue.canonical_description}`.toLowerCase();
  const matches: SchemeMatch[] = [];

  for (const scheme of SCHEMES) {
    if (!scheme.categories.includes(issue.category)) continue;
    const reasons = [`Funds ${issue.category.replace("_", " ")} works`];
    let fit = 0.5;

    if (scheme.settlement === "both") {
      fit += 0.15;
    } else if (settlement === "unknown") {
      fit += 0.1;
      reasons.push(`Designed for ${scheme.settlement} areas; confirm this location`);
    } else if (scheme.settlement === settlement) {
      fit += 0.3;
      reasons.push(`Designed for ${scheme.settlement} areas, matching this location`);
    } else {
      reasons.push(`Designed for ${scheme.settlement} areas; this location looks ${settlement}`);
    }

    const hits = scheme.keywords.filter((k) => haystack.includes(k));
    if (hits.length > 0) {
      fit += Math.min(0.2, hits.length * 0.1);
      reasons.push(`Report mentions ${hits.slice(0, 3).join(", ")}`);
    }
    if (FALLBACK_SCHEMES.has(scheme.id)) fit -= 0.1;

    const centre = Math.round(budgetInr * scheme.centre_share);
    matches.push({
      scheme,
      fit: Number(Math.min(1, Math.max(0, fit)).toFixed(2)),
      reasons,
      funding: { budget_inr: budgetInr, centre_inr: centre, state_inr: budgetInr - centre },
    });
  }
  return matches.sort((a, b) => b.fit - a.fit || b.scheme.centre_share - a.scheme.centre_share);
}

export interface AlignmentRow {
  scheme_id: string;
  short: string;
  name: string;
  priority: string;
  issues: number;
  cost_inr: number;
  centre_inr: number;
}

/** Region-level view: if every open issue were routed to its best-fit scheme, how much of the cost
 *  could be drawn from central funds, and through which programmes? */
export function computeAlignment(issues: Issue[], regions: Map<string, RegionInfo>) {
  const open = issues.filter((i) => i.status !== "resolved" && i.status !== "tombstoned");
  const byScheme = new Map<string, AlignmentRow>();
  let totalCost = 0;
  let centre = 0;

  for (const issue of open) {
    const region = issue.admin_region_id ? regions.get(issue.admin_region_id) : undefined;
    const best = matchSchemes(issue, inferSettlement(region).settlement)[0];
    if (!best) continue;
    const row = byScheme.get(best.scheme.id) ?? {
      scheme_id: best.scheme.id,
      short: best.scheme.short,
      name: best.scheme.name,
      priority: best.scheme.priority,
      issues: 0,
      cost_inr: 0,
      centre_inr: 0,
    };
    row.issues += 1;
    row.cost_inr += best.funding.budget_inr;
    row.centre_inr += best.funding.centre_inr;
    byScheme.set(best.scheme.id, row);
    totalCost += best.funding.budget_inr;
    centre += best.funding.centre_inr;
  }

  return {
    open_issues: open.length,
    total_cost_inr: totalCost,
    centre_inr: centre,
    state_inr: totalCost - centre,
    centre_share: totalCost ? Number((centre / totalCost).toFixed(3)) : 0,
    by_scheme: [...byScheme.values()].sort((a, b) => b.cost_inr - a.cost_inr),
  };
}
