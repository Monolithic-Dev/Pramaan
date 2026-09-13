# Phase 5 of 9: AI Pipeline II — Prioritization Engine & Grounded Generation

## Header
- **Goal (done = ):** Every open `Issue` gets a `PriorityScore` with a visible breakdown, and the top-ranked ones per region get a Gemini-generated, numerically-grounded `Project` brief that passes a hallucination consistency check.
- **Preconditions:** Phase 4 (Issues exist), Phase 2 (BigQuery `infra_index`/`investment_record` populated).
- **Specs implemented:** `AI_PIPELINE.md` Stages 5-6, `DATA_MODEL.md` (`PriorityScore`, `Project`).

## Task breakdown
1. `apps/worker-ai-pipeline/src/scoring/formula.ts`: `computeCompositeScore({demandScore, vulnerabilityScore, gapScore, duplicationPenalty})` — implements `0.35*demand + 0.25*vulnerability + 0.25*gap - 0.15*duplication` exactly as in `AI_PIPELINE.md` Stage 5, with the weights as named exported constants (tunable without touching the function body).
2. `apps/worker-ai-pipeline/src/scoring/demandScore.ts`: `computeDemandScore(reportCount)` — log-scaled normalization, clamped to [0,1], preventing one viral issue from dominating the ranking.
3. `apps/worker-ai-pipeline/src/scoring/bigqueryJoins.ts`: `getVulnerabilityScore(geoClusterId)` and `getGapScore(geoClusterId, category)` — SQL against `infra_index`/`investment_record`, joined on `region_id`. Missing rows return the documented fallback (state-level average per `EDGE_CASES.md` #7; `unverified` flag with penalty 0 per `EDGE_CASES.md` #8) rather than throwing.
4. `apps/worker-ai-pipeline/src/scoring/index.ts`: `scoreIssue(issue)` orchestrates tasks 1-3, writes a `PriorityScore` doc with `model_version: "formula-v1"`.
5. `apps/worker-ai-pipeline/src/scoring/scheduler.ts`: `POST /jobs/rescore`, triggered by Cloud Scheduler every 15 minutes (`gcloud scheduler jobs create http`), pulls all `Issue`s with `status` in (`open`, `verified`) and re-scores them.
6. Minimum-report threshold per `EDGE_CASES.md` #16: `scoreIssue` still stores the score but excludes the `Issue` from public ranking (`GET /priorities`) if `report_count < MIN_REPORTS_FOR_RANKING` (default 3).
7. `apps/worker-ai-pipeline/src/generation/briefGenerator.ts`: `generateBrief(issue, score, groundingData)` — builds the exact grounded prompt from `AI_PIPELINE.md` Stage 6, populating the "Data:" block with real numbers (`report_count`, dates, investment history, estimated population).
8. `apps/worker-ai-pipeline/src/generation/groundingCheck.ts`: `verifyGrounding(generatedText, groundingData)` — extracts every numeric token from the generated text, confirms each also appears in `groundingData`. On mismatch: regenerate once with an explicit "you cited a number not in the data" instruction; if it still fails, fall back to `templateBrief(issue, score, groundingData)` — a non-generated, string-templated summary using the same data.
9. `apps/worker-ai-pipeline/src/generation/index.ts`: `createProjectFromIssue(issue, score)` orchestrates tasks 7-8, writes a `Project` doc with `status: "recommended"`.
10. `apps/worker-ai-pipeline/src/scoring/populationEstimate.ts`: a radius-based density lookup against a population-density reference table (extend `infra_index` with a `population_density` index type, or a small supplementary table) — feeds `PRD.md`'s "estimated impact population" success metric.
11. Unit tests: `formula.test.ts` ("known inputs produce the expected composite score to 3 decimal places", "a higher duplication penalty correctly reduces score"); `bigqueryJoins.test.ts` ("missing InfraIndex row returns the state-average fallback, not an error"); `groundingCheck.test.ts` ("a generated brief containing a number absent from groundingData is rejected and regenerated", "a brief using only provided numbers passes on first try").
12. Integration test: seed one `Issue` with known `report_count`/location, run the full score → generate pipeline, assert `Project.generated_brief` contains the correct `report_count` and no invented statistics.

## Real-world engineering concerns
- **Scoring is intentionally scheduled, not per-submission real-time** (task 5) — a deliberate choice to avoid recomputing expensive BigQuery joins on every single citizen report.
- **The grounding check (task 8) is the single most judge-visible piece of responsible-AI engineering in this system** — treat it as non-negotiable even under time pressure.

## Definition of done
- [ ] Every `Issue` with `report_count >= 3` has a `PriorityScore` with all four component scores visible, not just the composite.
- [ ] A generated `Project.generated_brief` for a test Issue contains only numbers present in its grounding data (verified by `groundingCheck.test.ts`).
- [ ] Simulating a missing `InfraIndex` row produces the documented fallback score, not a thrown error.
- [ ] All tests in tasks 11-12 pass.

## Risks & blockers
- Population-density data (task 10) may be the hardest reference dataset to source cleanly. **Mitigation:** if unavailable in time, fall back to a rough per-district population figure rather than dropping the impact estimate — it's named directly in `PRD.md`'s success metrics.

## Time budget
**3 days.** If it runs long, cut: task 10 down to a static per-district lookup table instead of a radius-based calculation. Do **not** cut: the grounding check (task 8) — it's the direct, specific defense against the most likely judge question ("how do you know the AI isn't making this up").

## Handoff
`Issue`s are scored explainably and the top-ranked ones have grounded, hallucination-checked briefs. Tag `phase-5-done`. Phase 7's dashboard can now display real, trustworthy rankings instead of placeholder data.
