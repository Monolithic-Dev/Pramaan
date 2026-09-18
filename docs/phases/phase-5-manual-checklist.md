# Phase 5 — manual steps (run these yourself)

**Bug fixed post-merge**: both `apps/worker-ai-pipeline/src/lib/bigquery.ts` and
`apps/api-gateway/src/lib/bigquery.ts` were querying `admin_regions` from the
`jansetu_analytics` dataset, but `infra/gcp/setup.sh` and
`scripts/seed-demo-data/generateReferenceData.ts` both load it into
`jansetu_reference` (a deliberate separate dataset for master/reference data
vs. per-run analytics tables). Every `getAncestryChain` call — used by
scoring's vulnerability fallback chain, the agent's scope guard, and region
resolution — would have 404'd against a real project. Fixed by querying
`admin_regions` from `jansetu_reference` in both clients; nothing else changes.

The scoring formula, BigQuery reference-data joins, batch runner, and score-breakdown
endpoint are implemented and unit-tested (19/19 worker tests, 29/29 api-gateway tests,
including the golden-value test reproducing `AI_PIPELINE.md`'s worked example exactly).
See `apps/worker-ai-pipeline/.env.example`. These steps need real credentials/data:

1. **Run the batch job against a real project**:
   ```bash
   gcloud auth application-default login
   GCP_PROJECT_ID=<project-id> pnpm --filter @jansetu/worker-ai-pipeline dev
   curl -X POST localhost:8081/jobs/score
   ```
2. **Wire up Cloud Scheduler** to hit `POST /jobs/score` on the deployed Cloud Run service every 15 minutes (§5.4).
3. **Manual verification**: confirm a `priorityScores/{id}` doc appears in Firestore and a matching row lands in BigQuery's `jansetu_analytics.priority_score_history` (dual-write: Firestore for fast `GET /issues/{id}/score` reads, BigQuery for analytics history per `ARCHITECTURE.md`'s storage split).
4. **Screenshot the "we don't double-fund" demo moment** (acceptance criteria): score two equivalent issues, one in a ward with a recent matching `InvestmentRecord`, one without — confirm the funded one ranks measurably lower via `duplication_penalty`.

## Deferred (documented, not built)
- **Real point-in-polygon `admin_region_id` resolution**: true polygon boundaries still aren't built (see the Phase 4 checklist's "Update"). **Since region resolution now does real nearest-centroid matching, issues in the 3 seeded states get a real `admin_region_id`/ancestry chain**, so scoring's vulnerability/gap/duplication fallback-chain logic now has real data to resolve against for those regions instead of always hitting the "no resolved region" path — verify this by running a batch score against seeded submissions inside e.g. `dl-central-delhi` and confirming `vulnerability_score` comes from a real `InfraIndex` row, not the neutral-midpoint fallback.
- **`CountryProfile`-sourced weights**: `docs/phases/phase-5-scoring.md` §5.1 calls for weights on `CountryProfile`, but that entity (shared-types) has no weights field yet. Using env vars (`SCORE_WEIGHT_*`) instead gets most of the "two-line change, not a refactor" benefit without another schema migration. `getCountryProfile(countryCode)` now exists (`packages/shared-types/src/countryProfiles.ts`, added for Phase 8's cross-border work) for per-country lookups generally, but it doesn't carry a `weights` field yet — add one there and read from it when a real second country's scoring weights need to differ from India's.
- **`GET /priorities`**: still deferred — ranking/listing is a dashboard concern better served by the agent's `get_priority_scores` tool (Phase 6) than a bespoke endpoint.
- **`estimated_impact_population` (§5.6)**: **implemented** (post-merge, once real region resolution existed to feed it) — `PriorityScore.estimated_impact_population` is now computed as the resolved region's population scaled by a per-category coverage-fraction heuristic (`apps/worker-ai-pipeline/src/services/scoring.ts`'s `IMPACT_COVERAGE_FRACTION` table), since no sub-district population-density data exists to do a literal radius-based catchment calculation. Surfaced in the officer UI's `ScoreBreakdown` component. The coverage fractions are a documented judgment call, not derived from a real service-radius dataset — worth saying so explicitly if a judge asks how the number was derived.
- **Full RBAC on `POST /issues/{id}/emergency-override`**: gated on "any officer role" today; the spec's "role >= collector" hierarchy and jurisdiction/region-scope enforcement are Phase 7 work, same as the rest of officer RBAC.
- **`AuditLogEntry` as a proper shared-types entity**: currently a local interface in `apps/api-gateway/src/store/types.ts`. `docs/SECURITY_PRIVACY.md` §6 also calls for mirroring audit entries into a BigQuery table and an append-only Cloud Logging sink — only the Firestore write exists today.
- **Real threshold/impact history**: `impact_efficacy` is always `null` (no `ImpactRecord` writer exists until Phase 8) — `effFactor` is always exactly `1.0` in practice right now, which is the correct default, not a bug.

## Definition of done (from `phase-5-scoring.md`)
- [x] Golden-value unit test: `demand=0.71, vuln=0.55, gap=0.63, dup=0.10, efficacy=null` → `base=0.638`, `composite=0.628` (±0.001) — passes.
- [x] Every `composite_score` produced is within `[0, 1]` — enforced by `clamp01`, unit tested at extremes.
- [x] Issues with `distinct_reporter_count < 3` are excluded from scoring unless `emergency_override` — unit tested.
- [x] Missing ward-level InfraIndex produces a district-level fallback **and** a populated `data_fallbacks` entry — unit tested.
- [x] Missing InvestmentRecord yields `duplication_penalty: 0` with an `unverified` flag — unit tested.
- [x] `GET /issues/{id}/score` returns every component and the weights used — unit tested.
- [x] Two consecutive runs on unchanged data produce identical scores — unit tested.
- [x] The batch runner is the only writer of `is_canonical: true` scores — enforced structurally (no simulation path exists yet; Phase 6 must not add one that writes `is_canonical: true`).
- [ ] An issue in a ward with recent matching investment ranks measurably below an equivalent unfunded issue — needs real data (step 4 above).
- [ ] Setting `emergency_override` on a 1-report issue makes it appear within one batch cycle — needs a live deploy + Cloud Scheduler (steps 1-2 above).
- [ ] Full-dataset batch run completes in under 2 minutes — needs real seed data at scale.
