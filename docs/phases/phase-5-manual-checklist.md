# Phase 5 — manual steps (run these yourself)

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
- **Real point-in-polygon `admin_region_id` resolution**: still blocked on the same gap as Phase 4 — every `Issue.admin_region_id` is `null` until that lands, so every score currently falls into the "no resolved region" fallback path (vulnerability/gap/duplication all disclosed as `unverified`/`none`). The formula, fallback-chain logic, and BigQuery client are all real and tested against fake ancestry data — only the resolver that fills in `admin_region_id` is missing.
- **`CountryProfile`-sourced weights**: `docs/phases/phase-5-scoring.md` §5.1 calls for weights on `CountryProfile`, but that entity (shared-types) has no weights field yet. Using env vars (`SCORE_WEIGHT_*`) instead gets most of the "two-line change, not a refactor" benefit without another schema migration. Add a `weights` field to `CountryProfile` and read from Firestore instead when a real second country profile is on the roadmap.
- **`GET /priorities` and `estimated_impact_population` (§5.6)**: deferred to Phase 6, since ranking/listing is a dashboard concern tied to that phase's agent tools (`query_fused_data`, `get_priority_scores`) — building it now would duplicate work once the agent's read path exists.
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
