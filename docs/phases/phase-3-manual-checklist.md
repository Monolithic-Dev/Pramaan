# Phase 3 — manual steps (run these yourself)

All routes, middleware, validation, and unit tests (23 passing, no live GCP needed —
see `apps/api-gateway/src/testUtils/fakeDeps.ts`) are done. See `apps/api-gateway/.env.example`
for the full list of environment variables. These steps need real credentials/accounts:

1. **Enable phone auth** on your Firebase/Identity Platform project (console → Authentication → Sign-in method → Phone), and add test phone numbers for development so OTP delivery isn't flaky during rehearsal.
   **Verified against the real project in `.env`**: `FIREBASE_WEB_API_KEY` and `FIREBASE_PROJECT_ID` are both valid and reachable — `POST /v1/auth/otp/request` returned Identity Toolkit's own `CONFIGURATION_NOT_FOUND` error (not an API-key/auth error), which specifically means the Phone sign-in provider isn't enabled yet. This step is the only thing standing between the current setup and real OTP delivery.
2. **Get the Web API key** for `FIREBASE_WEB_API_KEY` (console → Project settings → General → Web API Key). This is what `apps/api-gateway/src/lib/identityToolkit.ts` uses to call the Identity Toolkit REST API server-side. Already done — see the verification note above.
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
     -H 'idempotency-key: <uuid v4>' \
     -d '{"channel":"web","text":"test pothole","lat":28.6139,"lng":77.2090,"consent_version":"dpdp-notice-v1-en"}'
   # confirm the submission doc appears in Firestore and a message lands on raw-submissions
   ```
5. **WhatsApp/SMS provider account** (Gupshup or Twilio): apply for WhatsApp Business API sandbox access on Day 1 — approval can take a day. Once approved:
   - Point the provider's inbound webhook at `POST /v1/webhooks/whatsapp` and `POST /v1/webhooks/sms`.
   - Replace the placeholder `X-Webhook-Secret` check in `apps/api-gateway/src/routes/webhooks.ts` with the provider's real HMAC signature verification.
   - Map the provider's actual payload shape to the normalized `{from, message_id, text, photo_url, lat, lng, location_text}` shape in `apps/api-gateway/src/schemas/webhooks.ts` — the current shape is a stand-in since no sandbox account exists yet.
   - A publicly reachable URL is required (use the deployed Cloud Run service, not ngrok, so the prod path is exercised).

## Deferred (documented, not built)
- **Real-time voice/STT channel**: `channel: "voice"` is accepted by the schema, but Cloud Speech-to-Text transcription (`raw_audio_url` → `raw_text`) isn't wired yet — needs a GCS upload path and a Speech-to-Text call behind a seam like `identityToolkit.ts`'s pattern.
- **Point-in-polygon `admin_region_id`/`geohash` resolution**: `Submission.geohash`/`resolved_region_id` stay `null` at ingestion; full resolution against the `admin_regions` BigQuery table via `ST_CONTAINS` is explicitly Phase 4.6's job (`docs/phases/phase-4-extraction-dedup.md`).
- **Gemini-based PII pass**: only the regex-based scrub (phone/email/PAN/Aadhaar patterns) runs inline; the Gemini pass that catches names/addresses a regex can't, plus `contains_personal_emergency` routing, is Phase 4 worker territory.
- **Offline PWA queue**: IndexedDB-backed retry-on-reconnect is frontend work (Phase 7).
- **Mock server for the frontend track** (`apps/api-gateway/mocks/`): not built this round — the frontend track can build against the real endpoints implemented so far instead.
- **Firestore/Pub/Sub emulator integration test**: unit tests already cover the same logic against fakes; a true emulator-based integration test remains a nice-to-have.
- **Demo-day rate-limit allowlist**: the CIDR exemption mentioned in `API_SPEC.md` §2 isn't implemented — needed before demo day so judges on one WiFi network don't rate-limit each other.

## Definition of done (from `phase-3-ingestion.md`)
- [x] Idempotency: same key ×N → exactly 1 Firestore doc, N identical `202` responses — unit tested.
- [x] Same key, different body → `409 IDEMPOTENCY_CONFLICT` — unit tested.
- [x] Pub/Sub failure → submission still returns `202`, `status: "deferred"` — implemented in `services/ingestSubmission.ts`, needs a live-Pub/Sub-outage manual check to fully confirm.
- [x] No-GPS submission stores `location_text` with `location_confidence: "low"` — unit tested.
- [x] A submission containing a phone number has it removed from `pii_scrubbed_text`, retained in `raw_text` — unit tested.
- [x] WhatsApp and SMS webhooks produce schema-identical `Submission` records via the same internal path — unit tested.
- [ ] `POST /v1/submissions` p95 latency < 2s under a 100 req/min burst — needs a load test against a deployed instance.
- [ ] Hindi voice note → correct `detected_language`/`translated_text`, raw audio deleted — deferred (see above).
- [ ] Photo upload strips EXIF GPS — not yet implemented.
- [ ] Offline → submit → online produces exactly one record — deferred to Phase 7 (frontend).
