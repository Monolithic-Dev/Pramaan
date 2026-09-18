# Phase 12 of 16: Equity & Fairness Audit

## Header
- **Goal (done = ):** A state admin can open an Equity tab and see a real, grounded verdict on
  whether high-vulnerability areas are served proportionally — computed from actual scored data,
  with a minimum-sample-size guard against misleading conclusions.
- **Preconditions:** Phase 5 (`PriorityScore` with `vulnerability_score`), Phase 2 (BigQuery
  `infra_index`).
- **Specs implemented:** `docs/advanced-features/02-equity-fairness-audit.md`.

## Task breakdown
1. `packages/shared-types`: add the `EquityAuditReport` interface per the spec.
2. `apps/worker-ai-pipeline/src/equity/bandAssignment.ts`:
   `assignVulnerabilityBand(vulnerabilityScore)` — maps the continuous score to low/medium/high
   using fixed, named-constant thresholds.
3. `apps/worker-ai-pipeline/src/equity/auditJob.ts`:
   `computeEquityAudit(stateId, periodStart, periodEnd)` — BigQuery query joining
   `priority_score_history` and issue metadata, grouped by vulnerability band, computing
   `avg_composite_score`, `avg_days_to_verified`, `avg_days_to_resolved`, `funded_ratio`, and
   `sample_size` per band.
4. Minimum sample-size guard: any band with `sample_size < MIN_EQUITY_SAMPLE_SIZE` (default 5)
   is marked `insufficient_data: true` instead of publishing a computed average.
5. `apps/worker-ai-pipeline/src/equity/scheduler.ts`: `POST /jobs/compute-equity-audit`, Cloud
   Scheduler triggered daily, writes `EquityAuditReport` docs.
6. `apps/api-gateway/src/routes/equityAudit.ts`: `GET /equity-audit?state=`
   (`state_admin`/policymaker role only).
7. `apps/worker-ai-pipeline/src/equity/verdictGenerator.ts`: reuses the Stage 6 grounding
   pattern from `docs/AI_PIPELINE.md` — pass the real band numbers into a prompt, generate a 1-2
   sentence plain-language verdict, run it through the existing `groundingCheck.ts` before it
   ships. Example output: *"High-vulnerability areas currently wait 40% longer for verification
   than low-vulnerability areas in this state."*
8. `apps/web/src/routes/dashboard/components/EquityTab.tsx`: a bar chart (composite score /
   resolution days by band) plus the verdict text, `state_admin`-gated.
9. Unit tests: `"a band with sample_size below threshold is marked insufficient_data and excluded from the verdict"`, `"verdict text contains only numbers present in the computed bands (grounding check reused)"`, `"band assignment thresholds correctly bucket a range of vulnerability scores"`.
10. Integration test: seed synthetic scored issues across 3 vulnerability bands with a realistic
    disparity, run `computeEquityAudit`, confirm the report and generated verdict match the
    seeded disparity direction.

## Real-world engineering concerns
- Reusing `groundingCheck.ts` here rather than writing a parallel verdict-validation mechanism
  keeps this consistent with the project's one existing hallucination-defense pattern, instead
  of introducing a second one this late in the build.
- This report is explicitly **not** fed back into the scoring formula automatically — it's a
  monitoring/disclosure tool, not a live weight-adjustment mechanism. Conflating the two would
  need far more careful design than remaining time allows.

## Definition of done
- [ ] A state with a genuine seeded disparity produces a verdict that accurately reflects it.
- [ ] A band below the minimum sample size is excluded, not shown with a misleadingly precise
      number.
- [ ] The Equity tab is only visible to `state_admin`/policymaker roles.
- [ ] All tests in task 9-10 pass.

## Risks & blockers
- If the demo dataset has no genuine disparity, the feature will honestly report "no significant
  disparity found" — less demo-compelling but still correct. Consider deliberately seeding a
  realistic disparity into the synthetic dataset for demo purposes, clearly documented as
  synthetic, not fabricated as real-world fact.

## Time budget
**2 days.** If it runs long, cut: the daily scheduler automation — run `computeEquityAudit` as a
manually-triggered script before the demo. Do **not** cut: the minimum-sample-size guard or the
grounding check on the verdict text — these are exactly what a skeptical judge would probe.

## Handoff
A real, grounded equity signal exists and is visible to state admins. Tag `phase-12-done`.
Phase 15's `getEquityAudit` tool can now wrap this real endpoint.
