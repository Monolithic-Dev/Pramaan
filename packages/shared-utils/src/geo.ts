// Rough bounding box for India (mainland + islands), used to flag (not reject)
// out-of-bounds submissions per docs/EDGE_CASES.md #3.
const INDIA_BOUNDS = { minLat: 6.0, maxLat: 37.6, minLng: 68.0, maxLng: 97.5 };

export function isWithinIndiaBoundingBox(lat: number, lng: number): boolean {
  return (
    lat >= INDIA_BOUNDS.minLat &&
    lat <= INDIA_BOUNDS.maxLat &&
    lng >= INDIA_BOUNDS.minLng &&
    lng <= INDIA_BOUNDS.maxLng
  );
}
