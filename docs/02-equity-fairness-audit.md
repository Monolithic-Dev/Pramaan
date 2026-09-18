# Feature 2: Equity & Fairness Audit

## Why this is unique
Your scoring formula already takes a `vulnerability_score` as an input. This feature asks the
harder question almost no competing team will ask: *does the system actually treat vulnerable
areas fairly in practice, or just claim to in the formula?* Building a dashboard that would
catch your own system being unfair is a genuinely rare, judge-memorable signal of responsible AI
thinking — and it costs relatively little since it's mostly a new query over data you already have.

## What to build

### Minimum viable version (~2 days)
- `apps/worker-ai-pipeline/src/equity/auditJob.ts`: a scheduled job (daily is fine) that groups
  all `Issue`s in a state by `vulnerability_score` band (e.g., low/medium/high, from the existing
  `InfraIndex`-derived score), and computes per band: average `composite_score`, average days
  from `first_reported_at` to `verified` status, average days to `resolved` status, and the
  ratio of issues that reached `status: "funded"` or beyond.
- New entity: `EquityAuditReport { report_id, state_id, period_start, period_end, vulnerability_band, avg_composite_score, avg_days_to_verified, avg_days_to_resolved, funded_ratio, sample_size, computed_at }`.
- Minimum sample-size guard: if `sample_size` for a band is below a threshold (e.g. 5), the
  report marks that band `"insufficient_data"` instead of publishing a misleadingly precise
  number — same principle as `docs/EDGE_CASES.md`'s data-gap handling elsewhere.
- New endpoint: `GET /equity-audit?state=` (state admin / policymaker only).
- New UI tab in the dashboard: a simple bar chart (average composite score by vulnerability
  band, average days-to-resolution by band) with a one-line plain-language verdict generated the
  same grounded way as `docs/AI_PIPELINE.md` Stage 6 — e.g. *"High-vulnerability areas in this
  state currently wait 40% longer for verification than low-vulnerability areas."* — grounded in
  the actual numbers, checked the same way `groundingCheck.ts` checks the policymaker briefs.

## Demo moment
Open the Equity tab and read the generated verdict line aloud, whatever it actually says —
including if it reveals a real disparity: *"We don't just claim our prioritization is fair — we
built the dashboard that would catch us if it wasn't, and here's what it's currently showing."*
Showing a real (even mildly imperfect) finding is more credible than a suspiciously perfect one.

## Watch out for
- Don't let this become another opaque score — the plain-language verdict must cite the same
  real numbers shown in the chart, nothing invented.
- Don't publish a band's stats below the minimum sample size — a "0% funded, sample size 1"
  headline is misleading, not honest.

## Effort
~2 days (mostly the BigQuery aggregation job + one new dashboard tab; no new AI pipeline stage
needed beyond the grounded verdict line, which reuses Stage 6's pattern).
