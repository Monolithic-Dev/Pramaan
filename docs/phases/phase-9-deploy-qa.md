# Phase 9 of 10: Deploy, Seed & QA

**Days 14-15 · All tracks · Feature freeze in effect**

## Objective
Production stable, dataset loaded, the full flow rehearsed ten times, load tested, and a fallback ready for demo day.

**No new features.** If something is broken, fix or cut it. If something is missing, it stays missing.

## Prerequisites
Phases 1-8 complete.

## Reference docs
`DEPLOYMENT.md` · `TESTING.md` §5, §6

---

## Deliverables

### 9.1 Production deployment
Every service to prod behind the real URL. You have been deploying since Day 1 (Phase 1), so this is verification rather than first contact.

| Service | Config |
|---|---|
| api-gateway | Cloud Run, `min-instances: 1` |
| worker-ai-pipeline | Pub/Sub triggered, concurrency 10 |
| prioritisation-engine | Cloud Scheduler, 15 min |
| web | Firebase Hosting + CDN |

`min-instances: 1` on the API is non-negotiable for demo day. A cold start while a judge waits is a fixable problem you should have already fixed.

### 9.2 Seed production
Full dataset: ~1,500 submissions → processed through the real pipeline → issues → scores. Plus the Brazilian slice.

**Run the pipeline for real. Do not import pre-computed issues.** The whole point is that the dedup and scoring you demo are the ones that ran.

Verify after seeding:
- Issue count in the expected range
- At least one cluster with 12+ merged submissions across 3 languages
- Priority list populated with variance in scores
- One resolved project with confirmations
- One flagged burst cluster
- Brazilian regions present and queryable

### 9.3 Load test
k6 or Locust: 500 submissions/minute for 2 minutes against `POST /submissions`.

Success = ingestion p95 stays under 2s while the AI pipeline queue backs up behind it. That is the architectural claim — Pub/Sub decoupling means citizen latency is independent of AI latency. **Save the graph.** It goes on the Deployability slide and it is a concrete answer to "could this scale" that most submissions answer with an assertion.

### 9.4 Ten full rehearsals
Run the complete judge path ten times, end to end, exactly as a judge would:

1. Open the deployed URL on a phone
2. Switch to Hindi, record a voice complaint
3. Submit, see the confirmation, hear the read-back
4. Open the officer view, watch the new submission merge into an existing issue
5. Ask the agent: "What are the top 3 unaddressed road issues in Ward 14, and are they already funded?"
6. Watch tool chips fire, read the cited answer
7. Ask something unanswerable, get a refusal that names what is missing
8. Open the score breakdown, read the fallback disclosure
9. Generate a brief, open the citation panel
10. Mark a project complete, confirm as a citizen
11. Switch country to Brazil, ask the same question in Portuguese

Log every failure. Fix or cut. Rehearsal ten must be clean.

### 9.5 Full QA checklist
`TESTING.md` §6, plus:
- [ ] Voice input live in 2+ languages on a real phone on mobile data
- [ ] Live submission visibly triggers dedup against a seeded issue
- [ ] Dashboard loads under 3s with the full dataset
- [ ] Brief displays its underlying numbers so groundedness can be verified on the spot
- [ ] Impact loop demonstrated with a pre-seeded example
- [ ] Refusal demonstrated
- [ ] Country switch demonstrated
- [ ] Every synthetic-data badge visible
- [ ] Works on iOS Safari and Android Chrome
- [ ] Works on hotel/venue-grade WiFi (test on a genuinely bad connection, not the office)

### 9.6 Fallback plan
- The 3-5 minute demo video doubles as the fallback if the live environment fails.
- Screenshots of every key screen, on a local device, not in cloud storage.
- A one-command rollback to the last known-good revision, tested at least once.
- Offline copy of the deck.

### 9.7 Judge-readiness pass
Open the repo as a stranger would:
- Does the README explain the project in 30 seconds?
- Is the deployed link prominent and working?
- Does the architecture diagram render on GitHub? Verify the corrected one in `ARCHITECTURE.md` renders in the actual GitHub preview, not just locally.
- Is the attribution table complete?
- Is `LICENSE` present?
- Is `Improvements.md` gone?
- Can someone follow the README and run it locally?

---

## Acceptance criteria

- [ ] All services live on prod URLs, reachable from an external phone on mobile data
- [ ] Full dataset processed through the real pipeline in prod
- [ ] Load test: ingestion p95 < 2s at 500/min; graph saved
- [ ] Ten consecutive clean rehearsals of the full judge path
- [ ] Rollback to the previous revision tested and timed
- [ ] Architecture diagram renders correctly in GitHub's preview
- [ ] Repo passes the judge-readiness pass
- [ ] Demo video footage captured for every step (recorded during rehearsals, not performed on Day 16)
- [ ] Fallback screenshots stored locally on at least two devices

## Definition of done
You could hand the URL to a stranger with no explanation and they would understand what Pramaan does within two minutes.

## Traps
- Firestore emulator behaviour differs from production on composite indexes and transactions. Anything you only tested against the emulator is untested.
- Cloud Run cold starts during rehearsal mean `min-instances` is not set correctly.
- Seeding 1,500 submissions through the live pipeline costs real Gemini calls. Budget for it (`BUILD_PLAN.md`), and do not re-seed casually — this is the most likely source of a credit overrun.
- Venue WiFi will be worse than you expect. If the app needs good connectivity to demo, it fails on stage.

## Handoff
Submission-ready system, live and rehearsed. Tag `phase-9-done`. Phase 9b assembles the actual submission package — or, if the advanced-feature phases (`docs/advanced-features/`, phases 10-16) are being built, continue there and let Phase 16 finalize submission instead.
