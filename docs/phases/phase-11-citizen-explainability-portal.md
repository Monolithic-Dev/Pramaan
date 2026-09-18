# Phase 11 of 16: Citizen Explainability Portal

## Header
- **Goal (done = ):** A citizen can look up their own submission's status, in their own
  language, and see the same grounded justification an officer sees — with zero new AI calls
  and zero leakage of other citizens' data.
- **Preconditions:** Phase 3 (submissions/auth), Phase 5 (`Project.generated_brief` exists).
  Independent of Phases 10/12/14 — can run in parallel with them.
- **Specs implemented:** `docs/advanced-features/03-citizen-explainability-portal.md`.

## Task breakdown
1. Add an `issue_id` field to the `Submission` entity (`packages/shared-types` +
   `docs/DATA_MODEL.md` addendum) so a submission can be traced directly to its canonical
   `Issue` without a reverse search.
2. Backfill: for existing `Submission` docs lacking `issue_id`, run a one-time script that
   derives it from `Issue.submission_ids` arrays.
3. `apps/api-gateway/src/routes/myReports.ts`: implement
   `GET /my-reports/{submission_id}/status` — ownership check (`request.citizen_id` must match
   `Submission.citizen_id`, else `403`), fetch the linked `Issue` via `issue_id` (fall back to
   the reverse `Issue.submission_ids` search only if `issue_id` is missing, per task 2's
   backfill gap).
4. Response assembly: `status`, `report_count`, a **plain-language priority band**
   (`composite_score >= 0.6` → "high", `>= 0.35` → "medium", else "low" — never expose the raw
   score), and a citizen-friendly, translated rephrasing of `Project.generated_brief` (reuse the
   existing Translation API path — no new AI generation call).
5. `apps/web/src/routes/status/StatusPage.tsx`: OTP-gated (reuse the existing OTP flow), takes a
   `submission_id`, renders the assembled response in the citizen's language.
6. Update `ConfirmationScreen.tsx` (Phase 6) to show a persistent "check status later" reference
   the citizen can save.
7. Privacy check (explicit step, not assumed): confirm the response never includes another
   citizen's `submission_id`, raw text, or photo — only the aggregate `report_count` and the
   shared `Project`-level brief.
8. Unit tests: `"GET /my-reports/{id}/status from a non-owning citizen returns 403"`,
   `"the response never includes another reporter's identifying fields"`,
   `"composite_score never appears in the raw response, only the mapped priority_band"`.
9. E2E test (Playwright): `"citizen submits a report, later returns with their submission_id and OTP, and sees a status page in their selected language."`

## Real-world engineering concerns
- Deliberately zero new AI generation here — reusing the existing grounded brief avoids
  doubling the hallucination-risk surface this late in the build.
- The `issue_id` backfill (task 2) should be a one-time script, not a runtime fallback relied on
  forever — the fallback path exists for safety, not as the primary lookup.

## Definition of done
- [ ] A citizen can retrieve their own status; a non-owner gets `403`.
- [ ] The response never contains another citizen's data or the raw `composite_score`.
- [ ] The status page renders correctly in at least 2 of the demo languages.
- [ ] All tests in task 8-9 pass.

## Risks & blockers
- If `issue_id` wasn't captured historically, the reverse-search fallback could be slow at real
  scale — acceptable at hackathon demo scale, worth a one-line note in `docs/DEPLOYMENT.md`'s
  future-work section rather than over-engineering now.

## Time budget
**1 day.** If it runs long, cut: the "check status later" persistent-link UX polish (task 6) — a
citizen can paste their `submission_id` manually for the demo. Do **not** cut: the
ownership/`403` check (task 3, 8) or the no-PII-leakage guarantee (task 7) — these are exactly
what a judge would test first.

## Handoff
Citizens have working, privacy-safe visibility into their own report's status. Tag
`phase-11-done`.
