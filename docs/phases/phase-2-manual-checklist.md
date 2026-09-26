# Phase 2 — manual steps (run these yourself)

Everything scaffoldable from the repo is done: `shared-types` entities + shape-fixture test, `firestore.rules`/`firestore.indexes.json`, BigQuery table schemas, and the seed scripts. These need your GCP credentials:

1. **Firestore collections** (confirms the service account can write):
   ```bash
   gcloud auth application-default login
   GOOGLE_CLOUD_PROJECT=<project-id> pnpm --filter @pramaan/scripts init-firestore-collections
   ```
2. **Deploy Firestore rules + indexes**:
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes --project <project-id>
   ```
3. **BigQuery dataset/tables + Cloud Storage buckets** (idempotent, extends Phase 1's script):
   ```bash
   infra/gcp/setup.sh <project-id>
   ```
4. **Load reference data** (clearly-labeled realistic sample data — see `scripts/seed-demo-data/source/*.csv` — not live government feeds, per `docs/PRD.md` §8):
   ```bash
   GOOGLE_CLOUD_PROJECT=<project-id> pnpm --filter @pramaan/scripts generate-reference-data
   ```
5. **Verify**:
   ```bash
   bq query --use_legacy_sql=false 'SELECT * FROM `pramaan_analytics.infra_index` LIMIT 5'
   bq query --use_legacy_sql=false 'SELECT * FROM `pramaan_analytics.investment_record` LIMIT 5'
   gcloud storage buckets describe gs://pramaan-audio --format="value(lifecycle)"
   ```

## Definition of done (from `phase-2-data-layer.md`)
- [x] `packages/shared-types` builds with zero type errors and its shape-fixture test passes (11/11 tests).
- [ ] Firestore collections exist and `firestore.rules` denies an unauthenticated client read (step 1-2 above).
- [ ] `bq query` against `infra_index` and `investment_record` returns rows for all 3 seeded states (step 4-5 above).
- [ ] Cloud Storage buckets exist with the 90-day lifecycle rule on `pramaan-audio` (step 3, 5 above).

## Note on reference data scope
Source CSVs cover 3 states (Delhi, Maharashtra, Karnataka) × 2 districts each, matching the PRD's "3+ states" demo requirement, using realistic-but-synthetic values — not a live public dataset pull. This matches `docs/PRD.md` §8's explicit assumption that `InvestmentRecord` and infra/vulnerability indices are sample/approximated data for the hackathon MVP, not a production live feed.
