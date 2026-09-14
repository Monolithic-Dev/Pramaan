# Phase 3 of 10: Multichannel Ingestion

**Days 3-5 · Track A · Blocks Phase 4 · Unblocks Track B mocks**

## Objective
Four channels normalised to one `Submission` schema, idempotent, PII-minimised, and acknowledged in under 2 seconds regardless of what the AI pipeline is doing.

This phase also resolves the "usable on a feature phone" claim in `PRD.md` §2 — no channel before this phase actually ran on one.

## Prerequisites
Phases 1, 2 complete (including the Phase 2 migration note — `AdminRegion`/`CountryProfile`/`idempotency_key` must exist in `shared-types` before this phase starts).

## Reference docs
`API_SPEC.md` §2, §9 · `AI_PIPELINE.md` Stage 1 · `SECURITY_PRIVACY.md` §2 · `EDGE_CASES.md` #1, #2, #3, #14, #19

---

## Deliverables

### 3.1 Ingestion Gateway (`apps/api-gateway`)
`POST /v1/submissions`. The contract that matters: **respond in under 2s, always.**

Order of operations:
1. Validate body (Zod) and `Idempotency-Key` header.
2. Idempotency check — key seen in 24h? Return the original `202` body verbatim. Same key, different payload → `409 IDEMPOTENCY_CONFLICT`.
3. Rate-limit check.
4. Resolve location: `lat/lng` → geohash6 + `admin_region_id` via point-in-polygon. No coordinates → store `location_text`, mark `location_confidence: "low"`, defer geocoding to the worker.
5. Write `Submission` (`status: "queued"`), raw text into the restricted subcollection.
6. Write `ConsentRecord`.
7. Publish to `raw-submissions`.
8. Return `202`.

If step 7 fails: write `status: "deferred"` and **still return 202**. The citizen is never blocked by infrastructure they cannot see (`EDGE_CASES.md` #18).

### 3.2 Idempotency (`EDGE_CASES.md` #14)
Client generates a UUID v4 per submission attempt, reused across retries. Server stores `idempotency_key` with a 24h TTL. This is what makes the offline PWA queue safe — without it, a flaky connection produces phantom demand, which corrupts the exact number your whole system is built on.

### 3.3 Voice → Speech-to-Text
In-app recorded audio → GCS → Speech-to-Text with auto language detection over the profile's `official_languages`.

- Confidence < 0.7 → flag transcript for officer review, and offer text-retype in the UI (`EDGE_CASES.md` #1).
- Raw audio deleted after successful transcription; transcript retained (`SECURITY_PRIVACY.md` §2).

### 3.4 Translation
Detected language → `canonical_working_language`. Code-mixed input (Hinglish, Tanglish) is the common real case, not the edge case — include code-mixed examples in the test fixtures from the start (`EDGE_CASES.md` #2).

Store `raw_text` (restricted), `translated_text`, and `pii_scrubbed_text`.

### 3.5 PII scrubbing (`EDGE_CASES.md` #19)
Before anything reaches BigQuery: regex + Gemini pass over the translated text to remove phone numbers, names, ID numbers, and addresses not needed for location. If `contains_personal_emergency` is detected, route to a separate review flow and **do not** publish to the infra pipeline.

EXIF geodata stripped from photos on ingest, except the `lat`/`lng` the citizen explicitly consented to share.

### 3.6 WhatsApp webhook
`POST /v1/webhooks/whatsapp` via Gupshup or Twilio. Verify the signature. Map the payload to `Submission` and call the same internal ingestion path — not a parallel implementation, or the two drift and only one gets tested.

Conversational flow: greeting → issue description → location request (share-location button or text) → confirmation in the citizen's language.

### 3.7 SMS inbound
Same provider account, same webhook handler shape, roughly 3 hours of work. Format: free text, with a reply asking for a landmark if no location is inferable.

This is what makes the "no smartphone, no app, no literacy, no English" claim in the PRD actually true. Without it, that claim is contradicted by every channel you shipped and a judge reading the PRD against the build plan will notice.

### 3.8 Offline queue (PWA)
Service worker queues submissions in IndexedDB when offline, replays with the original idempotency key on reconnect (`EDGE_CASES.md` #14). This is a genuine low-connectivity feature and it demos in ten seconds: turn on airplane mode, submit, turn it off, watch it sync.

### 3.9 Mock server for Track B
`apps/api-gateway/mocks/` — every Phase 3-6 endpoint returning fixture data matching `API_SPEC.md`. Ship this on **Day 4** so the frontend never waits on the backend.

---

## Acceptance criteria

- [ ] `POST /v1/submissions` p95 latency **< 2s** under a 100 req/min burst
- [ ] Same idempotency key ×5 → exactly 1 Firestore document, 5 identical `202` responses
- [ ] Same key with a different body → `409 IDEMPOTENCY_CONFLICT`
- [ ] Pub/Sub disabled → submission still returns `202`, lands `status: "deferred"`
- [ ] A Hindi voice note produces correct `detected_language`, `translated_text`, and deletes the raw audio
- [ ] A Hinglish text submission translates sensibly (manually verified against 5 samples)
- [ ] No-GPS submission stores `location_text` with `location_confidence: "low"`
- [ ] WhatsApp and SMS webhooks both produce schema-identical `Submission` records to the web form
- [ ] A submission containing a phone number has it removed from `pii_scrubbed_text` and retained in the restricted `raw_text`
- [ ] Photo upload strips EXIF GPS (verify with `exiftool`)
- [ ] Offline → submit → online produces exactly one record
- [ ] Mock server serves every endpoint in `API_SPEC.md`

## Definition of done
Four channels, one schema, no duplicates under retry, and the citizen always gets an answer in under two seconds.

## Traps
- Twilio/Gupshup webhooks need a publicly reachable URL. Use the deployed Cloud Run service, not ngrok — you want the prod path exercised.
- WhatsApp Business API sandbox approval can take a day. **Start the application on Day 1**, not Day 3.
- Speech-to-Text auto-detect needs a candidate language list; unconstrained detection across Indian languages is unreliable. Constrain to the profile's `official_languages`.
- Do not put the PII scrub on the citizen's critical path if it costs a Gemini call — run the regex pass inline and the Gemini pass in the worker.

## Handoff
A real citizen can authenticate and submit a report on any of four channels; it lands in Firestore and triggers a Pub/Sub message. Tag `phase-3-done`. Phase 4 can now build a subscriber that consumes those messages. **Phase 7 (frontend) can build against the mock server from here** — it does not need to wait for Phase 4-6.
