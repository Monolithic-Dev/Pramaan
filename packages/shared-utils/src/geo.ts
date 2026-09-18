// Rough bounding boxes per country, used to flag (not reject) out-of-bounds
// submissions per docs/EDGE_CASES.md #3. Keyed by CountryProfile.country_code
// (docs/CROSS_BORDER_AND_DPG.md) — add a country here, not a new function.
const COUNTRY_BOUNDS: Record<
  string,
  { minLat: number; maxLat: number; minLng: number; maxLng: number }
> = {
  IN: { minLat: 6.0, maxLat: 37.6, minLng: 68.0, maxLng: 97.5 },
  BR: { minLat: -33.8, maxLat: 5.3, minLng: -73.9, maxLng: -28.8 },
};

export function isWithinCountryBoundingBox(countryCode: string, lat: number, lng: number): boolean {
  const bounds = COUNTRY_BOUNDS[countryCode] ?? COUNTRY_BOUNDS.IN;
  return lat >= bounds.minLat && lat <= bounds.maxLat && lng >= bounds.minLng && lng <= bounds.maxLng;
}

/** @deprecated Use isWithinCountryBoundingBox(countryCode, lat, lng). Kept for existing callers/tests. */
export function isWithinIndiaBoundingBox(lat: number, lng: number): boolean {
  return isWithinCountryBoundingBox("IN", lat, lng);
}
