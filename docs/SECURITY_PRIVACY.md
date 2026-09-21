# Security & Privacy: JanSetu

A public, government-facing platform handling citizen location and contact data needs to take this seriously even at hackathon scale — this doc is also a strong signal to judges on "Deployability."

## 1. AuthN / AuthZ

| Actor | Auth method | Notes |
|---|---|---|
| Citizen | Phone OTP (Firebase Auth) | Anonymous submission also allowed, with stricter rate limits and no impact-loop follow-up |
| Field Officer | Identity Platform / SSO, role = `field_officer` | Scoped to their `jurisdiction` claim — server enforces this on every request, never trusts client-supplied jurisdiction |
| District Collector | SSO, role = `collector` | Scoped to district |
| State Admin | SSO, role = `state_admin` | Full config access within their `state_id` only |

Role-based access control (RBAC) is enforced server-side on every write endpoint — jurisdiction scoping is a data-access-layer concern, never a UI-only restriction.

## 2. PII handling
- Raw phone numbers are never stored outside the auth provider; all other tables reference `citizen_id` (see `DATA_MODEL.md`).
- Uploaded photos: strip EXIF geodata server-side on ingest except the explicit `lat`/`lng` fields the citizen consented to share.
- Raw audio is deleted after successful transcription; only the transcript is retained (configurable retention window, default 90 days).
- Submission text is scanned for personal-safety/medical content unrelated to infrastructure (see `EDGE_CASES.md`) and routed to a separate review flow rather than the public pipeline.

## 3. DPDP Act 2023 considerations (India's Digital Personal Data Protection Act)
- Explicit consent notice shown at submission time, in the citizen's language, before any location/contact data is collected.
- Right-to-erasure endpoint: a citizen can request deletion of their `Submission`; if it was the sole source for an `Issue`, the `Issue` is tombstoned rather than silently left orphaned.
- Data localization: primary data residency in an India region (e.g. `asia-south1`) **on the GCP-native deployment path** (`DEPLOYMENT.md`, `GCP_SETUP_GUIDE.md`), where Vertex AI is pinned to that region. **This claim does not hold on the alternate no-GCP-billing path** (`FREE_DEPLOYMENT_GUIDE.md`): when `GEMINI_API_KEY` is set instead of using Vertex AI + ADC (`apps/api-gateway/src/lib/genai.ts`, `apps/worker-ai-pipeline/src/lib/genai.ts`), every Gemini call — categorization, embeddings, transcription, photo analysis, translation, the agent — routes through the public Gemini API with no region pinning. Don't run the free-deployment path for anything beyond a personal demo without disclosing this, and don't claim DPDP data-localization compliance for it as currently built.
- Purpose limitation: data is used only for infrastructure prioritization — no secondary use (e.g. marketing, unrelated analytics) without fresh consent.
- Documented breach notification process (who is notified, within what window) — even at hackathon stage, stating this shows production maturity.

## 4. Abuse / fraud prevention
- Rate limiting: per-citizen and per-IP submission caps (see `API_SPEC.md`).
- Geofencing: submission `lat`/`lng` must fall within a plausible bounding box of the claimed admin region; large mismatches are flagged for officer review, not auto-rejected.
- Burst/anomaly detection: a sudden spike of highly similar submissions from a narrow IP/device range in a short window is flagged before it's allowed to affect a public score.
- CAPTCHA on the anonymous web-form fallback.
- Photo plausibility check (Stage 4 of `AI_PIPELINE.md`) as a soft fraud signal, never a hard block.

## 5. Threat model (STRIDE-lite)

| Threat | Example | Mitigation |
|---|---|---|
| Spoofing | Fake citizen accounts to inflate demand | OTP-based phone auth |
| Tampering | Edited/fake photos | Soft AI plausibility check + officer verification before status changes to `verified` |
| Repudiation | Officer denies having approved something | Append-only audit log of every verify/approve/reject action |
| Information disclosure | Citizen phone/location leaked | PII minimization, hashed references, jurisdiction-scoped access |
| Denial of service | Flood of submissions or webhook spam | Cloud Armor, rate limiting, Pub/Sub buffering so ingestion never falls over even if downstream AI is slow |
| Elevation of privilege | Officer accessing another state's data | Server-side `state_id`/`jurisdiction` scoping on every query, never client-trusted |

## 6. Audit logging
Every officer action (`verify`, `dispute`, `mark-complete`) is logged with actor ID, timestamp, before/after state, written to an append-only Cloud Logging sink and mirrored into a BigQuery audit table for reporting.

## 7. Secrets management
All API keys, service credentials, and webhook verification tokens are stored in Secret Manager, never in source control or environment files committed to the repo. CI/CD injects secrets at deploy time only.
