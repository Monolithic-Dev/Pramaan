export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error("cosine: vectors must be the same length");
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export type DensityClass = "urban" | "peri" | "rural";

/** Dedup radius (metres) per density class — docs/phases/phase-4-extraction-dedup.md §4.4. */
export const RADIUS_M: Record<DensityClass, number> = {
  urban: 300,
  peri: 800,
  rural: 2000,
};

// Real density comes from AdminRegion population/area once that data is loaded
// (docs/phases/phase-4-extraction-dedup.md §4.6 depends on the same boundary
// dataset). Until then this is a population-threshold placeholder — swap the
// body, not the call sites, once real density data exists.
export function densityClass(population: number | null): DensityClass {
  if (population === null) return "peri";
  if (population >= 500_000) return "urban";
  if (population >= 50_000) return "peri";
  return "rural";
}
