# Phase 3 of 9: Core Backend — Ingestion, Auth & Validation

## Header
- **Goal (done = ):** A citizen can hit `POST /submissions` on the real deployed `api-gateway` and get a `202` with a real `submission_id`, backed by real OTP auth, validation, and rate limiting. The AI pipeline isn't wired yet (Phase 4) — submissions land in Firestore with `status: "queued"` and sit there.
- **Preconditions:** Phase 1 (deployed skeleton), Phase 2 (Firestore schema + rules).
- **Specs implemented:** `API_SPEC.md` §1-2, `SECURITY_PRIVACY.md` §1 & §4, `DATA_MODEL.md` (`Citizen`, `Submission`).

## Task breakdown
1. `apps/api-gateway/src/routes/auth.ts`: implement `POST /auth/otp/request` — accepts `{phone}`, initiates Firebase Auth's phone-auth flow, returns `{request_id}`. Validate `phone` against E.164 format with Zod; return `400 VALIDATION_ERROR` on failure.
2. `apps/api-gateway/src/routes/auth.ts`: implement `POST /auth/otp/verify` — accepts `{request_id, otp}`, confirms with Firebase Auth, creates/looks up the `Citizen` doc (`citizen_id` = Firebase UID, `phone_hash` = SHA-256 of the phone number — the raw number is never stored), returns `{citizen_token, citizen_id}`.
3. `apps/api-gateway/src/middleware/auth.ts`: JWT verification middleware — validates the Firebase-issued token and attaches `request.citizen_id` (officer/admin claim handling is stubbed here, completed in Phase 7).
4. `apps/api-gateway/src/middleware/rateLimiter.ts`: per-citizen (10/hour) and per-IP-for-anonymous (3/hour) limits per `API_SPEC.md` §2, using `@fastify/rate-limit` backed by a `rateLimits/{key}` Firestore doc with a rolling counter (sufficient at hackathon scale).
5. `apps/api-gateway/src/routes/submissions.ts`: implement `POST /submissions` — Zod validates `{channel, text?, audio_url?, photo_url?, lat?, lng?}`. On success: write a `Submission` doc with `status: "queued"`, publish to the `raw-submissions` Pub/Sub topic, return `202 {submission_id, status: "queued"}`.
6. Error handling for task 5: missing all of `text`/`audio_url`/`photo_url` → `400 VALIDATION_ERROR`. `lat`/`lng` present but outside India's bounding box → still accepted with `location_confidence: "low"` (per `EDGE_CASES.md` #3 — flag, don't block). Pub/Sub publish failure → still return `202` (the Firestore write already succeeded), log the error, enqueue a retry — per `EDGE_CASES.md` #18's "citizen never blocked by AI availability."
7. `apps/api-gateway/src/routes/submissions.ts`: implement `GET /submissions/{submission_id}` — owner-only (matches `request.citizen_id`) or officer role.
8. Unit tests (`apps/api-gateway/src/routes/submissions.test.ts`): `"POST /submissions with valid text returns 202 and a submission_id"`, `"POST /submissions with no text/audio/photo returns 400 VALIDATION_ERROR"`, `"POST /submissions from a citizen over their hourly limit returns 429"`, `"POST /submissions with out-of-bounds lat/lng is accepted with location_confidence low"`.
9. Integration test against the Firestore + Pub/Sub emulators: confirm a submitted doc has the correct shape and the Pub/Sub message is published.

## Real-world engineering concerns
- **Rate limiting shouldn't be a dead end:** a `429` should come with a clear retry-after message, not a silent failure — this is also where a future emergency-override path would hook in (document it, don't necessarily build it yet).
- **Ingestion latency must be independent of AI pipeline health:** this is precisely why Pub/Sub decouples them (`ARCHITECTURE.md` §3); task 6's failure handling is the concrete enforcement of that decision.

## Definition of done
- [ ] `POST /submissions` with a valid payload returns `202` with a real `submission_id`, verifiable in Firestore.
- [ ] `POST /submissions` missing required content returns `400 VALIDATION_ERROR`.
- [ ] The 11th submission from the same citizen within an hour returns `429`.
- [ ] `POST /auth/otp/verify` with a valid OTP returns a usable JWT, and the `Citizen` doc has a hashed, not raw, phone number.
- [ ] All tests in task 8 pass in CI.

## Risks & blockers
- Firebase phone-auth OTP delivery can be flaky in test environments. **Mitigation:** use Firebase Auth's test phone numbers during development, switch to real numbers only for the final demo rehearsal.

## Time budget
**2 days.** If it runs long, cut: build rate limiting as an in-memory counter instead of Firestore-backed (fine for a single-instance demo — document it as a known scaling gap in `DEPLOYMENT.md`'s future-work notes). Do **not** cut: input validation or the citizen-never-blocked-by-Pub/Sub-failure behavior — both are directly probed by `EDGE_CASES.md`.

## Handoff
A real citizen can authenticate and submit a report that lands in Firestore and triggers a Pub/Sub message. Tag `phase-3-done`. Phase 4 can now build a subscriber that consumes those messages. **Phase 6 (frontend) can start in parallel from here** — the API contract is now live, not just documented.
