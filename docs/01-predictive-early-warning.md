# Feature 1: Predictive Early-Warning Engine

## Why this is unique
Every competing team will build a system that reacts to citizen reports. This makes JanSetu
predict *before* the reports arrive — the pitch line changes from "we collect complaints
efficiently" to "we told the district a water crisis was coming before it happened." It also
directly uses "predictive modelling," a category the hackathon brief names explicitly alongside
GenAI and computer vision — most teams will only touch the GenAI category.

## What to build

### Minimum viable version (build this — ~1 day)
A deterministic, explainable seasonal-pattern heuristic, not a trained model:
- `apps/worker-ai-pipeline/src/forecasting/seasonalPattern.ts`: `computeSeasonalRisk(geoClusterId, category)` — queries BigQuery for this cluster+category's historical `Issue` creation dates over the past 2+ years, checks whether a recurring seasonal spike exists (e.g., water/road issues clustering in monsoon months), and whether the underlying cause was ever addressed (join against `investment_record`, same pattern as `getGapScore`).
- If a recurring, unaddressed seasonal pattern exists and the relevant season is within `RISK_WINDOW_DAYS` (default 45), write a `RiskForecast` document.
- New entity in `packages/shared-types`: `RiskForecast { forecast_id, geo_cluster_id, category, risk_level (low/medium/high), predicted_window_start, predicted_window_end, contributing_factors (string[]), model_version: "seasonal-heuristic-v1", computed_at }`.
- New endpoint: `GET /forecasts?region=&category=` (officer/policymaker, jurisdiction-scoped like `GET /issues`).
- New map layer: `PriorityMap.tsx` renders `RiskForecast` markers in a visually distinct style (e.g., dashed outline) from actual reported `Issue`s — a forecast is not a report, and the UI must never blur that distinction.

### Stretch version (only if Tier 1 core is done early)
Replace the heuristic with a real Vertex AI AutoML Forecasting model trained on the same
historical data — same `RiskForecast` output shape, `model_version: "automl-v1"`, and worth
demoing as an explicit A/B: "here's the deterministic version, here's what a trained model adds."
Keep the heuristic as the fallback regardless — same explainability principle as the composite
scoring formula in `docs/AI_PIPELINE.md`.

## Demo moment
On the officer dashboard map, point to a dashed-outline marker with zero linked citizen reports:
*"No one has reported anything here yet. Based on two monsoons of pattern data and zero
follow-up investment, we're already flagging this district as high-risk — this is the
'predictive modelling' category the brief calls for, not just generative AI."*

## Watch out for
- A forecast with no historical basis (cold-start region) — must explicitly return "insufficient
  data" rather than fabricate a risk level, same disclosure principle as a missing `InfraIndex`
  row in `docs/EDGE_CASES.md` #7.
- Never let a `RiskForecast` silently feed into the citizen-facing priority score — it's a
  distinct, clearly-labeled signal for officers, not a demand signal from real citizens.

## Effort
~2 days for the heuristic version end-to-end (backend + map layer); +1-2 days if pursuing the
AutoML stretch.
