import { geohashEncode } from "@jansetu/shared-utils";

export interface ResolvedLocation {
  geohash: string | null;
  adminRegionId: string | null;
  stateId: string;
}

// ponytail: point-in-polygon resolution against real AdminRegion boundary
// geometries (BigQuery ST_CONTAINS, docs/phases/phase-4-extraction-dedup.md
// §4.6) needs a real boundary dataset loaded, which doesn't exist yet — every
// submission lands in one "UNRESOLVED" state_id bucket for now. Dedup still
// works correctly within that bucket (geohash + haversine do the real
// filtering); upgrade path is wiring this function to the BigQuery join once
// infra/gcp/bigquery-schemas/admin_regions.json is populated with geometries.
export function resolveLocation(lat: number | null, lng: number | null): ResolvedLocation {
  if (lat === null || lng === null) {
    return { geohash: null, adminRegionId: null, stateId: "UNRESOLVED" };
  }
  return { geohash: geohashEncode(lat, lng, 6), adminRegionId: null, stateId: "UNRESOLVED" };
}
