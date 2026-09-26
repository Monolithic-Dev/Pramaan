import { geohashEncode, haversineMeters } from "@pramaan/shared-utils";
import type { ReferenceDataClient, RegionCentroid } from "../lib/bigquery.js";

export interface ResolvedLocation {
  geohash: string | null;
  adminRegionId: string | null;
  stateId: string;
  /** Population of the resolved region — real density input for dedup radius
   *  (docs/AI_PIPELINE.md Stage 3), null when nothing resolved. */
  population: number | null;
}

// ponytail: nearest-centroid matching instead of true point-in-polygon
// (BigQuery ST_CONTAINS against real boundary geometries,
// docs/phases/phase-4-extraction-dedup.md §4.6) — no ward/district polygon
// dataset has been sourced for this build. AdminRegion centroids *are* real
// (scripts/seed-demo-data/source/admin_regions.csv), so this resolves to a
// genuinely plausible district for coordinates inside a seeded state, at the
// cost of accuracy right at a district boundary. Ceiling: wrong near a
// boundary, or for any point outside the ~3 seeded states entirely (nearest
// seeded district still "wins," however far away). Upgrade path: swap the
// body of resolveLocation for a BigQuery ST_CONTAINS join once real boundary
// geometries are loaded — callers don't change.
function findNearestRegion(
  point: { lat: number; lng: number },
  candidates: RegionCentroid[],
): RegionCentroid | null {
  let best: RegionCentroid | null = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = haversineMeters(point, { lat: candidate.lat, lng: candidate.lng });
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
}

function findStateAncestor(region: RegionCentroid, byId: Map<string, RegionCentroid>): string | null {
  let current: RegionCentroid | null = region;
  for (let i = 0; i < 6 && current; i++) {
    if (current.level === "state" || current.level === "estado") return current.regionId;
    current = current.parentRegionId ? (byId.get(current.parentRegionId) ?? null) : null;
  }
  return null;
}

export async function resolveLocation(
  referenceData: ReferenceDataClient,
  lat: number | null,
  lng: number | null,
  /** Submission.country_code (docs/CROSS_BORDER_AND_DPG.md) — a Brazilian
   *  submission must never nearest-match an Indian district just because it's
   *  the closest seeded centroid overall. */
  countryCode: string,
): Promise<ResolvedLocation> {
  if (lat === null || lng === null) {
    return { geohash: null, adminRegionId: null, stateId: "UNRESOLVED", population: null };
  }
  const geohash = geohashEncode(lat, lng, 6);

  const allRegions = await referenceData.getAllRegionCentroids();
  // A candidate with no countryCode (older/test fixtures) is treated as
  // matching any country — real BigQuery rows always set it.
  const regions = allRegions.filter((r) => (r.countryCode ?? countryCode) === countryCode);
  if (regions.length === 0) {
    return { geohash, adminRegionId: null, stateId: "UNRESOLVED", population: null };
  }

  const districts = regions.filter((r) => r.level === "district" || r.level === "município");
  const nearest = findNearestRegion({ lat, lng }, districts.length > 0 ? districts : regions);
  if (!nearest) return { geohash, adminRegionId: null, stateId: "UNRESOLVED", population: null };

  const byId = new Map(regions.map((r) => [r.regionId, r]));
  const stateId = findStateAncestor(nearest, byId) ?? "UNRESOLVED";

  return { geohash, adminRegionId: nearest.regionId, stateId, population: nearest.population };
}
