# API Spec: JanSetu

Base URL (example): `https://api.jansetu.example/v1`
All authenticated endpoints require `Authorization: Bearer <token>`.

## 1. Auth

### POST /auth/otp/request
```json
{ "phone": "+91XXXXXXXXXX" }
```
→ `202 { "request_id": "otp_req_1" }`

### POST /auth/otp/verify
```json
{ "request_id": "otp_req_1", "otp": "482913" }
```
→ `200 { "citizen_token": "jwt...", "citizen_id": "cit_9af2" }`

Officer/admin auth uses Identity Platform / SSO — standard OAuth2 code flow, not detailed here; results in a `Bearer` JWT carrying `role` and `jurisdiction` claims.

## 2. Submissions

### POST /submissions
Public (citizen token optional — anonymous allowed with stricter rate limits).
```json
{
  "channel": "web",
  "text": "sadak me bahut bada gaddha hai",
  "audio_url": null,
  "photo_url": null,
  "lat": 28.6139,
  "lng": 77.2090
}
```
→ `202 { "submission_id": "sub_1a2b3c", "status": "queued" }`

Rate limit: 10 submissions / hour / citizen (authenticated), 3 / hour / IP (anonymous).

### GET /submissions/{submission_id}
Officer/citizen (own submission only). Returns raw submission + linked `issue_id` once processed.

## 3. Issues

### GET /issues?region={geo_cluster_id|district|state}&status=&category=&min_score=
Officer/policymaker only.
→ `200 { "issues": [ { "issue_id": "...", "category": "...", "report_count": 14, "composite_score": 0.63, "status": "prioritized" }, ... ] }`

### GET /issues/{issue_id}
→ Full `Issue` object plus score breakdown and generated brief (see `DATA_MODEL.md`).

### POST /issues/{issue_id}/verify
Officer only, must be within their `jurisdiction`.
```json
{ "verified": true, "notes": "Confirmed on-site, hazard is real" }
```
→ `200 { "issue_id": "...", "status": "verified" }`

### POST /issues/{issue_id}/dispute
Officer only.
```json
{ "reason": "Location does not match jurisdiction, likely misgeocoded" }
```
→ `200 { "issue_id": "...", "status": "disputed" }`

## 4. Priorities (policymaker dashboard)

### GET /priorities?region=&limit=20
Policymaker only.
→ `200 { "ranked_projects": [ { "project_id": "...", "composite_score": 0.635, "generated_brief": "...", "estimated_impact_population": 3200 }, ... ] }`

## 5. Impact loop

### POST /projects/{project_id}/mark-complete
Officer only.
→ Triggers Impact Tracking Service to notify original reporters.

### POST /projects/{project_id}/confirm-resolution
Citizen (OTP-gated), must be one of the original reporters on the underlying issue.
```json
{ "photo_url": "gs://jansetu-media/resolutions/proj_112_citizen.jpg", "confirmed": true }
```
→ `200 { "impact_id": "imp_55" }`

## 6. Channel webhooks

### POST /webhooks/whatsapp
Receives WhatsApp Business API payloads, maps to the internal `Submission` schema, calls the same ingestion path as `POST /submissions`.

### POST /webhooks/ivr
Dialogflow CX fulfillment webhook (stretch goal — see `ROADMAP.md`). Receives recognized speech + intent, maps to `Submission` schema.

## 7. Error format
```json
{ "error": { "code": "RATE_LIMITED", "message": "Too many submissions from this number in the last hour." } }
```

Common codes: `INVALID_LOCATION`, `RATE_LIMITED`, `UNAUTHORIZED`, `JURISDICTION_MISMATCH`, `VALIDATION_ERROR`, `AI_PIPELINE_UNAVAILABLE` (submission still accepted, processing deferred — see `EDGE_CASES.md`).

## 8. Versioning
All endpoints are prefixed `/v1`. Breaking changes get a new prefix; additive fields are always safe to add without a version bump — important once state-level deployments (see `ARCHITECTURE.md` federation model) start depending on a stable contract.
