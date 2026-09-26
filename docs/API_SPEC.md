# API Spec: Pramaan

**v2 — corrected 15 Sep 2026.** The major addition is §5, the agent surface — entirely missing from v1 despite the conversational agent being PRD goals G4/G5 and the headline 25%-weighted "AI/Technical Execution" criterion.

Base URL: `https://api.pramaan.example/v1`
All authenticated endpoints require `Authorization: Bearer <token>`.
All mutating endpoints accept an optional `Idempotency-Key` header; on `POST /submissions` it is **required**.

## 1. Auth

### POST /auth/otp/request
`{ "phone": "+91XXXXXXXXXX", "country_code": "IN" }` → `202 { "request_id": "otp_req_1" }`

### POST /auth/otp/verify
`{ "request_id": "otp_req_1", "otp": "482913" }` → `200 { "citizen_token": "jwt...", "citizen_id": "cit_9af2" }`

Officer/admin auth: Identity Platform OAuth2 code flow. The resulting JWT carries `role`, `country_code`, and `region_id` (LGD) claims. **Server derives scope from these claims only.**

## 2. Submissions

### POST /submissions
Public. Citizen token optional (anonymous allowed, stricter limits).

Headers: `Idempotency-Key: <client-generated uuid v4>` — required.

```json
{
  "channel": "web",
  "text": "sadak me bahut bada gaddha hai",
  "audio_url": null,
  "photo_url": null,
  "lat": 28.6139,
  "lng": 77.2090,
  "location_text": null,
  "consent_version": "dpdp-notice-v1-hi"
}
```
→ `202 { "submission_id": "sub_1a2b3c", "status": "queued" }`

