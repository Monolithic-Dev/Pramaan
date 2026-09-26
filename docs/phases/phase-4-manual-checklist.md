# Phase 4 — manual steps (run these yourself)

Categorization, embeddings, and geohash-based dedup are implemented and unit-tested
(12/12 worker tests, no live GCP needed — see `apps/worker-ai-pipeline/src/testUtils/fakeDeps.ts`).
See `apps/worker-ai-pipeline/.env.example`. These steps need real credentials/data:

1. **Enable Vertex AI** (already covered by `infra/gcp/setup.sh` from Phase 1 — `aiplatform.googleapis.com`).
2. **Run the worker against a real project**:
   ```bash
   gcloud auth application-default login
   GCP_PROJECT_ID=<project-id> pnpm --filter @pramaan/worker-ai-pipeline dev
   ```
3. **Manual end-to-end check**: submit via `api-gateway` (Phase 3), then confirm:
   - The `raw-submissions` Pub/Sub subscription delivers to the worker's `/pubsub-push`.
   - The `submissions/{id}` doc transitions `queued` → `processing` → `processed`, with `issue_id` set.
   - A new `issues/{id}` doc exists with a real 768-dim `embedding` from `text-embedding-005`.
4. **Real threshold tuning** (§4.5 of `phase-4-extraction-dedup.md`): build a labelled set of 120 real submission pairs (60 true duplicates, 60 near-misses) once real/seed submissions exist, replace `scripts/dedup-tuning/pairs.json`, re-run `pnpm --filter @pramaan/scripts tune-threshold`, and update `DEDUP_SIMILARITY_THRESHOLD` from the result. The current `docs/DEDUP-TUNING.md` is a placeholder run against 10 illustrative pairs — say so explicitly if asked in a demo, don't present it as the real evaluation.

## Deferred (documented, not built)
- **Point-in-polygon `admin_region_id` resolution** (§4.6): true polygon `ST_CONTAINS` against real LGD ward/district boundary geometries still isn't built (no boundary dataset exists). **Update**: `apps/worker-ai-pipeline/src/services/regionResolution.ts` now does real nearest-centroid matching against the seeded `AdminRegion` rows (`scripts/seed-demo-data/source/admin_regions.csv`) instead of leaving everything `"UNRESOLVED"` — a submission inside one of the 3 seeded states now gets a real `admin_region_id` and `state_id`, with real `population`-based `densityClass`. Ceiling: wrong right at a district boundary, and any point outside the seeded states still resolves to "nearest anyway" rather than refusing — documented in code with a `ponytail:` comment. Upgrade path: swap `findNearestRegion`'s body for a BigQuery `ST_CONTAINS` join once real boundary polygons are loaded; callers don't change.
- **Real `AdminRegion.population` → `densityClass`**: defaults to `"peri"` (800m radius) for every submission since population data isn't joined yet. Once boundary resolution lands, wire `densityClass()`'s input from the resolved region's population instead of `null`.
- **GeoCluster centroid tracking**: the dedup candidate filter approximates each issue's location by decoding its geohash cell center (`geohashDecodeCenter`), not a real running-mean centroid on a `GeoCluster` document. Accurate to the ~1.2km×0.6km cell size — fine for the demo cluster, but centroid drift correction (the "weight `location_confidence: low` at 0.3" merge rule) isn't implemented. Upgrade path: maintain a `GeoCluster` doc per issue once that's worth the extra Firestore round-trip.
- **Photo verification (Stage 4, optional 🟡)**: Gemini Vision plausibility check → `fraud_flags` not built this round.
- **No-GPS geocoding**: `extracted_location_text` is captured by categorization, but Maps Geocoding API resolution into `lat`/`lng` isn't wired — a no-coordinates submission currently skips geo-dedup entirely (same-reporter pre-check still applies) and always creates a standalone issue.

## Definition of done (from `phase-4-extraction-dedup.md`)
- [x] Same-citizen duplicates increment `report_count` but not `distinct_reporter_count` — unit tested.
- [x] Two genuinely different issues (dissimilar embeddings) stay separate — unit tested.
- [x] Malformed Gemini output retries once then degrades gracefully — no dropped submission — unit tested.
- [x] Reprocessing the same submission twice does not double-count (idempotent Pub/Sub handler) — unit tested.
- [x] Geohash/Haversine/cosine unit tests pass at boundary values.
- [ ] Full seed dataset (~1,500 submissions) processes end-to-end with zero unhandled errors — needs real seed data + a live project.
- [ ] The demo cluster: 12+ submissions across 3 languages collapse into exactly 1 Issue — needs real seed data.
- [ ] Two identical issues 5km apart merge in a rural region but not urban — needs real `densityClass` (see Deferred above).
- [ ] `docs/DEDUP-TUNING.md` contains the full sweep table with P/R/F1 against the real 120-pair set — currently a placeholder run (see step 4 above).
- [ ] A no-GPS submission geocodes from `location_text` and is down-weighted in the centroid — deferred (see above).
