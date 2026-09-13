# Phase 9 of 9: Security Hardening, Deployment & Demo Prep

## Header
- **Goal (done = ):** The system is deployed to a stable public URL, every endpoint's authorization is verified by a dedicated pass (not just per-phase spot checks), a realistic synthetic dataset is loaded, and the team has rehearsed the demo at least once against the real environment.
- **Preconditions:** Phases 1-8 all complete and individually tagged.
- **Specs implemented:** `SECURITY_PRIVACY.md` (all), `DEPLOYMENT.md` (all), `TESTING.md` §4-6.

## Task breakdown
1. Authorization audit: write `apps/api-gateway/src/routes/__authAudit__.test.ts` — a single file that iterates every protected route in `API_SPEC.md` and confirms `401`/`403` for missing/wrong-role/wrong-jurisdiction tokens. This is a deliberate cross-cutting pass, not a rerun of each phase's own tests — it specifically catches interactions between phases (e.g. an endpoint that doesn't correctly reuse Phase 3's jurisdiction-scoping helper).
2. Secrets audit: scan git history for committed secrets (e.g. `gitleaks detect`). Move anything found into Secret Manager and rotate it immediately.
3. Finalize per-service Cloud Run deploy configs: `api-gateway` (min instances 1, per `DEPLOYMENT.md` §3), `worker-ai-pipeline` (scales with Pub/Sub queue depth) — each with the correct service account and Secret Manager bindings.
4. Update the Pub/Sub push subscription (placeholder from Phase 1, task 11) to point at the real deployed `worker-ai-pipeline` URL.
5. Deploy `apps/web` to Firebase Hosting with the production API base URL configured.
6. Set up Cloud Monitoring dashboards and the alert policy from `DEPLOYMENT.md` §6 (e.g. Gemini API error rate > 5% over 5 minutes).
7. `scripts/seed-demo-data/generateSubmissions.ts`: full implementation per `TESTING.md` §4 — generate 1,000-2,000 geographically-clustered synthetic submissions across the demo states/languages/categories, including a deliberate mix of heavy-duplicate clusters, at least one flagged-burst example, and at least one fully `resolved` project with citizen confirmations. Run against the production Firestore project.
8. Run the load test from `TESTING.md` §5 against `POST /submissions` at the specified burst rate; capture the results — even if imperfect — for the pitch deck's "deployable at scale" slide.
9. Run the full manual QA checklist from `TESTING.md` §6, end to end, in order, as if the person running it were a judge.
10. Record the 3-5 minute demo video: a live voice submission in a non-English language → visible dedup against a seeded duplicate → the officer dashboard with a grounded brief and its score breakdown → the impact-confirmation flow on a pre-seeded resolved project.
11. Assemble the submission package: clean the GitHub repo (remove dead branches, confirm `docs/` is present and linked from root `README.md`), finalize the 10-12 slide pitch deck mapped to the five judging criteria, write the 2-3 line description, and confirm the live deployed link works cold with no prior state.

## Real-world engineering concerns
- **Task 1's cross-cutting authorization audit is mandatory, not optional** — per-phase testing tends to catch the happy path for that phase's own new endpoint but misses cross-phase interactions.
- **Demo-day fragility:** rehearse against the actual production URL at least 24 hours before presenting, not the staging environment and not the night before, per `DEPLOYMENT.md` §7.

## Definition of done
- [ ] `git log`/`gitleaks` scan is clean of secrets.
- [ ] The authorization audit test file (task 1) passes for every endpoint in `API_SPEC.md`.
- [ ] The production URL, opened cold with no prior state, shows a populated dashboard and allows a full citizen submission end-to-end.
- [ ] The demo video exists, is 3-5 minutes, and shows real (not staged/faked) interactions.
- [ ] The submission package is complete against the hackathon's requirements checklist: source code, demo video, pitch deck, description, deployed link.

## Risks & blockers
- Anything found in task 1's audit or task 2's secrets scan this late is expensive to fix — this is exactly why this phase exists as a dedicated, non-skippable pass rather than "whatever's left over." If time is critically short, protect this phase's time budget before protecting any stretch goal from earlier phases.

## Time budget
**3 days, plus a 1-day buffer** given this is the last phase before the deadline. If it runs long, cut: the load test (task 8) can be reduced to a smaller burst size, reported honestly as "tested at N req/min, architecture supports scaling further via Cloud Run autoscaling" rather than skipped outright. Do **not** cut: the authorization audit, the secrets scan, or the demo rehearsal — these are the three things most likely to cause either a security embarrassment or a broken live demo.

## Handoff
Submission-ready. Tag `phase-9-done` / `submission-v1`. This is the last phase — there is no next phase, only the actual submission.
