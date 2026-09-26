# Security & Privacy: Pramaan

A public, government-facing platform handling citizen location and contact data needs to take this seriously even at hackathon scale — this doc is also a strong signal to judges on "Deployability."

## 1. AuthN / AuthZ

| Actor | Auth method | Notes |
|---|---|---|
| Citizen | Phone OTP (Firebase Auth) | Anonymous submission also allowed, with stricter rate limits and no impact-loop follow-up |
| Field Officer | Identity Platform / SSO, role = `field_officer` | Scoped to their `jurisdiction` claim — server enforces this on every request, never trusts client-supplied jurisdiction |
| District Collector | SSO, role = `district_collector` | Scoped to district |
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

## 8. Controls as implemented
Each row points at the code that enforces it, so the claims above can be checked rather than trusted.

| Control | Where |
|---|---|
| **One permission map for every role.** Enforced on every route and returned by `GET /me`, so the UI never invents permissions | `apps/api-gateway/src/services/permissions.ts` |
| **Jurisdiction on every officer read and write.** Ancestor test on the region chain; never client-trusted. Covers issues, projects, plans, analytics, exports, media, officer accounts and the audit log | `routes/helpers.ts` (`regionInScope`, `issueInScope`), `agent/scopeGuard.ts` |
| **Disabled officers lose access immediately.** Disabling revokes refresh tokens, and officer ID tokens are verified with `checkRevoked` | `lib/officerAdmin.ts`, `lib/authVerifier.ts` |
| **Media can't be pointed at other storage.** Only URLs minted by `POST /media` are accepted on submissions, webhooks and resolution photos. Both readers are pinned to the app's own bucket | `lib/mediaStore.ts` (`owns`), `worker-ai-pipeline/src/lib/media.ts` |
| **Media is scoped like its issue.** An officer can fetch a photo only if they may see the issue it belongs to | `routes/console.ts` `GET /media/*` |
| **Webhooks fail closed.** 503 until a shared secret is configured; constant-time comparison | `routes/webhooks.ts` |
| **The impact loop can't be gamed by one person.** One answer per reporter per round; officers can't answer as citizens; sign-off needs `district_collector` | `services/impactLoop.ts`, `routes/projects.ts` |
| **Scheduler-only jobs.** Escalation requires the worker shared secret | `routes/jobs.ts` |
| **Response hardening.** `nosniff`, `X-Frame-Options: DENY`, HSTS, `no-referrer`, `CSP default-src 'none'`, `no-store` | `app.ts` |
| **Traceability.** Every response and log line carries `x-request-id` (a validated caller id or a fresh UUID); 5xx bodies include it | `app.ts` |
| **Correct error classes.** Client mistakes stay 4xx; only dependency failures are 502, so monitoring alerts on real outages | `app.ts` |
| **Real client IPs for rate limits.** Exactly one proxy hop trusted; a spoofed `X-Forwarded-For` can't dodge the limiter | `app.ts` (`TRUST_PROXY_HOPS`) |
| **Graceful shutdown.** SIGTERM drains in-flight requests before exit (Cloud Run / Render) | `apps/*/src/index.ts` |
| **Client storage denied.** Firestore rules deny all direct client access; everything goes through the API | `firestore.rules` |
| **Export safety.** CSV cells that a spreadsheet would execute as formulas are neutralised; open data suppresses cells under 3 | `routes/reports.ts` (`csvCell`), `routes/public.ts` |
