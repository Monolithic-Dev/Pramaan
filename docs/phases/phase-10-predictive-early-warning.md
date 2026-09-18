# Phase 10 of 16: Predictive Early-Warning Engine

## Plan at a glance (advanced-feature phases 10-16)

| # | Phase | Time budget | Depends on |
|---|---|---|---|
| 10 | Predictive Early-Warning Engine | 2 days | Phases 2, 5, 7 |
| 11 | Citizen Explainability Portal | 1 day | Phases 3, 5 — independent, can run in parallel |
| 12 | Equity & Fairness Audit | 2 days | Phases 2, 5 |
| 13 | Public Transparency Ledger | 1 day | Phase 5, optionally 12 |
| 14 | Instant State Onboarding Demo | 1 day | Phases 2, 7 — independent, can run in parallel |
| 15 | Agentic Policy Co-Pilot | 2-3 days | Phases 3, 7, 10, 12 — build last, only once stable |
| 16 | Integration, Pitch Deck/Video Update & Final Rehearsal | 3 days | Phases 10-15 |

**Suggested day map for the ~12 days remaining, with a 3-4 person team split into two tracks:**
Days 1-2 → Phase 10 (Track A). Days 1-2 (parallel) → Phase 11 (Track B). Days 3-4 → Phase 12
(Track A). Days 3-4 (parallel) → Phase 14 (Track B). Day 5 → Phase 13 (either track, free
capacity). Days 5-7 → Phase 15 (Track A, needs 10 and 12 done). Days 8-10 → Phase 16 (whole
team). Days 11-12 → buffer.

The critical path is 10→12→15→16 (≈10 days). Phases 11, 13, 14 are lower-effort and largely
independent — use them to keep a second person productive without blocking the critical path.

---

## Header
- **Goal (done = ):** Officers/policymakers see `RiskForecast` markers on the dashboard map for
  geo-clusters with a recurring, unaddressed seasonal issue pattern — computed from real
  historical data, with zero citizen reports required to trigger a forecast.
- **Preconditions:** Phases 1-9 complete, specifically Phase 2's BigQuery reference data, Phase
  5's scoring/BigQuery join patterns, and Phase 7's dashboard map.
- **Specs implemented:** `docs/advanced-features/01-predictive-early-warning.md`,
  `docs/AI_PIPELINE.md` (pattern reuse), `docs/DATA_MODEL.md` (new entity).

## Task breakdown
1. `packages/shared-types`: add the `RiskForecast` interface exactly per
   `01-predictive-early-warning.md`'s shape.
2. Add a new BigQuery table `issue_events` (`geo_cluster_id`, `category`, `created_at`,
   `state_id`) and have `worker-ai-pipeline` write a row to it every time an `Issue` is created
   or merged into — Firestore isn't the right tool for grouped multi-year time-series analysis,
   BigQuery already is, per the project's existing storage split.
3. **Backfill:** write a one-time script to populate `issue_events` from existing `Issue`
   documents' `first_reported_at`/`last_reported_at` and `submission_ids` history, so this
   feature isn't starting from zero historical data on demo day.
4. `apps/worker-ai-pipeline/src/forecasting/seasonalPattern.ts`: `computeSeasonalRisk(geoClusterId, category)` — queries `issue_events` grouped by month across all available years for this cluster+category, flags a recurring seasonal spike (same month range exceeding the yearly average in at least 2 of the last N years), then checks whether it was ever addressed via the existing gap-score investment lookup pattern.
5. `apps/worker-ai-pipeline/src/forecasting/scheduler.ts`: `POST /jobs/compute-forecasts`, Cloud
   Scheduler triggered weekly, iterates active geo-clusters with sufficient history and writes
   `RiskForecast` docs.
6. `apps/api-gateway/src/routes/forecasts.ts`: `GET /forecasts?region=&category=`,
   jurisdiction-scoped identically to `GET /issues`.
7. `apps/web` dashboard: `PriorityMap.tsx` renders `RiskForecast` markers in a visually distinct
   style (e.g. dashed outline) from real `Issue` markers — never blur the distinction between a
   forecast and an actual report.
8. Insufficient-data handling: if history spans less than 2 years or has too few events,
   `computeSeasonalRisk` returns `null` — no forecast is written, rather than a fabricated one.
9. Unit tests: `"a cluster with a 2-year recurring monsoon spike in water issues, unaddressed by investment, returns risk_level high"`, `"a cluster with insufficient history returns no forecast"`, `"a cluster whose recurring issue was already funded returns a lower or no risk level"`.
10. Integration test: seed synthetic `issue_events` for 2+ years on a test cluster, run
    `computeSeasonalRisk`, confirm the `RiskForecast` is written correctly and visible via
    `GET /forecasts`.

## Real-world engineering concerns
- `computeSeasonalRisk` must never run in the citizen-facing request path — it's a scheduled
  batch job, the same reasoning as the existing scoring scheduler in Phase 5.
- The backfill script (task 3) is easy to skip under time pressure and easy to regret on demo
  day when the forecast has nothing to work with — treat it as part of this phase, not optional.

## Definition of done
- [ ] `issue_events` exists and is populated going forward by real Issue creation/merge events.
- [ ] A test cluster with 2+ years of synthetic seasonal history produces a correct
      `RiskForecast`.
- [ ] `GET /forecasts` respects jurisdiction scoping identically to `GET /issues`.
- [ ] The map renders forecast markers visually distinct from Issue markers.
- [ ] All tests in task 9-10 pass.

## Risks & blockers
- Retrofitting historical `issue_events` for pre-existing clusters (task 3) is easy to forget —
  budget explicit time for it; a forecast feature with no history to draw on is not demoable.

## Time budget
**2 days.** If it runs long, cut: the weekly Cloud Scheduler automation — compute forecasts via
a manually-triggered script before the demo instead. Do **not** cut: the insufficient-data guard
(task 8) — a fabricated-looking forecast is worse than none.

## Handoff
Officers see real, data-grounded forecast markers with zero reliance on new citizen reports. Tag
`phase-10-done`. Phase 15's `getForecasts` tool can now wrap this real endpoint.
