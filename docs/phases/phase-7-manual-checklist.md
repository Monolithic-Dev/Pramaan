# Phase 7 — manual steps (run these yourself)

The citizen `/report` flow, the officer `/officer` chat panel, i18n (English/Hindi/Tamil,
verified complete via `completeness.test.ts`), browser-native voice STT/TTS, and a
localStorage-backed offline queue are implemented and unit-tested (7/7 web tests, plus
the whole monorepo's 21/21 tasks). See `apps/web/.env.example`. These steps need real
infrastructure/devices:

1. **Run against a real backend**:
   ```bash
   VITE_API_BASE_URL=https://<your-api-gateway-url>/v1 pnpm --filter @pramaan/web dev
   ```
2. **Real officer auth**: the officer login screen takes a pasted Bearer JWT — get one by completing Phase 3's OTP-equivalent for officers (Identity Platform SSO isn't wired anywhere yet, frontend included) or by minting a test JWT with `role`/`region_id`/`country_code` claims via the Firebase Admin SDK for manual testing.
3. **Device testing** (per the phase doc's acceptance criteria — none of this can be verified from a sandbox):
   - Voice recording on Android Chrome and iOS Safari (Web Speech API's `webkitSpeechRecognition` is Chrome/Android-only — iOS Safari has no equivalent; `report.voiceUnsupported` covers this but iOS citizens currently have **no working voice path**, only typing).
   - Chrome DevTools slow-3G throttling on the full citizen flow.
   - Lighthouse accessibility audit (target ≥ 90) on `/report`.
   - 200% browser zoom.
   - Time an actual first-time user completing a report (target: under 60 seconds).
4. **Offline demo**: airplane mode → submit → airplane mode off → confirm exactly one record is created (the `online` event listener in `useOfflineQueue.ts` handles this; verify no duplicate from a race between the listener and a manual retry).

## Deferred (documented, not built)
- **Photo/audio upload**: `Submission.photo_url`/`raw_audio_url` expect pre-uploaded Cloud Storage URLs, but no upload endpoint exists anywhere in the backend (Phases 1-6 never built one). The citizen flow currently ships **voice-to-text only** (browser STT transcribes to `text`, no audio blob is ever uploaded) and has no photo capture UI. Building this needs: a signed-upload endpoint in `api-gateway` (or direct signed-URL-from-client to GCS), then wiring `<input type="file">` / `MediaRecorder` in the frontend.
- **Map panel with clustering (§7.3)**: replaced with a placeholder. `TECH_STACK_AND_REPO.md` specifies Google Maps Platform, which needs an API key nobody has provided yet; a clustering library (e.g. `supercluster`) is a follow-up dependency once real map rendering exists. The chat-only interface is the "load-bearing fallback" senior-frontend's skill doc names explicitly, so this isn't a regression, just not started.
- **Offline PWA service worker/manifest**: no `vite-plugin-pwa`, no installable-app manifest, no true Background Sync API registration. The current offline queue (`useOfflineQueue.ts`) replays on the browser's `online` event while the tab is open — it demos the "airplane mode" scenario correctly but doesn't survive the tab being closed while offline, and doesn't make the app installable.
- **Issue detail view (§7.5)**: merged-submissions list (original language + translation side by side), photo/timeline view, verify/dispute action buttons. Needs the photo-upload gap closed first to be meaningful.
- **Impact loop UI (§7.6)**: officer mark-complete button, citizen confirmation prompt. `POST /projects/{id}/mark-complete` and `/confirm-resolution` don't exist in the backend yet either (Phase 8 territory per the roadmap).
- **Real Identity Platform SSO**: officer login is a dev-only "paste a JWT" form.
- **Citation click-through**: citations aren't rendered as clickable inline superscripts yet — `AgentChat.tsx` shows the final answer text only; the `citation` SSE event is received but not yet surfaced in the UI.
- **Emergency-override button**: `officer.emergencyOverride` i18n key exists but no UI wires it to `POST /v1/issues/{id}/emergency-override` (built in Phase 5) yet.

## Definition of done (from `phase-7-frontend.md`)
- [x] Language selector shown first, before consent or location — implemented (`ReportPage.tsx` step machine).
- [x] Consent notice shown before location is requested — implemented.
- [x] Big voice button as the primary action, typing secondary — implemented via `VoiceRecorder.tsx`.
- [x] Confirmation with tracking ID and spoken read-back — implemented via `useSpeechSynthesis`.
- [x] All 3 currently-supported languages (English, Hindi, Tamil) render, i18n completeness enforced by a test — implemented; Bengali isn't added (not yet in `language-coverage.md`, would need STT/Translation/fixture work per `localization-voice-ux` first).
- [x] Tool-call chips appear in the chat before the response text streams — implemented, same guarantee Phase 6's backend already enforces (chips render as `tool_call`/`tool_result` SSE events arrive, before `token`).
- [x] A refusal renders as an informational card, not an error — implemented.
- [x] Synthetic-data badge component exists (`DataOriginBadge.tsx`) — not yet wired into a view that displays `InvestmentRecord` data (no such view built this round).
- [ ] Citizen report submitted in under 60 seconds by a first-time user — needs a human timing test (step 3 above).
- [ ] Voice recording works on Android Chrome and iOS Safari — iOS gap noted above.
- [ ] Offline submit → reconnect → exactly one record — logic implemented, needs a real device/browser test (step 4 above).
- [ ] Map with ~500 issues loads under 3s — no map built yet.
- [ ] Lighthouse accessibility ≥ 90 — needs a real Lighthouse run (step 3 above).
