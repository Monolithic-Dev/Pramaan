import ngeohash from "ngeohash";

/** Precision 6 ≈ 1.2km × 0.6km cells — matches docs/DATA_MODEL.md's geohash fields. */
export function geohashEncode(lat: number, lng: number, precision = 6): string {
  return ngeohash.encode(lat, lng, precision);
}

/** Self + the 8 surrounding cells — required because geohash cells don't align to
 *  a search radius; a prefix match alone silently misses issues just across a
 *  cell boundary (docs/phases/phase-4-extraction-dedup.md "Traps"). */
export function geohashNeighbours(hash: string): string[] {
  return [hash, ...ngeohash.neighbors(hash)];
}

/** Centre point of a geohash cell — used as an approximate centroid where a
 *  real GeoCluster centroid isn't tracked yet (see worker-ai-pipeline's
 *  regionResolution.ts). At precision 6 the cell is ~1.2km × 0.6km, so this is
 *  accurate to a similar margin. */
export function geohashDecodeCenter(hash: string): { lat: number; lng: number } {
  const { latitude, longitude } = ngeohash.decode(hash);
  return { lat: latitude, lng: longitude };
}
