# Phase 14 of 16: Instant State Onboarding Demo

## Header
- **Goal (done = ):** An admin can add a new state to the platform live, through a UI form,
  with zero code deployment, and see it immediately usable in the dashboard's state filter.
- **Preconditions:** Phase 2 (`generateReferenceData.ts` exists), Phase 7 (dashboard state
  filtering). Independent of Phases 10/11/12 — can run in parallel.
- **Specs implemented:** `docs/advanced-features/05-instant-state-onboarding-demo.md`.

## Task breakdown
1. `apps/api-gateway/src/routes/adminStates.ts`:
   `POST /admin/states {stateName, referenceDataCsvUrl | useSampleData: true}` — gated to a
   `platform_owner` permission (extend the RBAC role set from Phase 7/9 with this new
   permission if it doesn't already exist; do not just reuse `state_admin` unmodified, since
   creating a whole new state is a materially bigger action than administering one).
2. **Refactor, don't duplicate:** extract Phase 2's `generateReferenceData.ts` CLI logic into an
   importable function, then call that function from this endpoint's handler. This is the actual
   engineering proof behind the "config change, not a rewrite" architecture claim — if this
   phase writes a second, separate data-loading code path instead, it undermines the claim
   rather than demonstrating it.
3. On success: create a `states` collection doc (`{state_id, display_name, created_at, created_by}`), load a small starter `InfraIndex` sample for the new state (from the uploaded CSV or a
   bundled sample dataset for demo purposes).
4. `apps/web/src/routes/admin/AddStatePage.tsx`: form with a state name input, a toggle for
   "use sample data" vs. CSV upload, a submit button, and a success confirmation showing the new
   state now selectable.
5. Make the dashboard's state filter dropdown read from the `states` collection dynamically, if
   it was still a hardcoded list from Phase 7.
6. Unit tests: `"POST /admin/states from a non-platform-owner role returns 403"`,
   `"a successful call creates a states doc and at least one InfraIndex row for the new state"`,
   `"the new state appears in a subsequent GET /issues?region= call's valid region list"`.
7. E2E test (Playwright): `"admin adds a new state via the UI using sample data, and it appears in the dashboard's state filter without a page redeploy."`

## Real-world engineering concerns
- This must call the actual Phase 2 script's logic (task 2), not a reimplementation — a second
  code path here is the exact failure mode that would quietly break the architecture's
  federation story even while this feature's demo looks fine.
- Keep this tightly admin-gated — this is precisely the kind of endpoint that would be a real
  problem if reachable by a regular officer account.

## Definition of done
- [ ] A platform owner can add a new state through the UI and see it live in the dashboard
      within the same session, with no redeploy.
- [ ] A non-privileged role attempting this gets `403`.
- [ ] The underlying logic is confirmed to be the same function Phase 2's script uses, not a
      duplicate.
- [ ] All tests in task 6-7 pass.

## Risks & blockers
- If Phase 2's script has side effects baked into a `main()` function rather than a clean
  exported function, the refactor (task 2) may take longer than expected. Budget explicit time
  for it rather than assuming it's a trivial import change.

## Time budget
**1 day.** If it runs long, cut: CSV upload support — ship with "use sample data" only for the
demo, document CSV upload as a fast-follow. Do **not** cut: reusing the real Phase 2 logic — it's
the entire point of this feature.

## Handoff
The federation/scalability claim is now live-demoable, not just documented. Tag
`phase-14-done`.