Replaying the same `Idempotency-Key` within 24h returns the **original** `202` body, not a duplicate record (`EDGE_CASES.md` #14). Same key, different payload → `409 IDEMPOTENCY_CONFLICT`.

Must return in **< 2s** regardless of AI pipeline state. If the pipeline is down, the record is written with `status: "deferred"` and the citizen still gets a `202`.

Rate limits: 10/hour/citizen authenticated · 3/hour/IP anonymous. Demo-day allowlist CIDR is exempt — configure this before demo day or a room full of judges on one WiFi network will rate-limit each other.

### GET /submissions/{submission_id}
Officer, or the citizen who filed it. Returns the submission plus `issue_id` once processed. `raw_text` is returned **only** to the owning citizen and to officers with `role >= field_officer` in the resolved region.

## 3. Issues

### GET /issues
Query: `region_id` (LGD) · `category` · `status` · `min_score` · `limit` · `cursor`
Officer / policymaker only. Region scope is intersected with the caller's JWT `region_id` ancestry — a request for a region outside your jurisdiction returns `403 JURISDICTION_MISMATCH`, not an empty list. (Empty lists leak nothing but also teach nothing; an explicit 403 is the honest answer.)

→ `200 { "issues": [...], "next_cursor": "..." }`

### GET /issues/{issue_id}
Full `Issue` + latest canonical `PriorityScore` (including `data_fallbacks`) + linked `Project` if any.

### GET /issues/{issue_id}/score
Full score breakdown with every component, the weights used, the fallback disclosures, and `model_version`. This is the endpoint behind "show me why this ranked here" — `PRD.md` §6.3 requires it.

### POST /issues/{issue_id}/verify
Officer only, region-scoped. `{ "verified": true, "notes": "..." }` → `200`

### POST /issues/{issue_id}/dispute
Officer only. `{ "reason": "..." }` → `200`

### POST /issues/{issue_id}/emergency-override
Officer (role ≥ `collector`). Sets `emergency_override: true`, bypassing the normal scoring cadence and the minimum-report-count threshold. Implements `EDGE_CASES.md` #11. Logged to the audit sink with actor and justification.

```json
{ "enabled": true, "justification": "Bridge collapse reported, 40+ submissions in 20 min" }
```

## 4. Priorities

### GET /priorities?region_id=&limit=20
Policymaker only. Returns ranked `Project` candidates with canonical scores. Never returns simulation scores.

## 5. Agent

This is the contract for the feature carrying 25% of the judging weight.

### POST /agent/sessions
`{ "region_scope": "LGD:IN-07-091-0014" }` → `201 { "session_id": "sess_88b2" }`

Server validates `region_scope` is within the caller's jurisdiction and pins it for the session. The agent's tools cannot be talked out of this scope by prompt injection because scope is applied in the tool implementation, not passed through the model.

### POST /agent/sessions/{session_id}/messages
`{ "text": "What are the top 3 unaddressed road issues here, and are they already funded?" }`

Response: `text/event-stream` (SSE). Event types:

```
event: tool_call
data: {"tool":"query_fused_data","params":{"category":"roads"},"status":"running"}

event: tool_result
data: {"tool":"query_fused_data","row_count":3,"latency_ms":340}

event: token
data: {"text":"Ward 14 has "}

event: citation
data: {"span":[0,42],"source":"tool:query_fused_data","field":"distinct_reporter_count"}

event: done
data: {"turn_id":"turn_88b2_02","refused":false,"total_latency_ms":2180}
```

Streaming tool calls to the UI is not decoration. It is the demo — the judge watches the agent decide which data to fetch before it speaks. A spinner followed by a paragraph proves nothing.

Refusal case:
```
event: done
data: {"turn_id":"...","refused":true,
       "refusal_reason":"no_investment_data_for_region",
       "text":"I don't have investment records for this ward for FY2024-25, so I can't tell you whether these issues are already funded. I can show you the demand data alone, or widen to district level."}
```

A refusal must always offer the next best action. Bare refusal is a worse product and a worse demo.

### GET /agent/sessions/{session_id}
Returns the session and all `AgentTurn` records with full tool traces.

### GET /audit/agent-turns
Query: `officer_id` · `from` · `to` · `refused`
Role ≥ `state_admin`. Read-only audit surface. This is the answer to "how would a government actually govern this system" — an oversight body can inspect every AI-generated recommendation and the exact evidence behind it.

## 6. Impact loop

### POST /projects/{project_id}/mark-complete
Officer only. Triggers Impact Tracking Service notification to original reporters on their original channel.

### POST /projects/{project_id}/confirm-resolution
Citizen, OTP-gated, must be an original reporter on the underlying issue.
`{ "photo_url": "...", "confirmed": true }` → `200 { "impact_id": "imp_55" }`

Does **not** flip the project to resolved on its own. Resolution requires `confirmations_received >= confirmations_required` (default 3) **and** officer sign-off (`EDGE_CASES.md` #13).

Implemented rules (`apps/api-gateway/src/services/impactLoop.ts`):
- **One answer per reporter per round.** A repeat gets `409 ALREADY_CONFIRMED`. `confirmations_required` is `min(3, identified reporters)`, never below 1. Identified reporters are signed-in reporters plus anonymous reports that carry a tracking code.
- **Anonymous reporters answer with their tracking code:** `POST /public/track/{code}/confirm` `{ "confirmed": true }`. A signed-in reporter who also holds the code still gets a single vote.
- **Citizens can reopen (the Swachhata pattern).** When "not fixed" answers reach the threshold *and* outnumber "fixed":
  - the project returns to `in_progress`, and the sign-off and completion mark are cleared;
  - the next round of answers starts clean, and `reopened_count` increases by one;
  - the assigned officer gets an `issue.reopened` notification.
- `mark-complete` and `officer-signoff` require role ≥ `district_collector`. Officer tokens cannot confirm as citizens.

## 7. Privacy

### POST /privacy/erasure-requests
Citizen, OTP-gated. `{ "scope": "all_submissions" }` → `202 { "request_id": "era_9", "sla_days": 30 }`

Effect: submission content fields nulled, `status: "tombstoned"`, `citizen_id` unlinked. If the submission was the sole source of an `Issue`, the Issue is tombstoned too. Audit log entries are retained — they record actor IDs and actions, never citizen content, so retention is compatible with erasure. State this explicitly in the DPDP notice.

### GET /privacy/my-data
Citizen, OTP-gated. Returns everything held about the caller. DPDP access right.

## 8. Reference

### GET /regions/{region_id}
Returns an `AdminRegion` with its parent chain and available `InfraIndex` types. Used by the UI region picker and by the officer "what data do we actually have here" panel.

## 9. Channel webhooks

Both webhooks **fail closed**. They return `503 CHANNEL_NOT_CONFIGURED` until `WEBHOOK_SHARED_SECRET` is set, and then require it in `x-webhook-secret` (compared in constant time). Any `photo_url` must be one issued by `POST /media`.

### POST /webhooks/whatsapp
Receives WhatsApp Business API payloads, maps to the internal `Submission` schema, calls the same internal ingestion path as `POST /submissions` — not a parallel implementation.

### POST /webhooks/sms
Receives inbound SMS via the same provider account (Gupshup/Twilio) used for WhatsApp. Maps to `Submission` the same way. This is what makes the "usable on a basic feature phone" claim in `PRD.md` §2 actually true — no other MVP channel runs on a feature phone.

### POST /webhooks/ivr
Dialogflow CX fulfillment webhook (stretch goal — see `BUILD_PLAN.md`). Receives recognized speech + intent, maps to `Submission` schema.

## 10. Errors

```json
{ "error": { "code": "RATE_LIMITED", "message": "...", "retry_after_s": 1800 } }
```

Codes: `INVALID_LOCATION` · `RATE_LIMITED` · `UNAUTHORIZED` · `FORBIDDEN` (role too low) · `JURISDICTION_MISMATCH` · `VALIDATION_ERROR` · `NOT_FOUND` · `CONFLICT` · `ALREADY_CONFIRMED` · `NOT_MARKED_COMPLETE` · `PAYLOAD_TOO_LARGE` · `UNSUPPORTED_MEDIA_TYPE` · `CHANNEL_NOT_CONFIGURED` · `AI_PIPELINE_UNAVAILABLE` (submission accepted, `status: deferred`) · `IDEMPOTENCY_CONFLICT` (same key, different payload) · `REGION_NOT_FOUND` · `AGENT_TOOL_FAILURE` · `INSUFFICIENT_DATA` (agent refusal surfaced as an error on non-streaming callers) · `UPSTREAM_ERROR` (a dependency failed; carries `request_id`).

Client mistakes that Fastify detects itself (malformed JSON, oversized body, wrong content type) keep their 4xx status. Only genuine server-side failures return `502 UPSTREAM_ERROR`. Unknown routes return a JSON `404 NOT_FOUND`.

**Every response carries:**
- `x-request-id`: echoes a well-formed caller-supplied id (8–64 chars of `[A-Za-z0-9._-]`), otherwise a fresh UUID. Quote it in support requests; it appears in every gateway log line for that request.
- Security headers: `x-content-type-options: nosniff`, `x-frame-options: DENY`, `referrer-policy: no-referrer`, `strict-transport-security`, and `content-security-policy: default-src 'none'; frame-ancestors 'none'`.
- `cache-control: no-store`, unless the route sets its own.

## 11. Versioning
`/v1` prefix. Additive fields are safe without a bump. Breaking changes get `/v2`. The federated aggregator (Option B, `ARCHITECTURE.md` §5) and any cross-country deployment depend on this contract being stable — that is the whole point of pinning it now rather than after the hackathon.

## 12. Console, workflow, planning and public APIs

Built after sections 1–9 were written; all live under `/v1`. **Access** column:
- **Officer:** any officer role, jurisdiction-scoped.
- **Officer ≥ X:** the role hierarchy `field_officer` < `district_collector` < `state_admin`.
- **Citizen:** any signed-in user.
- **Public:** no login, rate-limited per IP, aggregate or coarse data only.

`services/permissions.ts` is the single source of truth for what each role may do. `GET /me` returns it, so the web app hides controls instead of inviting 403s.

### Identity and citizens
| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/me` | Citizen or officer | Identity, role, region and resolved permission set |
| POST | `/auth/session` | Citizen | Creates the citizen record on first email sign-in |
| GET | `/my-reports` | Citizen | The caller's own reports with their issue's progress |
| GET | `/my-reports/{submission_id}/status` | Citizen (owner) | Journey, priority band, translated brief, and whether a fix confirmation is awaited |
| GET | `/notifications` · POST `/notifications/read` | Citizen or officer | In-app inbox (text rendered client-side from `kind` + `params`, in the reader's language) |

### Officer console
| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/issues` | Officer | Filter (`category`, `status`, `q`, `flagged`, `assigned`, `overdue`) and sort (`score`, `reports`, `recent`) within the jurisdiction |
| GET | `/issues/{id}` | Officer | Detail: score, project, impact record, anonymised reports, audit history |
| POST | `/issues/{id}/status` | Officer ≥ collector | Verify / dispute / prioritise / fund / in progress, with a justification (audit-logged) |
| POST | `/issues/{id}/assign` | Officer ≥ collector | Assign to an officer whose jurisdiction covers the issue; optional SLA override |
| GET, POST | `/issues/{id}/comments` | Officer | Internal notes |
| POST | `/issues/{id}/project` | Officer ≥ collector | Recommend a project (grounded brief, department, indicative budget) |
| GET | `/projects` · POST `/projects/{id}/status` | Officer · Officer ≥ collector | Projects in scope; mark funded / in progress |
| GET | `/media/*` | Officer | A report's photo/audio, only if the officer may see its issue |
| GET | `/analytics/overview` · `/analytics/impact` | Officer | Dashboard KPIs; the impact ledger (people benefited, spend, confirmation rate) |
| GET | `/activity` | Officer | Live feed of reports and officer actions in scope |
| GET | `/regions` · `/officers/directory` | Officer | Regions and assignable officers inside the jurisdiction |
| GET | `/reports/briefing?lang=` | Officer | Weekly briefing: computed facts, narrated by Gemini, ungrounded sentences stripped |
| GET | `/export/issues.csv` | Officer | Spreadsheet export (formula-injection-safe); no reporter identity |
| GET | `/forecasts` · `/map/markers` · `/equity-audit` · `/states` | Officer (equity: ≥ state admin) | Early warning, map layers, fairness audit, onboarded states |

### Funding and planning
| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/schemes` · `/issues/{id}/schemes` · `/schemes/alignment` | Officer | Scheme catalogue, best-fit schemes for an issue, central-funding alignment for a region |
| POST | `/planner/optimize` | Officer ≥ collector | Budget knapsack with a vulnerability equity floor, against a "most reports first" baseline |
| POST | `/planner/plans` · GET `/planner/plans` | Officer ≥ collector · Officer | Save (recomputed server-side) and list plans in scope |
| POST | `/planner/plans/{id}/approve` | Officer ≥ collector | Funds every still-plannable issue in the plan and notifies reporters |
| POST | `/planner/simulate-weights` | Officer | Re-rank under different demand/vulnerability/gap weights (nothing persisted) |

### Administration
| Method | Path | Access | Purpose |
|---|---|---|---|
| GET, POST | `/admin/officers` | Officer ≥ state admin | Officer accounts inside the admin's jurisdiction |
| POST | `/admin/officers/{uid}/disabled` | Officer ≥ state admin | Disable/enable; disabling revokes the officer's sessions immediately |
| GET | `/admin/audit` | Officer ≥ state admin | Audit trail scoped to the admin's jurisdiction |
| POST | `/admin/states` | Officer ≥ state admin | Onboard a state |

### Public (no login)
| Method | Path | Purpose |
|---|---|---|
| GET | `/public/track/{code}` | Follow a report by tracking code: stage, priority band, whether a fix confirmation is awaited |
| POST | `/public/track/{code}/confirm` | Anonymous reporter answers "was it really fixed?" (see §6) |
| GET | `/public/nearby?lat=&lng=&radius=` | Open issues within `radius` m (default 500), nearest first, distance rounded to 50 m: "already reported?" before filing |
| GET | `/public/issues` | Community map: category, status, coarse (~1 km) location; no text |
| POST | `/issues/{id}/support` | Citizen "I'm affected too": follows the issue and gets its notifications; never feeds `demand_score` |
| GET | `/public/overview` · `/public/impact` · `/public/scorecards` · `/public/transparency` | Aggregates, withheld below the k-anonymity floor |
| GET | `/public/opendata/issues.csv` · `/public/schemes` · `/public/regions` | Open data (cells under 3 suppressed), scheme catalogue, geography |

### Jobs (scheduler only)
| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/jobs/escalations` | `x-worker-secret` | CPGRAMS-style escalation (see below) |

**How escalation works:**
- Level 1: an open issue past its SLA goes to the district collectors covering it.
- Level 2: once it is overdue by a whole further SLA window, it goes to the state admin.
- Each level notifies once (`Issue.escalation_notified`).
- If a district has no collector on the platform, the state admin receives level 1 too.
- Called every 15 minutes by `.github/workflows/scheduled-jobs.yml` when the `API_URL` secret is set.
