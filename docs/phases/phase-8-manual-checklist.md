# Phase 8 — manual steps (run these yourself)

Rule-based anti-fraud (rate-limit allowlist, geofence flagging, burst detection with
scoring suppression), the impact loop (mark-complete / officer-signoff / confirm-resolution,
feeding `impact_efficacy` back into Phase 5's scoring), and the DPDP privacy endpoints
(erasure, my-data) are implemented and unit-tested (23/23 worker + 75/75 api-gateway
tests). See `apps/api-gateway/.env.example`. These steps need real infrastructure/data:

1. **Demo-day allowlist**: get the venue WiFi's public IP before the demo and set
   `RATE_LIMIT_ALLOWLIST_CIDRS=<venue-ip>/32` on the deployed `api-gateway`. Do this the
   morning of, not during — a room of judges will otherwise rate-limit each other.
2. **Verify the closed-loop scoring claim** (the phase's headline acceptance criterion):
   seed two equivalent regions' worth of issues, mark one region's projects complete with
   mostly positive confirmations and the other with mostly negative, run `POST /jobs/score`
   (Phase 5) for both, and screenshot the resulting `impact_efficacy`/`composite_score`
   difference. This can't be verified from unit tests — it's a property of running the
   whole pipeline against real accumulated confirmations.
3. **Real reporter notification**: `mark-complete` currently computes and logs the
   notification plan (citizen, channel, language) but sends nothing — wire it to the
   WhatsApp/SMS provider once that account exists (same gap noted in
   `docs/phases/phase-3-manual-checklist.md`).

## Deferred (documented, not built)

### Cross-border (§8.3) — not attempted this round
This needs, per the phase doc's own estimate, ~4.5 hours of *careful* work: grepping the
entire codebase for hardcoded `"IN"`/`"INR"`/`"en"`/Indian admin-level labels and replacing
each with a `CountryProfile` lookup, seeding a real `BR` profile with 3 synthetic
municípios, ~30 **human-reviewed** Portuguese submissions (the phase doc explicitly warns
against unreviewed machine-translated seed text — "checked by someone who reads it, or at
minimum spot-checked"), and a country-switcher UI. Doing this superficially — swapping a
few obvious constants without the systematic grep — would be worse than not attempting it:
it would look done, fail the demo on stage, and nobody would have reason to re-check it.
Concretely, before starting this:
- `grep -rn '"IN"' apps/ packages/ --include='*.ts'` and the equivalent for `"INR"`, `"en"`
  as a language default, and `AdminBoundary`'s `ward`/`district`/`state` field names.
- Every hit needs a `CountryProfile` lookup keyed by the citizen/officer/session's
  `country_code`, not a hardcoded string.
- `CountryProfile` itself (shared-types) has no live Firestore/BigQuery store methods yet —
  add `getCountryProfile(countryCode)` alongside the `DEFAULT_SCORE_WEIGHTS` env-var
  workaround from `docs/phases/phase-5-manual-checklist.md`, and resolve that TODO at the
  same time since both need the same lookup.

### Monitoring (§8.5) — needs a live deployment
A Cloud Monitoring dashboard, by definition, can't be built against code that has never
been deployed to a real Cloud Run service. What's already true without extra work:
**structured, correlation-id-traceable logging already exists** — every worker log line
for a submission includes `submissionId`, which is the same ID `api-gateway` returned to
the citizen at ingestion, so a submission is already traceable end-to-end through both
services' logs via that one ID. What's still needed once deployed:
- A Cloud Monitoring dashboard with the seven named metrics (submission volume, dedup
  merge rate, AI pipeline latency p50/p95, Gemini error rate, agent tool-call latency,
  refusal rate, officer response time) — most of these need a metrics/logging query built
  against real Cloud Run request logs and Firestore write patterns, not something
  meaningful to fabricate against zero traffic.
- An alert policy: Gemini error rate > 5% over 5 minutes.

### Photo plausibility (§8.1.4, 🟡 optional)
Gemini Vision soft signal on uploaded photos — blocked on the same gap
`docs/phases/phase-7-manual-checklist.md` already tracks: no photo upload endpoint exists
anywhere in this build, so there are no real photo URLs to run a plausibility check against.

## Definition of done (from `phase-8-fraud-impact-crossborder.md`)
- [x] The seeded burst pattern is flagged (`fraud_flags: ["burst_detected"]`) and
      suppressed from `getEligibleIssuesForScoring` — unit tested against a synthetic
      6-submission burst.
- [x] A geofence-mismatched submission is flagged but accepted (`status: "processed"`,
      not rejected) — unit tested.
- [x] A project with 2 of 3 required confirmations does not flip to resolved — unit tested.
- [x] Confirmation + officer sign-off together (not either alone) flip a project to
      `completed` — unit tested both orderings.
- [x] Erasure request tombstones the submission (content nulled, `citizen_id: "erased"`)
      and tombstones a sole-source issue while preserving `report_count` — unit tested.
- [x] A non-sole-source issue is *not* tombstoned by one reporter's erasure — unit tested.
- [x] `GET /privacy/my-data` returns the citizen, their submissions, and consent
      records — unit tested.
- [x] Attribution table populated (`docs/ARCHITECTURE.md` §6).
- [ ] Rate limiting allowlist exempts the correct CIDR — logic is real and unit tested
      (`lib/cidr.test.ts`); needs the actual venue IP on demo day (step 1 above).
- [ ] Mark-complete notifies original reporters on their original channel/language — the
      notification *plan* is computed and logged correctly (unit tested); no message is
      actually sent (step 3 above).
- [ ] A region with poor historical efficacy scores measurably lower than one with good
      efficacy, captured as a screenshot — needs a real end-to-end run (step 2 above).
- [ ] Country switch to `BR` — not attempted (see Deferred above).
- [ ] Monitoring dashboard live with all seven metrics — needs a live deployment (see
      Deferred above).
