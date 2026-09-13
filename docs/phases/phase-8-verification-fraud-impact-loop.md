# Phase 8 of 9: Verification, Anti-Fraud & Impact Loop

## Header
- **Goal (done = ):** The system resists basic gaming (fake bursts, implausible locations, unrelated photos) and closes the loop — a completed project triggers citizen resolution confirmation that's recorded as measurable impact.
- **Preconditions:** Phase 4 (submissions pipeline), Phase 7 (officer mark-complete action point exists via the dashboard).
- **Specs implemented:** `AI_PIPELINE.md` Stage 4 & 7, `SECURITY_PRIVACY.md` §4, `EDGE_CASES.md` #3, #5, #6, #13.

## Task breakdown
1. `apps/worker-ai-pipeline/src/antifraud/geofence.ts`: `checkGeofence(lat, lng, claimedRegionId)` — confirms the point falls within a reasonable bounding box of the claimed admin region (using the same GIS boundary reference as `EDGE_CASES.md` #17). On mismatch, sets `location_confidence: "low"` and a `flagged_reason` — never rejects outright.
2. `apps/worker-ai-pipeline/src/antifraud/burstDetection.ts`: `detectBurst(geoClusterId, windowMinutes=60)` — counts new submissions to a cluster in the trailing window; if the rate exceeds `BURST_THRESHOLD_MULTIPLIER` times the cluster's historical average, routes the `Issue` to required-officer-review status before its score contributes to public ranking, rather than silently including it.
3. `apps/worker-ai-pipeline/src/antifraud/photoCheck.ts`: `checkPhotoPlausibility(photoUrl, category)` — Gemini Vision call per `AI_PIPELINE.md` Stage 4, returns `{plausible: boolean, confidence: number}`, stored on the `Submission` as a signal field only — never used to auto-reject.
4. Wire tasks 1-3 into Phase 4's `processSubmission` orchestration (`apps/worker-ai-pipeline/src/pipeline/index.ts`) — all three run after categorization, before the dedup merge decision; their outputs are stored but never block a submission from becoming/joining an `Issue`.
5. `apps/api-gateway/src/routes/projects.ts`: implement `POST /projects/{project_id}/mark-complete` (officer only) — transitions `Project.status` to `awaiting_confirmation` (extend the `Project.status` enum in `DATA_MODEL.md` accordingly), then triggers the Impact Tracking Service.
6. `apps/worker-ai-pipeline/src/impact/notifyReporters.ts`: `notifyOriginalReporters(issueId)` — looks up the `Citizen`s behind the issue's `submission_ids`, sends a resolution-confirmation message via their original channel (WhatsApp template or SMS), translated into their language using the same Translation API path as ingestion.
7. `apps/api-gateway/src/routes/projects.ts`: implement `POST /projects/{project_id}/confirm-resolution` (citizen, OTP-gated, must be one of the original reporters — check `citizen_id` against the issue's linked `submission_ids`' owners) — writes an `ImpactRecord`, increments `citizen_confirmations`.
8. Per `PRD.md` §6.6 / `EDGE_CASES.md` #13: `Project.status` only transitions to `resolved` once `citizen_confirmations` reaches a minimum threshold (e.g. 30% of distinct original reporters, minimum 1) — otherwise stays `awaiting_confirmation` with a visible officer-facing counter.
9. Feed impact data back into scoring per `AI_PIPELINE.md` Stage 7: extend Phase 5's `getGapScore` to optionally down-weight regions/categories with a poor historical resolved-vs-awaiting ratio — ship this as `model_version: "formula-v2"` behind a flag, keeping `formula-v1` available for direct comparison in the demo.
10. Unit tests: `"a burst of 20 submissions in 10 minutes to a cluster with historical average 2/hour is flagged for review"`, `"geofence check flags but does not reject a submission 5km outside its claimed ward"`, `"confirm-resolution from a citizen who never reported the underlying issue returns 403"`, `"Project only transitions to resolved once the confirmation threshold is met"`.

## Real-world engineering concerns
- **Every anti-fraud signal here is soft/advisory, never a hard auto-reject** — the cost of falsely blocking a real citizen's report outweighs the cost of an officer spending an extra minute reviewing a flagged one. State this as a deliberate design choice in the pitch, not an oversight.
- **The notification step (task 6) touches an external messaging provider** — wrap it in the `withRetry()` utility from Phase 4, and make sure a notification failure never blocks the officer's mark-complete action from succeeding.

## Definition of done
- [ ] A simulated burst of submissions is flagged and does not silently inflate a public ranking.
- [ ] A photo unrelated to its stated category is flagged (visible to the officer) but the submission still processes normally.
- [ ] A citizen who is one of the original reporters can confirm resolution; one who isn't gets a `403`.
- [ ] A `Project` correctly stays `awaiting_confirmation` below the confirmation threshold and flips to `resolved` above it.

## Risks & blockers
- WhatsApp Business API template-message approval through a provider (Gupshup/Twilio) can take time. **Mitigation:** start this application at the beginning of this phase, not when task 6 is reached — approval lead time is outside the team's control.

## Time budget
**3 days.** If it runs long, cut: task 9 (feeding impact back into scoring) — document as `formula-v2` future work, keep `formula-v1` as the demo path. The confirmation loop itself (tasks 5-8) must **not** be cut — it's the part directly named in the problem statement. Real WhatsApp delivery (task 6) can also be cut in favor of an in-app-only notification if provider approval is delayed.

## Handoff
The system has basic defenses against gaming and a working, demoable impact-confirmation loop. Tag `phase-8-done`. Phase 9 can now build the final security/deployment pass around a functionally complete system.
