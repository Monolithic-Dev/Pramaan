import type { Issue } from "@jansetu/shared-types";
import { geohashDecodeCenter } from "@jansetu/shared-utils";
import type { Deps } from "../deps.js";
import type { RegionInfo } from "../lib/bigquery.js";
import { priorityBand } from "../insights/transparency.js";
import { slaFor } from "./sla.js";

/** Issues visible to a jurisdiction: a state sees every issue in the state, a district only its own. */
export async function getIssuesInScope(deps: Deps, regionId: string): Promise<Issue[]> {
  const chain = await deps.bigqueryAgent.getAncestryChain(regionId);
  const level = chain[0]?.level;
  const issues =
    level === "state" || level === "estado"
      ? await deps.store.listIssues(regionId)
      : level === "country"
        ? // A country-level officer sees their own country only: issue.country_code is the country region id.
          (await deps.store.listIssues()).filter((i) => i.country_code === regionId)
        : await deps.store.getIssuesByRegion(regionId);
  return issues.filter((i) => i.status !== "tombstoned");
}

/** Every region at or below `scopeId`, answered from the region list itself: no per-region lookups. */
export function regionsWithin(regions: RegionInfo[], scopeId: string): RegionInfo[] {
  const byId = new Map(regions.map((r) => [r.regionId, r]));
  const within = (id: string | null): boolean => {
    for (let hops = 0; id && hops < 8; hops++) {
      if (id === scopeId) return true;
      id = byId.get(id)?.parentRegionId ?? null;
    }
    return false;
  };
  return regions.filter((r) => within(r.regionId));
}

export function issueLocation(issue: Issue): { lat: number; lng: number } | null {
  if (issue.centroid_lat != null && issue.centroid_lng != null) {
    return { lat: issue.centroid_lat, lng: issue.centroid_lng };
  }
  return issue.geohash ? geohashDecodeCenter(issue.geohash) : null;
}

export async function regionNameMap(deps: Deps): Promise<Map<string, RegionInfo>> {
  return new Map((await deps.bigqueryAgent.listRegions()).map((r) => [r.regionId, r]));
}

/** The list-row shape: everything a table needs, nothing (embeddings, submission ids) it does not. */
export function summarizeIssue(issue: Issue, regions: Map<string, RegionInfo>, projectIssueIds?: Set<string>) {
  const loc = issueLocation(issue);
  const region = issue.admin_region_id ? regions.get(issue.admin_region_id) : undefined;
  const state = regions.get(issue.state_id);
  return {
    issue_id: issue.issue_id,
    category: issue.category,
    subcategory: issue.subcategory,
    description: issue.canonical_description,
    status: issue.status,
    report_count: issue.report_count,
    distinct_reporter_count: issue.distinct_reporter_count,
    composite_score: issue.composite_score,
    priority: priorityBand(issue.composite_score),
    admin_region_id: issue.admin_region_id,
    region_name: region?.name ?? null,
    state_id: issue.state_id,
    state_name: state?.name ?? null,
    country_code: issue.country_code,
    lat: loc?.lat ?? null,
    lng: loc?.lng ?? null,
    first_reported_at: issue.first_reported_at,
    last_reported_at: issue.last_reported_at,
    emergency_override: issue.emergency_override,
    fraud_flags: issue.fraud_flags,
    is_synthetic: issue.is_synthetic === true,
    support_count: issue.support_count ?? 0,
    assigned_to_uid: issue.assigned_to_uid ?? null,
    assigned_to_label: issue.assigned_to_label ?? null,
    sla: slaFor(issue),
    has_project: projectIssueIds ? projectIssueIds.has(issue.issue_id) : undefined,
  };
}

const STATUS_ORDER = ["open", "verified", "disputed", "prioritized", "funded", "in_progress", "resolved"] as const;

const dayKey = (iso: string) => iso.slice(0, 10);

/** Dashboard numbers for a set of issues. Everything is derived from the same Issue records the
 *  list shows, so the KPIs can never disagree with the table underneath them. */
export function computeOverview(issues: Issue[], regions: Map<string, RegionInfo>, now = new Date()) {
  const scored = issues.filter((i) => i.composite_score !== null);
  const byCategory = new Map<string, { category: string; issues: number; reports: number }>();
  const byStatus = new Map<string, number>(STATUS_ORDER.map((s) => [s, 0]));
  const byRegion = new Map<string, { region_id: string; name: string; issues: number; reports: number; top_score: number }>();
  const monthly = new Map<string, number>();
  const daily = new Map<string, number>();

  for (let d = 29; d >= 0; d--) daily.set(dayKey(new Date(now.getTime() - d * 86_400_000).toISOString()), 0);
  for (let m = 11; m >= 0; m--) {
    const dt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - m, 1));
    monthly.set(dt.toISOString().slice(0, 7), 0);
  }

  for (const issue of issues) {
    const cat = byCategory.get(issue.category) ?? { category: issue.category, issues: 0, reports: 0 };
    cat.issues += 1;
    cat.reports += issue.report_count;
    byCategory.set(issue.category, cat);

    byStatus.set(issue.status, (byStatus.get(issue.status) ?? 0) + 1);

    const rid = issue.admin_region_id ?? "unresolved";
    const reg = byRegion.get(rid) ?? {
      region_id: rid,
      name: regions.get(rid)?.name ?? "Unresolved location",
      issues: 0,
      reports: 0,
      top_score: 0,
    };
    reg.issues += 1;
    reg.reports += issue.report_count;
    reg.top_score = Math.max(reg.top_score, issue.composite_score ?? 0);
    byRegion.set(rid, reg);

    const day = dayKey(issue.first_reported_at);
    if (daily.has(day)) daily.set(day, (daily.get(day) ?? 0) + 1);
    const month = issue.first_reported_at.slice(0, 7);
    if (monthly.has(month)) monthly.set(month, (monthly.get(month) ?? 0) + 1);
  }

  const resolved = byStatus.get("resolved") ?? 0;
  return {
    totals: {
      issues: issues.length,
      reports: issues.reduce((n, i) => n + i.report_count, 0),
      distinct_reporters: issues.reduce((n, i) => n + i.distinct_reporter_count, 0),
      resolved,
      resolution_rate: issues.length ? Math.round((resolved / issues.length) * 100) : 0,
      high_priority: scored.filter((i) => (i.composite_score ?? 0) >= 0.6).length,
      emergency: issues.filter((i) => i.emergency_override).length,
      flagged: issues.filter((i) => i.fraud_flags.length > 0).length,
      avg_score: scored.length
        ? Number((scored.reduce((n, i) => n + (i.composite_score ?? 0), 0) / scored.length).toFixed(3))
        : null,
      sample_data: issues.some((i) => i.is_synthetic === true),
    },
    by_category: [...byCategory.values()].sort((a, b) => b.issues - a.issues),
    by_status: [...byStatus].map(([status, count]) => ({ status, count })),
    top_regions: [...byRegion.values()].sort((a, b) => b.reports - a.reports).slice(0, 8),
    trend_daily: [...daily].map(([date, count]) => ({ date, count })),
    trend_monthly: [...monthly].map(([month, count]) => ({ month, count })),
  };
}
