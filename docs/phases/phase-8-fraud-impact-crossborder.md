# Phase 8 of 10: Anti-Fraud, Impact Loop & Cross-Border

**Days 13-14 · Track A · Last feature phase**

## Objective
Close the impact loop numerically, defend the system against gaming, and implement the cross-border capability that hackathon Rule 04 requires.

**Day 14 end is the absolute feature freeze.** Everything after is deployment and submission.

## Prerequisites
Phases 1-6 complete. Phase 7 in progress.

## Reference docs
`SECURITY_PRIVACY.md` §4, §5 · `CROSS_BORDER_AND_DPG.md` · `EDGE_CASES.md` #5, #6, #13 · `API_SPEC.md` §6, §9

---

## Deliverables

### 8.1 Anti-fraud — rule-based, as scoped
Explicitly not an ML model (`PRD.md` §5 non-goals). Four rules:

1. **Rate limiting** — 10/hr/citizen, 3/hr/IP anonymous. Demo-day allowlist CIDR exempted — a room of judges shares one WiFi IP and will rate-limit each other otherwise; configure this before demo day, not during it.
2. **Geofencing** — `lat/lng` must fall within a plausible bounding box of the resolved admin region. Large mismatch → `fraud_flags: ["geofence_mismatch"]`, officer review. **Not** rejection.
3. **Burst detection** — >N similar submissions from a narrow IP/device range in a short window → flag the *cluster*, suppress it from public scoring until an officer reviews. The seed data contains a deliberate burst pattern; this must catch it.
4. **Photo plausibility** 🟡 — Gemini Vision soft signal.

The design principle throughout: **flag for human review, never auto-reject.** A false positive silently disenfranchises a legitimate citizen — a strictly worse failure than letting a borderline case reach a person. Say this out loud in the demo; it is a governance judgement, not a technical limitation, and it is the kind of thing that distinguishes a submission built by people who thought about the users.

### 8.2 Impact loop
- `POST /projects/{id}/mark-complete` → Impact Tracking Service messages original reporters **on their original channel, in their `preferred_language`**.
- `POST /projects/{id}/confirm-resolution` → citizen confirms, photo optional.
- Resolution requires `confirmations_received >= confirmations_required` (default 3) **and** officer sign-off (`EDGE_CASES.md` #13).
- Aggregate to `ImpactRecord.efficacy` = positive / total responses.
- **Feed `impact_efficacy` into Phase 5's scoring.** Verify a region with poor historical efficacy scores measurably lower than an equivalent region with good efficacy.

That last step is the one that matters. Earlier drafts described the impact loop in prose and never entered it into the maths. Demonstrating the number actually changing is what makes "we closed the loop the problem statement says is unsolved" a verified claim rather than a slide.

### 8.3 Cross-border — Rule 04 (~4.5 hours)
The full argument is in `CROSS_BORDER_AND_DPG.md`. Implementation:

1. Replace every hardcoded `"IN"`, `"INR"`, `"en"`, and Indian admin-level label with a `CountryProfile` lookup. Grep for them — there will be more than you expect.
2. Seed a `BR` profile: `admin_levels: ["estado","município","distrito","bairro"]`, `official_languages: ["pt-BR"]`, `currency: "BRL"`, `region_code_authority: "IBGE"`.
3. Load 3 synthetic municípios with InfraIndex and InvestmentRecord rows.
4. Seed ~30 Portuguese submissions.
5. UI country switcher (officer/admin only).

**The demo:** toggle the profile. Admin hierarchy relabels, language switches, region picker repopulates with Brazilian municípios, the same agent answers the same question in Portuguese against Brazilian data. Twenty seconds of video.

No other team will do this, and it answers a numbered rule most submissions will skip entirely. For four and a half hours of work it is the highest-ROI item remaining in the build.

### 8.4 Privacy endpoints
`POST /v1/privacy/erasure-requests` and `GET /v1/privacy/my-data` (`API_SPEC.md` §7).

Erasure: content fields nulled, `status: "tombstoned"`, `citizen_id` unlinked. Sole-source issues tombstoned too. Audit entries retained — they hold actor IDs and actions, never citizen content, which is what makes retention compatible with erasure. State this in the DPDP notice text.

### 8.5 Monitoring
Cloud Monitoring dashboard: submission volume, dedup merge rate, AI pipeline latency p50/p95, Gemini error rate, agent tool-call latency, refusal rate, officer response time.

Alert: Gemini error rate > 5% over 5 minutes.

Structured logging with a correlation ID per submission, traceable end to end. Useful for debugging now and a genuine "we thought about operations" signal later.

### 8.6 Doc cleanup — verify this is already done
By this point in the build, `docs/` should already reflect: `Improvements.md` removed from the repo, stale Stage 6→7 cross-references fixed in `EDGE_CASES.md`/`TESTING.md`, the "zero hallucinations" claim replaced with the measurable one in `PRD.md`, agent latency/tool-selection metrics present in `PRD.md` §7, and the attribution table in `ARCHITECTURE.md` §6 populated. Use this checkpoint to confirm the attribution table specifically — it should have been filled in incrementally since Phase 1, not written from memory now.

---

## Acceptance criteria

- [ ] The seeded burst cluster is flagged and suppressed from public scoring
- [ ] A geofence-mismatched submission is flagged but **accepted** — verify the record exists
- [ ] Rate limiting triggers at the correct threshold; the allowlist CIDR is exempt
- [ ] Mark-complete notifies original reporters on their original channel in their language
- [ ] A project with 2 of 3 required confirmations does not flip to resolved
- [ ] A region with poor historical efficacy scores measurably lower than an equivalent region with good efficacy — **capture this comparison, it is the closed-loop proof**
- [ ] Country switch to `BR` relabels the admin hierarchy, switches language, and repopulates the region picker
- [ ] The agent answers a question in Portuguese against Brazilian data, with citations
- [ ] Erasure request tombstones the submission and tombstones a sole-source issue
- [ ] `GET /privacy/my-data` returns everything held about the caller
- [ ] Monitoring dashboard live with all seven metrics
- [ ] Attribution table populated for every dataset and library used

## Definition of done
The system defends itself, measures whether it actually helped anyone, and runs in a second country from a config file.

## Traps
- Burst detection must suppress from **public scoring**, not delete. An officer needs to see the flagged cluster to judge it — a real emergency looks exactly like a coordinated burst.
- Do not let erasure break `report_count`. Tombstone preserves the ID.
- Grep for hardcoded `"IN"` and `"INR"` thoroughly. One missed constant breaks the country-switch demo on stage, which is worse than not attempting it.
- Portuguese seed text should be checked by someone who reads it, or at minimum spot-checked against a translation. The same rule as the Indian languages in Phase 2.

## Handoff
The system defends itself against gaming, closes the impact loop numerically, and runs a second country from config. Tag `phase-8-done`. Phase 9 builds the final security/deployment pass around a functionally complete system.
