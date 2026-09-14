# Phase 2 of 10: Data Layer

> **⚠️ Migration needed before Phase 3 starts (added 15 Sep 2026).** `DATA_MODEL.md`, `API_SPEC.md`, `AI_PIPELINE.md`, and `ARCHITECTURE.md` were corrected after this phase was implemented (PR #2). The schema actually merged here — `GeoCluster` and `region_id` on `InfraIndex`/`InvestmentRecord` in [packages/shared-types/src/index.ts](../../packages/shared-types/src/index.ts) — matches the **old, superseded** data model, which keys reference data to a dynamically-created `GeoCluster` instead of a stable `AdminRegion`. Since a `GeoCluster` doesn't exist until a citizen reports an issue, every `InfraIndex`/`InvestmentRecord` join silently misses, and `vulnerability_score`/`gap_score` fall back to defaults on every issue.
>
> Concretely, before Phase 3 (ingestion) is safe to build on:
> 1. Add `AdminRegion` and `CountryProfile` to `packages/shared-types/src/index.ts` per the corrected `DATA_MODEL.md`.
> 2. Re-key `InfraIndex.region_id` and `InvestmentRecord.region_id` to `AdminRegion.region_id` (LGD codes), not `GeoCluster.cluster_id`.
> 3. Re-load `infra_index`/`investment_record` BigQuery tables against real LGD-coded admin regions (see the corrected Phase 2 deliverables below — reference for the target shape, not a re-run of already-completed scaffolding work).
> 4. Add `idempotency_key` to `Submission`, `distinct_reporter_count`/`embedding`/`geohash` to `Issue` — Phase 4 (extraction & dedup) needs these and they don't exist in the merged shared-types yet.
>
> This is a schema fix, not a rewrite — the Firestore rules, BigQuery table scaffolding, and seed-script structure already merged in PR #2 stay valid. What follows below is kept as-written as a record of what was actually built in that PR; treat it as historical, and use the corrected `DATA_MODEL.md` as the target shape going forward.

## Header
- **Goal (done = ):** Firestore collections, BigQuery datasets/tables, and Cloud Storage buckets exist matching `DATA_MODEL.md` exactly, populated with real reference data (`InfraIndex`, `InvestmentRecord`), with a reproducible seed script skeleton ready for Phase 9's full synthetic dataset.
- **Preconditions:** Phase 1 complete (Firestore DB exists, GCP APIs enabled).
- **Specs implemented:** `DATA_MODEL.md` (all sections), `TESTING.md` §4 (synthetic dataset — skeleton only here, full run happens in Phase 9).

## Task breakdown
1. In `packages/shared-types/src/index.ts`, define TypeScript interfaces for every entity in `DATA_MODEL.md`: `Citizen`, `Submission`, `Issue`, `GeoCluster`, `InfraIndex`, `InvestmentRecord`, `PriorityScore`, `Project`, `ImpactRecord`, `OfficerUser` — field names and types matching the JSON examples exactly.
2. Create Firestore collections `citizens`, `submissions`, `issues`, `geoClusters`, `officerUsers` via a one-time `scripts/init-firestore-collections.ts` (writes and deletes a dummy doc to each, confirming security rules allow service-account writes).
3. Write `firestore.rules`: deny all client-direct reads/writes by default. All access goes through `api-gateway`/`worker-ai-pipeline` using service-account credentials, never the client SDK directly. Deploy: `firebase deploy --only firestore:rules`.
4. Add the composite index needed for `API_SPEC.md`'s `GET /issues?region=&status=&category=` — in `firestore.indexes.json`, add a composite index on (`geo_cluster_id`, `status`, `category`). Deploy: `firebase deploy --only firestore:indexes`.
5. Create the BigQuery dataset: `bq mk --dataset --location=asia-south1 jansetu_analytics`. Create tables `infra_index`, `investment_record`, `priority_score_history` via `bq mk --table` with JSON schema files in `infra/gcp/bigquery-schemas/`, matching `DATA_MODEL.md`'s field names.
6. Source real `InfraIndex` reference data: pull a public infra/demographic dataset for at least 3 states' worth of districts, transform to the `infra_index` schema, load via `bq load`.
7. Build a realistic (clearly labeled as sample) `InvestmentRecord` dataset covering the same states/districts across 2 fiscal years, load via `bq load`.
8. Create Cloud Storage buckets: `jansetu-media` (photos, resolution images) and `jansetu-audio` (voice recordings). Set a lifecycle rule on `jansetu-audio` to auto-delete objects older than 90 days, per `SECURITY_PRIVACY.md`'s retention policy.
9. Write `scripts/seed-demo-data/generateReferenceData.ts` — a reproducible script that regenerates the `InfraIndex`/`InvestmentRecord` BigQuery load from source CSVs, so the data pipeline is repeatable, not a one-off manual load.
10. Unit test: a schema-shape test in `packages/shared-types` confirming every interface's fields match a fixture JSON object — this is the guardrail against silent drift from `DATA_MODEL.md`.

## Real-world engineering concerns
- **Schema drift** between `DATA_MODEL.md` (source of truth) and the actual TypeScript interfaces is the most likely silent bug across a multi-service system — task 10's fixture test is the specific defense against it.
- **Deny-by-default Firestore rules** (task 3) is a deliberate production-mindset choice even though it's a bit more setup work up front — worth stating explicitly if a judge asks about data access controls.

## Definition of done
- [ ] All Firestore collections exist and `firestore.rules` denies an unauthenticated client read attempt (verify with a quick test).
- [ ] `bq query` against `infra_index` and `investment_record` returns real rows for all seeded states.
- [ ] `packages/shared-types` builds with zero type errors and its shape-fixture test passes.
- [ ] Cloud Storage buckets exist with the correct lifecycle rule on `jansetu-audio`.

## Risks & blockers
- Public infra/demographic datasets are often inconsistently formatted across states — budget time for cleaning, not just loading. **Mitigation:** pick the states with the cleanest available public data rather than the most narratively interesting ones; the demo narrative can still name real states.

## Time budget
**1 day.** If it runs long, cut: reduce to 2 states instead of 3 for reference data (the pitch can honestly say "designed for N states, seeded with 2 for this demo"). Do **not** cut: the shape-fixture test or the Firestore security rules.

## Handoff
Every entity from `DATA_MODEL.md` has a real, queryable home with real reference data loaded. Tag `phase-2-done`. Phase 3 can now write real Firestore documents that Phase 4 will later read.
