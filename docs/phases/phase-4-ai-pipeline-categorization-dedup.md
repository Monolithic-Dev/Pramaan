# Phase 4 of 9: AI Pipeline I — Normalization, Categorization & Deduplication

## Header
- **Goal (done = ):** Every `Submission` published to `raw-submissions` is automatically normalized, categorized by Gemini, embedded, and merged into an existing or new canonical `Issue` — with no manual step.
- **Preconditions:** Phase 3 (submissions are being published to Pub/Sub).
- **Specs implemented:** `AI_PIPELINE.md` Stages 1-3, `DATA_MODEL.md` (`Issue`, `GeoCluster`), `EDGE_CASES.md` #1, #2, #4, #9.

## Task breakdown
1. `apps/worker-ai-pipeline/src/handlers/pubsubHandler.ts`: `POST /pubsub-push` decodes the Pub/Sub push envelope, extracts `submission_id`, fetches the full `Submission` doc, calls `processSubmission(submission)`.
2. `apps/worker-ai-pipeline/src/pipeline/normalize.ts`: `normalizeSubmission(submission)` — if `audio_url` present, call Cloud Speech-to-Text and write the transcript to `raw_text` if not already set; call Cloud Translation API to populate `translated_text` and `detected_language`.
3. Error handling for task 2: STT confidence below threshold → set `status: "flagged"`, still proceed through the pipeline with the low-confidence transcript (per `EDGE_CASES.md` #1), don't drop it. Translation API failure → retry once with exponential backoff, then fall back to treating `raw_text` as already-canonical and flag `status: "flagged"`.
4. `apps/worker-ai-pipeline/src/pipeline/categorize.ts`: `categorizeSubmission(text)` — calls Gemini with the exact structured-output prompt from `AI_PIPELINE.md` Stage 2, validates the response with a Zod schema (`category`, `subcategory`, `severity_estimate`, `extracted_location_text`, `summary`, `confidence`).
5. Error handling for task 4: malformed JSON → one retry with a stricter system-prompt reminder; still malformed → fall back to `category: "other"`, `confidence: 0`, flag for manual officer categorization — the submission is never dropped (per `EDGE_CASES.md` #9).
6. `apps/worker-ai-pipeline/src/pipeline/embed.ts`: `embedSummary(summary)` — calls Vertex AI Embeddings, returns a vector, held in memory for the current request only (persisted as part of the `Issue`/`GeoCluster` write in task 8).
7. `apps/worker-ai-pipeline/src/pipeline/dedupe.ts`: `findOrCreateIssue(submission, embedding, categorization)` implementing `AI_PIPELINE.md` Stage 3: query `geoClusters` within `DEDUP_RADIUS_METERS` (default 300, named constant in `apps/worker-ai-pipeline/src/config.ts`) and matching `category`; compute cosine similarity against each candidate's stored embedding; if `best_score >= SIMILARITY_THRESHOLD` (default 0.82) → merge; else → create new.
8. `dedupe.ts`: `mergeIntoIssue(issue, submission)` — increments `report_count`, appends `submission_id`, updates `last_reported_at`, recomputes the `GeoCluster` centroid as a running average. `createNewIssue(submission, embedding, categorization)` — writes new `Issue` + `GeoCluster` docs, storing the embedding on the `GeoCluster`.
9. Per `EDGE_CASES.md` #4: before the geo/category candidate query, check if `submission.citizen_id` already has an open `Submission` linked to any `Issue` within a 24h window and matching category — if so, merge directly without the full similarity check (cheaper, more certain — same person reporting twice).
10. Per `EDGE_CASES.md` #2: the categorization prompt (task 4) explicitly instructs Gemini to handle code-mixed input; add at least 3 Hinglish/Tanglish examples to the prompt-regression fixture set from `TESTING.md` §3.
11. `apps/worker-ai-pipeline/src/pipeline/index.ts`: `processSubmission(submission)` orchestrates 2→4→6→7 in order, sets `status: "processed"` on success, wraps everything in a try/catch that sets `status: "flagged"` (never silent failure) on any unhandled error, logging `{submission_id, stage, error}` for observability.
12. Unit tests: `normalize.test.ts` ("low-confidence STT transcript still proceeds and sets status flagged"); `categorize.test.ts` ("malformed Gemini response falls back to category other with confidence 0", "code-mixed Hinglish input returns valid JSON"); `dedupe.test.ts` ("two submissions with cosine similarity 0.9 in the same 100m radius and category merge into one Issue", "two submissions with similarity 0.5 create two separate Issues", "same citizen submitting twice within 24h merges regardless of similarity score").
13. Run the prompt regression test (`TESTING.md` §3): the fixed 20-sample set through `categorizeSubmission`, diffed against expected outputs; fail CI if more than 2 samples drift.

## Real-world engineering concerns
- **Idempotency:** Pub/Sub delivers at-least-once — guard `processSubmission` against double-processing with a status check (`"queued"` → proceed, else no-op).
- **Retry/backoff:** every external call (STT, Translation, Gemini, Embeddings) goes through a shared `withRetry()` utility (`packages/shared-utils/src/withRetry.ts`) — exponential backoff, max 2 retries.
- **Observability:** every stage logs `{submission_id, stage, duration_ms, outcome}` so failures are diagnosable from Cloud Logging without local reproduction.

## Definition of done
- [ ] A test submission with a photo and Hindi voice input ends up as a correctly-categorized `Issue`.
- [ ] Submitting 5 near-duplicate reports within 300m results in exactly 1 `Issue` with `report_count: 5`.
- [ ] A different-category report at the same location creates a second, separate `Issue`.
- [ ] All tests in task 12 pass; the prompt regression suite (task 13) passes with ≤2 drifted samples out of 20.
- [ ] A deliberately malformed Gemini response (simulated in tests) still ends with `status: "processed"` or `"flagged"` — never stuck at `"queued"` or silently dropped.

## Risks & blockers
- The 0.82 similarity threshold is a guess until tuned against real data — budget time specifically for tuning it against the regression fixture set plus hand-written near-duplicate examples.
- Vertex AI Embeddings and Gemini both have rate limits — check quota before Phase 9's load test; request an increase early if the project is new (approval can take a day-plus).

## Time budget
**4 days** — the single most time-critical phase given the judging weight on AI execution. If it runs long, cut: the same-citizen-24h shortcut (task 9) and rely on the general similarity path instead. Do **not** cut: the malformed-response fallback (task 5) or the idempotency guard — these are the difference between a flaky demo and a reliable one.

## Handoff
Raw submissions become deduplicated `Issue`s automatically, with real Gemini calls doing real categorization and real embedding-based merging. Tag `phase-4-done`. Phase 5 can now score and generate briefs for real `Issue` documents instead of test fixtures.
