# Phase 3 — manual steps (run these yourself)

All routes, middleware, validation, and unit tests (13 passing, no live GCP needed —
see `apps/api-gateway/src/testUtils/fakeDeps.ts`) are done. These need real credentials:

1. **Enable phone auth** on your Firebase/Identity Platform project (console → Authentication → Sign-in method → Phone), and add test phone numbers for development so OTP delivery isn't flaky during rehearsal.
2. **Get the Web API key** for `FIREBASE_WEB_API_KEY` (console → Project settings → General → Web API Key). This is what `apps/api-gateway/src/lib/identityToolkit.ts` uses to call the Identity Toolkit REST API server-side.
3. **Run the service against a real project**:
   ```bash
   gcloud auth application-default login
   FIREBASE_PROJECT_ID=<project-id> \
   FIREBASE_WEB_API_KEY=<web-api-key> \
   PUBSUB_RAW_SUBMISSIONS_TOPIC=raw-submissions \
   pnpm --filter @jansetu/api-gateway dev
   ```
4. **Manual end-to-end check**:
   ```bash
   curl -X POST localhost:8080/v1/auth/otp/request -H 'content-type: application/json' \
     -d '{"phone":"+91XXXXXXXXXX"}'
   # use the returned request_id + the OTP received on the test phone number
   curl -X POST localhost:8080/v1/auth/otp/verify -H 'content-type: application/json' \
     -d '{"request_id":"...","otp":"..."}'
   # verify the resulting citizen_id doc in Firestore has a hashed, not raw, phone_hash
   curl -X POST localhost:8080/v1/submissions -H 'content-type: application/json' \
     -d '{"channel":"web","text":"test pothole","lat":28.6139,"lng":77.2090}'
   # confirm the submission doc appears in Firestore and a message lands on raw-submissions
   ```

## Deferred (documented, not built)
- **Firestore/Pub/Sub emulator integration test** (Phase 3 task 9): unit tests already cover the same logic against `createInMemoryStore()`/fake Pub/Sub without needing the emulator suite; wiring up `firebase emulators:start` for a true integration test is a reasonable follow-up but wasn't worth the setup time this pass.
- **In-memory fallback**: if `FIREBASE_PROJECT_ID` isn't set, there is currently no automatic fallback to `createInMemoryStore()` in `deps.ts` — `createRealDeps()` always talks to real Firebase/GCP. Local dev without credentials should use the emulator suite or `pnpm --filter @jansetu/api-gateway test`.

## Definition of done (from `phase-3-core-backend-ingestion.md`)
- [x] `POST /submissions` with a valid payload returns `202` with a real `submission_id` — verified via unit test; live Firestore verification is step 4 above.
- [x] `POST /submissions` missing required content returns `400 VALIDATION_ERROR`.
- [x] The 11th submission from the same citizen within an hour returns `429`.
- [ ] `POST /auth/otp/verify` with a valid OTP returns a usable JWT, hashed phone in the `Citizen` doc — logic verified via unit test with a fake OTP provider; live verification needs step 1-4 above.
- [x] All tests in task 8 pass in CI (13/13).
