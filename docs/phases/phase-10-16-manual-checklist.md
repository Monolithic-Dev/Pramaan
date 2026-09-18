# Phases 10-16 — what's built vs. what needs you

All six differentiator features from `docs/README.md` are implemented in `api-gateway` +
`web`, unit-tested (88 api-gateway tests). Deliberate deviations from the feature docs:

| Feature | Built | Deviation / gap |
|---|---|---|
| 1 Early-warning | `GET /forecasts`, `insights/forecasting.ts`, dashed-outline cards in the officer Insights panel | Computed on read from Firestore Issue history (not a scheduled worker job, not persisted): deterministic, so nothing goes stale. No map layer yet (the map itself is still a placeholder). AutoML stretch not attempted. `geo_cluster_id` holds the AdminRegion id. |
| 2 Equity audit | `GET /equity-audit` (state_admin only), bands, n>=5 guard, templated grounded verdict | `avg_days_to_verified` omitted (Issue has no verified timestamp). Verdict is templated from the chart's own numbers rather than Gemini-generated. Bar chart is text rows, not a chart. |
| 3 Citizen portal | `GET /my-reports/{id}/status` + `/status` page, owner-only, plain-language priority band | Brief is not translated (no Translation API client exists); UI labels are localized, the brief text is in its source language. Token is pasted (dev), same as officer login. |
| 4 Co-pilot | Existing agent (Phase 6) extended with `get_risk_forecasts` and `get_equity_audit` tools; scope guard, grounding check, tool-round cap and trail UI already existed | No separate `POST /copilot/ask`: the session-based agent is the co-pilot. Cap is 5 tool rounds (existing), not 4. |
| 5 State onboarding | `POST /admin/states`, `GET /states`, admin form in the Insights panel | Registers the state in Firestore only. It does **not** load BigQuery reference data: run `scripts/seed-demo-data` for that. Dashboard state filter is not wired to the list yet. |
| 6 Transparency ledger | `GET /public/transparency` (no auth, 60 req/min/IP, min count 5, aggregates only) + `/transparency` page | Run the PII checklist (`senior-security`) once more before a public deploy. |

## You still need to
1. Deploy + seed (see phase 3/5 checklists); forecasts/equity need real accumulated Issues.
2. Native-speaker review of the new hi/ta/pt strings.
3. Phase 16: rehearse `docs/DEMO_SCRIPT.md` against the deployed URL and record the video.
