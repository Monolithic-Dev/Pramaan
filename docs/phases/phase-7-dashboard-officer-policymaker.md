# Phase 7 of 9: Frontend + Backend — Officer/Policymaker Dashboard

## Header
- **Goal (done = ):** An authenticated officer/policymaker can open `/dashboard`, see a ranked, mapped list of prioritized issues with grounded briefs, and verify/dispute issues — fully wired end-to-end.
- **Preconditions:** Phase 3 (auth middleware shape exists). UI work can start against mocked data before Phase 5 finishes, per the parallelization note in Phase 1's Plan at a Glance; full integration needs Phase 4/5 output.
- **Specs implemented:** `API_SPEC.md` §3-4, `PRD.md` §6.4, `DATA_MODEL.md` (`OfficerUser`).

## Task breakdown
1. `apps/api-gateway/src/routes/issues.ts`: implement `GET /issues?region=&status=&category=&min_score=` and `GET /issues/{issue_id}` per `API_SPEC.md` §3. Enforce the officer's `jurisdiction` claim as a mandatory server-side filter — never trust a client-supplied region broader than the officer's own jurisdiction.
2. `apps/api-gateway/src/routes/issues.ts`: implement `POST /issues/{issue_id}/verify` and `POST /issues/{issue_id}/dispute` — check `issue.geo_cluster.admin_boundary` falls within `request.officer.jurisdiction` before allowing the write, else `403 JURISDICTION_MISMATCH`. Write an audit entry to `auditLogs`: `{actor, action, issue_id, before_status, after_status, timestamp}`.
3. `apps/api-gateway/src/routes/priorities.ts`: implement `GET /priorities?region=&limit=` per `API_SPEC.md` §4, reading pre-scored `Project` docs, cached with a short TTL (e.g. 60s) since scoring only updates every 15 minutes (Phase 5, task 5).
4. Complete the Identity Platform SSO integration stubbed in Phase 3's middleware — issue JWTs carrying `role` and `jurisdiction` claims from an `officerUsers` Firestore lookup keyed on the SSO identity.
5. `apps/web/src/routes/dashboard/DashboardPage.tsx`: role-gated route (redirects non-officers), layout with a map panel and a ranked-list panel.
6. `apps/web/src/routes/dashboard/components/PriorityMap.tsx`: Google Maps JS API integration, markers colored by `composite_score` band, clicking a marker opens the issue detail panel.
7. `apps/web/src/routes/dashboard/components/RankedList.tsx`: renders `GET /priorities` results — score badge, category, `generated_brief`, and a visible score-breakdown expander (demand/vulnerability/gap/duplication) so the "explainable, not black box" claim is directly checkable by anyone looking at it.
8. `apps/web/src/routes/dashboard/components/IssueDetail.tsx`: full `Issue` detail, linked submission count, verify/dispute buttons wired to tasks 1-2.
9. `apps/web/src/routes/dashboard/hooks/useIssues.ts` / `usePriorities.ts`: data-fetching hooks with loading/error states, jurisdiction-filtered automatically via the JWT — the officer never manually selects "their own" region.
10. Unit tests: `"GET /issues with an officer JWT scoped to Ward 14 never returns issues outside Ward 14, even if region= is manually overridden in the query string"`, `"POST /issues/{id}/verify from an officer outside the issue's jurisdiction returns 403"`.
11. E2E test (Playwright): `"officer logs in, sees a ranked list scoped to their jurisdiction, opens an issue, and successfully marks it verified"`.

## Real-world engineering concerns
- **Task 1's jurisdiction enforcement is the single most important authorization check in the system** — a dashboard that leaks another district's/state's data is a credible-sounding but disqualifying flaw for a "deployable in a ministry" pitch. Test the negative case (task 10) as carefully as the happy path.
- **Cache freshness:** a manual cache-bust on write is simpler and safer under time pressure than tuning a TTL precisely — an officer who just verified an issue shouldn't see stale data on refresh.

## Definition of done
- [ ] An officer authenticated for Ward 14 sees only Ward 14 issues, confirmed by the negative test in task 10.
- [ ] The ranked list shows a visible score breakdown per issue, not just a single number.
- [ ] Verifying an issue updates its status in Firestore and appears correctly in the audit log.
- [ ] The Playwright e2e test in task 11 passes against the real deployed staging environment, not just mocks.

## Risks & blockers
- Google Maps JS API billing/quota setup is a common last-minute surprise. **Mitigation:** confirm the API key and billing are active on day 1 of this phase, not the day of the demo.

## Time budget
**5 days**, starting once Phase 3 is done, overlapping the tail of Phase 4/5. If it runs long, cut: the map view (task 6) — a well-designed ranked list alone still demonstrates the core value; a map is a strong visual but not load-bearing. Do **not** cut: jurisdiction enforcement (tasks 1-2, 10) — this is a security-critical, judge-visible correctness property.

## Handoff
A real officer can log in and act on real, scored, grounded data. Tag `phase-7-done`. Phase 8 can now build the resolution/impact flow on top of a working verify/mark-complete action point.
