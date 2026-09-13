# Phase 6 of 9: Frontend — Citizen Report Flow

## Header
- **Goal (done = ):** A citizen can open `apps/web`'s `/report` route on a phone, submit a report by typing, recording voice, or attaching a photo, in at least 3 languages, and see a confirmation — fully wired to the real Phase 3 API.
- **Preconditions:** Phase 3 (`POST /submissions`, `POST /auth/otp/*` live). Can start in parallel with Phase 4/5 once Phase 3 is tagged done.
- **Specs implemented:** `PRD.md` §6.1 & §6.7, `API_SPEC.md` §1-2.

## Task breakdown
1. `apps/web/src/routes/report/ReportPage.tsx`: main citizen flow screen — language selector (options from a `SUPPORTED_LANGUAGES` constant in `packages/shared-utils`), input-mode toggle (text / voice / photo-with-caption).
2. `apps/web/src/routes/report/components/TextInput.tsx`: textarea with client-side Zod validation mirroring the backend schema (required if no audio/photo attached).
3. `apps/web/src/routes/report/components/VoiceRecorder.tsx`: uses the browser `MediaRecorder` API, uploads the resulting blob to Cloud Storage via a signed-URL flow. Add `POST /uploads/audio-url` to `apps/api-gateway` (an addendum to `API_SPEC.md`) since direct client-to-Storage writes are disallowed per `SECURITY_PRIVACY.md` §1.
4. `apps/web/src/routes/report/components/PhotoAttach.tsx`: file input with `capture="environment"`, client-side image compression before upload (keeps upload fast on poor connectivity), same signed-URL pattern as task 3 for `jansetu-media`.
5. `apps/web/src/routes/report/components/LocationPicker.tsx`: attempts `navigator.geolocation.getCurrentPosition()`; on denial/failure, falls back to a text field for landmark/ward description (per `EDGE_CASES.md` #3), with a short explanation of why it's asking.
6. `apps/web/src/routes/report/hooks/useSubmitReport.ts`: assembles the payload, calls `POST /submissions`, handles `429` and `400` from `API_SPEC.md` §7 with user-facing messages in the selected language — never raw error codes.
7. `apps/web/src/routes/report/ConfirmationScreen.tsx`: shows the `submission_id` and a plain-language confirmation, read aloud via Cloud Text-to-Speech (or the Web Speech API as a lighter fallback) for low-literacy users.
8. Offline handling per `EDGE_CASES.md` #14: a service worker (`apps/web/src/sw.ts`) queues a failed `POST /submissions` call in IndexedDB and retries on reconnect, with a client-generated `Idempotency-Key` header. Extend `api-gateway`'s `POST /submissions` handler (from Phase 3) to check this key against a short-lived Firestore dedup-key collection before writing, preventing double-submission on retry.
9. All static UI text lives in `apps/web/src/i18n/{en,hi,ta}.json` (or the 3 chosen demo languages) — no hardcoded English strings in components.
10. Unit tests (Vitest + React Testing Library): `"ReportPage renders the language selector with configured languages"`, `"TextInput shows a validation error when submitted empty with no audio/photo"`, `"useSubmitReport surfaces a friendly message on 429"`.
11. E2E test (Playwright): `"citizen can submit a text report in Hindi and see a confirmation screen"`.

## Real-world engineering concerns
- **Poor connectivity is the default assumption, not an edge case** — every network call needs a loading/retry state, not just a happy-path spinner.
- **Client-side validation mirrors, never replaces, server-side validation** (task 2) — the server remains the source of truth.

## Definition of done
- [ ] A citizen can complete the full report flow (text, voice, and photo variants) against the real deployed `api-gateway` and receive a real `submission_id`.
- [ ] Switching the language selector changes every visible string, including confirmation and error messages.
- [ ] Submitting while offline queues the report and successfully sends it once connectivity returns, without creating a duplicate (verified in Firestore).
- [ ] All tests in tasks 10-11 pass.

## Risks & blockers
- Browser microphone/camera permission flows differ across mobile browsers. **Mitigation:** test on at least one real Android device early in this phase, not just desktop Chrome — that's the realistic demo device.

## Time budget
**5 days**, running mostly in parallel with Phases 4-5. If it runs long, cut: the offline-queue service worker (task 8) — document it as near-term follow-up and demo on a stable connection instead. Do **not** cut: the multilingual requirement (tasks 1, 9) — it's an explicit judging criterion for this track.

## Handoff
A real, deployed citizen-facing flow exists and produces real submissions. Tag `phase-6-done`. Phase 7 can now build the officer view knowing real data is flowing in from a real UI, not just test scripts.
