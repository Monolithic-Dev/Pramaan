# Phase 13 of 16: Public Transparency Ledger

## Header
- **Goal (done = ):** Anyone, with no login, can view aggregate accountability statistics per
  state at a public URL — with no PII and a minimum-count guard against re-identification.
- **Preconditions:** Phase 5 (scored Issues/Projects). Phase 12's equity summary is an optional
  enrichment, not a hard dependency.
- **Specs implemented:** `docs/advanced-features/06-public-transparency-ledger.md`.

## Task breakdown
1. `apps/api-gateway/src/routes/publicTransparency.ts`: `GET /public/transparency?state=` —
   explicitly **no auth middleware**, but wrapped in a stricter rate limiter than any
   authenticated endpoint (e.g. 30 requests/hour/IP) given its public exposure.
2. Aggregation query (BigQuery): total issues reported, % verified, % funded, % resolved, avg
   days report→verified, avg days verified→resolved — computed at district/state granularity
   only, never finer.
3. Minimum-count threshold: any aggregate bucket below `MIN_PUBLIC_COUNT` (default 10) is
   **suppressed from the response entirely**, not shown with a small, potentially
   re-identifying number.
4. Optional enrichment: include Phase 12's equity verdict text if available for that state —
   still aggregate, still no PII.
5. `apps/web/src/routes/public/TransparencyPage.tsx`: no auth wrapper, linked from the
   citizen-facing footer, renders the aggregate stats.
6. **Mandatory security sign-off:** run this endpoint's response shape past
   `.claude/skills/senior-security/references/dpdp-compliance-checklist.md` explicitly, because
   there's no auth layer to catch a mistake after the fact. Treat this as a required step, not a
   suggestion — record the sign-off in the PR description.
7. Unit tests: `"a district/category combination below the minimum count threshold is omitted from the public response"`, `"the public endpoint never returns any field present in the Submission or Citizen schemas"`, `"requesting beyond the public rate limit returns 429"`.
8. Integration test: confirm the endpoint, called with zero authentication, returns correct
   aggregate numbers for a seeded demo state and correctly suppresses a deliberately small
   seeded bucket.

## Real-world engineering concerns
- This is the single most exposed surface in the entire system — apply a **stricter** security
  review than any other endpoint, not the same bar.
- Add short-TTL caching (e.g. 5 minutes) — this is the one endpoint an anonymous crawler or a
  viral link could hit hardest.

## Definition of done
- [ ] The endpoint is reachable with zero authentication and returns correct aggregate data.
- [ ] A deliberately small seeded bucket is confirmed suppressed, not shown.
- [ ] The security sign-off (task 6) is completed and recorded.
- [ ] All tests in task 7-8 pass.

## Risks & blockers
- IP-based rate limiting on an unauthenticated endpoint is imperfect (shared NATs, mobile
  carriers) — acceptable for hackathon scope; note it as future work in `docs/DEPLOYMENT.md`
  rather than over-engineering it now.

## Time budget
**1 day.** If it runs long, cut: the Phase 12 equity-verdict enrichment (task 4) — the core
aggregate stats alone still make the point. Do **not** cut: the minimum-count suppression (task
3) or the security sign-off (task 6) — this endpoint has no auth layer as a second line of
defense.

## Handoff
A genuinely public, PII-safe accountability page exists. Tag `phase-13-done`.
