# Phase 8 — manual steps (run these yourself)

Rule-based anti-fraud (rate-limit allowlist, geofence flagging, burst detection with
scoring suppression), the impact loop (mark-complete / officer-signoff / confirm-resolution,
feeding `impact_efficacy` back into Phase 5's scoring), and the DPDP privacy endpoints
(erasure, my-data) are implemented and unit-tested (31/31 worker + 76/76 api-gateway
tests, post cross-border work). See `apps/api-gateway/.env.example`. These steps need
real infrastructure/data:

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

### Cross-border (§8.3) — implemented
`getCountryProfile()`/`COUNTRY_PROFILES` (`packages/shared-types/src/countryProfiles.ts`)
now backs IN and BR for real, and every hardcoded `"IN"`/`isWithinIndiaBoundingBox` call
this phase doc originally called out has been replaced with a lookup keyed by the
citizen's/submission's actual `country_code`:
- `regionResolution.ts`'s nearest-centroid matching now takes `countryCode` and filters
  the candidate pool by it first — a Brazilian submission can no longer nearest-match an
  Indian district just because it's the closest seeded centroid overall (unit tested:
  `regionResolution.test.ts` "scopes nearest-centroid matching to the submission's country").
- `ingestSubmission.ts` derives `Submission.country_code` from the citizen's own record
  when one exists (so it can't be spoofed by an authenticated request body), or from an
  optional `country_code` field on the request for anonymous web submissions, defaulting
  to `"IN"`. `isWithinCountryBoundingBox(countryCode, ...)` replaces the India-only bounding
  box check (`isWithinIndiaBoundingBox` kept as a thin deprecated wrapper for existing callers).
- `POST /auth/otp/request` and `/verify` both accept `country_code`; a new citizen's
  `preferred_language` is derived from `CountryProfile.canonical_working_language` instead
  of being hardcoded `"en-IN"` (unit tested: auth.test.ts's BR case).
- Seeded a real `BR` profile: 1 estado (São Paulo) + 3 municípios (São Paulo, Campinas,
  Santos) in `scripts/seed-demo-data/source/admin_regions.csv`, with matching
  `infra_index.csv`/`investment_record.csv` rows (`data_origin: synthetic_demo`, `BRL`).
  Fixed a real bug this surfaced: `generateReferenceData.ts`'s `normalised_value` percentile
  was computed across *all* countries' rows for a given `index_type` — a second country's
  data would have silently shifted the first country's percentiles. Now grouped by
  `(country_code, index_type)`, matching the documented "percentile within the country" contract.
- Frontend: `apps/web/src/i18n/pt.json` added (completeness-tested against `en.json`'s key
  set like the other three languages); the language picker doubles as the country switcher —
  `SUPPORTED_LANGUAGES` now carries a `countryCode` per entry, and selecting Portuguese sets
  the submission's `country_code` to `BR`. No separate country-switcher UI was built; this
  is the one corner cut versus the phase doc's original 5-step list, and it's a reasonable
  one — a citizen doesn't pick a country independently of the language they're reporting in.
- **Not done**: `AdminRegionLevel`'s new `estado`/`município`/`distrito`/`bairro` values
  have no dedicated i18n label lookup in the officer UI yet (there's no admin-level label
  rendering anywhere in the UI today to retrofit — `officer.mapPlaceholder` is still a
  placeholder string, see phase-7's checklist).
- **Not done**: `getOrCreateCitizenByPhone` (WhatsApp/SMS webhook path, `apps/api-gateway/src/services/citizens.ts`) still hardcodes `country_code: "IN"` — left as-is since WhatsApp/SMS provider numbers and webhook payloads are inherently per-country integrations anyway (a real Brazilian deployment would register its own webhook), and the cross-border demo path is the web flow. Worth revisiting if a webhook-based BR demo is ever needed.
- **Caution carried over from the phase doc**: the Portuguese seed strings in `pt.json`
  were written directly, not machine-translated then reviewed, but they still haven't been
  checked by a native pt-BR speaker — spot-check before an actual demo, per the phase doc's
  original warning.

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
- [x] Country switch to `BR` — implemented via language selection (see Deferred above for
      exact scope and the one corner cut: no standalone country-switcher UI).
- [ ] Monitoring dashboard live with all seven metrics — needs a live deployment (see
      Deferred above).
