# Roadmap: JanSetu

Legend: 🔴 must-have for the demo · 🟡 stretch goal (only if ahead of schedule)

Submission deadline: 30 Sep 2026. Plan below assumes roughly 18-20 working days remaining — adjust the day numbers to your actual start date, but keep the phase order and the 🔴/🟡 split.

## Phase 1 — Foundation (Days 1-2)
- 🔴 Finalize scope: 3 languages, 5 categories, 3 states for the demo dataset.
- 🔴 Source real reference data: a public infra/demographic dataset to derive `InfraIndex` from (e.g. a Census handbook or similar public index), and build a realistic (clearly labeled as sample) `InvestmentRecord` dataset.
- 🔴 Stand up the GCP project, enable Gemini API/Vertex AI, Firestore, BigQuery, Cloud Run, Maps Platform.
- 🔴 Finalize schema from `DATA_MODEL.md` — get this right early, everything else depends on it.

## Phase 2 — Ingestion (Days 3-5)
- 🔴 Web form submission → Ingestion Gateway → Firestore, end-to-end.
- 🔴 In-app voice recording → Speech-to-Text → same pipeline (this satisfies the "voice support" requirement without a telephony integration).
- 🔴 Translation API wired in, tested with at least 2 non-English languages.
- 🟡 WhatsApp Business API webhook integration.
- 🟡 Full Dialogflow CX IVR phone-line integration.

## Phase 3 — Categorization & deduplication (Days 6-9)
- 🔴 Gemini structured-output categorization call, schema-validated.
- 🔴 Vertex AI Embeddings + geo-radius candidate matching + cosine similarity merge logic.
- 🔴 Demo-able proof point: show 10+ raw submissions collapsing into 1-2 canonical Issues live.

## Phase 4 — Prioritization (Days 10-12)
- 🔴 Composite scoring formula implemented against BigQuery-joined `InfraIndex`/`InvestmentRecord` data.
- 🔴 Score breakdown visible, not just the final number.
- 🟡 Vertex AI AutoML ranking model trained on any available historical outcome data, compared against the hand-tuned formula.

## Phase 5 — Dashboard & generation (Days 12-14)
- 🔴 Officer/policymaker web app: map + ranked list.
- 🔴 RAG-grounded Gemini brief generation per top-ranked issue, with the consistency check from `AI_PIPELINE.md`.
- 🔴 Officer verify/dispute actions wired to the API.

## Phase 6 — Verification, fraud, impact loop (Days 14-16)
- 🔴 Rate limiting + geofencing + burst detection (rule-based is fine).
- 🔴 Mark-complete → citizen confirmation flow → `ImpactRecord`.
- 🟡 Photo plausibility check via Gemini Vision.

## Phase 7 — Polish & deploy (Days 16-17)
- 🔴 Deploy to Cloud Run/Firebase Hosting behind a real, stable URL.
- 🔴 Load the synthetic demo dataset (see `TESTING.md`) so the dashboard looks populated and realistic — don't demo an empty database.
- 🔴 Run the full end-to-end flow 10+ times yourself, exactly as a judge would.

## Phase 8 — Submission package (Days 18-20)
- 🔴 Record the 3-5 minute demo video: real flow, not slides — voice input in at least one language, dedup happening, dashboard, and the impact-confirmation step.
- 🔴 Build the 10-12 slide pitch deck, explicitly structured around the five judging criteria.
- 🔴 Clean GitHub repo: this doc folder, source code, README, licensing/citation notes per Rule 03.
- 🔴 Write the 2-3 line submission description.
- 🔴 Buffer day for anything that broke during rehearsal.
