# Phases 10-16 — what's built vs. what needs you

All six differentiator features from `docs/README.md` are implemented in `api-gateway` +
`web`, unit-tested (88 api-gateway tests). Deliberate deviations from the feature docs:

| Feature | Built | Deviation / gap |
|---|---|---|
| 1 Early-warning | `GET /forecasts`, `insights/forecasting.ts`, dashed-outline cards in the officer Insights panel | Computed on read from Firestore Issue history (not a scheduled worker job, not persisted): deterministic, so nothing goes stale. No map layer yet (the map itself is still a placeholder). AutoML stretch not attempted. `geo_cluster_id` holds the AdminRegion id. |
| 2 Equity audit | `GET /equity-audit` (state_admin only), bands, n>=5 guard, templated grounded verdict | `avg_days_to_verified` omitted (Issue has no verified timestamp). Verdict is templated from the chart's own numbers rather than Gemini-generated. Bar chart is text rows, not a chart. |
| 3 Citizen portal | `GET /my-reports/{id}/status` + `/status` page, owner-only, plain-language priority band | Brief is not translated (no Translation API client exists); UI labels are localized, the brief text is in its source language. Token is pasted (dev), same as officer login. |
| 4 Co-pilot | Existing agent (Phase 6) extended with `get_risk_forecasts` and `get_equity_audit` tools; scope guard, grounding check, tool-round cap and trail UI already existed | No separate `POST /copilot/ask`: the session-based agent is the co-pilot. Cap is 5 tool rounds (existing), not 4. |
| 5 State onboarding | `POST /admin/states`, `GET /states`, admin form in the Insights panel | Registers the state in Firestore only. It does **not** load BigQuery reference data: run `scripts/seed-demo-data` for that. Dashboard state filter is not wired to the list yet. |
| 6 Transparency ledger | `GET /public/transparency` (no auth, 60 req/min/IP, min count 5, aggregates only) + `/transparency` page | Run the PII checklist (`senior-security`) once more before a public deploy. |

## You still need to
1. Deploy + seed (see phase 3/5 checklists); forecasts/equity need real accumulated Issues.
2. Native-speaker review of the new hi/ta/pt strings.
3. Phase 16: rehearse `docs/DEMO_SCRIPT.md` against the deployed URL and record the video.

## Update: media, voice, map, translation (branch feat/media-and-ai-features)
Built: `POST /v1/media` (photo/audio to Cloud Storage via a MediaStore seam, type + magic-byte + size checks,
rate-limited), worker speech-to-text (Gemini audio, then PII scrub and categorize; failures flag as
`transcription_failed`, never drop), audio-recorder fallback for browsers without Web Speech, photo attach in
the report form, `GET /v1/map/markers` + Leaflet/OpenStreetMap officer map (issues solid, forecasts dashed),
Gemini translation of the citizen status brief. `GEMINI_API_KEY` switches all Gemini calls to the public API
for local dev (Vertex + ADC otherwise); default models moved off retired `gemini-2.0-flash` to `gemini-3.6-flash`.
Verified live with a real key: categorization in en/hi/pt, 768-d embeddings, hi/pt translation.

Still not done: photo EXIF stripping (GPS metadata is kept in stored photos), Gemini Vision photo plausibility,
WhatsApp/SMS sending (also blocked by design: only a phone *hash* is stored, so there is nothing to send to
without a consented, encrypted phone field), BigQuery reference load on state onboarding, state filter wiring.
Needs you: create the `MEDIA_BUCKET` bucket and grant the Cloud Run service account Storage Object Admin;
audio transcription and uploads are untested against real GCS.
