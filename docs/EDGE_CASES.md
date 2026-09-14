# Edge Cases: JanSetu

Judges evaluating "AI/Technical Execution" and "Deployability" will probe exactly these kinds of scenarios. Having explicit, documented answers — even if only partially implemented in the hackathon build — is itself a differentiator.

| # | Category | Scenario | Handling strategy |
|---|---|---|---|
| 1 | Language | Citizen speaks a dialect/language not supported by Speech-to-Text | Fall back to the nearest supported language, flag the transcript as low-confidence for officer review, and always offer a text-retype fallback |
| 2 | Language | Code-mixed input (e.g. Hinglish, Tanglish) | Translation prompt explicitly handles code-mixed text; test set (`TESTING.md`) includes code-mixed examples |
| 3 | Location | No GPS / citizen doesn't share location | Ask for a landmark or ward name conversationally; Gemini extracts probable location text; geocode via Maps Geocoding API; mark `location_confidence: low` and down-weight in centroid computation |
| 4 | Dedup | Same citizen submits the same issue twice across channels | Dedup matches within `citizen_id` + geo + time window first, before falling to embedding similarity, to avoid double-counting demand from one person |
| 5 | Fraud | Coordinated flood of similar submissions to fake demand in one area | Burst/anomaly detection flags abnormal cluster growth rate for officer review before it affects the public-facing score |
| 6 | Fraud | Attached photo is unrelated or fraudulent | Soft verification flag only — never auto-reject; officer makes the final call |
| 7 | Data gaps | Missing/stale `InfraIndex` for a region | Fall back to state-level average with an explicit "data unavailable, using state average" disclosure in the generated brief — never silently guess |
| 8 | Data gaps | Incomplete `InvestmentRecord` data (can't verify prior funding) | `duplication_penalty` defaults to 0 with an `unverified` flag, rather than wrongly rewarding or punishing the issue |
| 9 | AI reliability | Gemini returns malformed JSON in structured extraction | Schema validation + one retry with a stricter prompt; if still malformed, fall back to raw-text-only categorization — the submission is never silently dropped |
| 10 | AI reliability | Gemini hallucinates a statistic in a generated brief | RAG grounding (Stage 7, `AI_PIPELINE.md`) + a deterministic post-generation groundedness verifier that checks every cited number exists in the tool output; regenerate or fall back to a template summary if not |
| 11 | Scale | A single event (e.g. a bridge collapse) causes a submission spike far beyond normal | `demand_score` is log-scaled; officers can set a manual "emergency override" flag to bypass the normal scoring cadence entirely |
| 12 | Officer workflow | An issue sits `verified` with no action for a long time | Automatic escalation reminder after N days, visible SLA timer on the dashboard |
| 13 | Impact loop | Officer marks a project resolved prematurely, or a citizen falsely confirms resolution | Require confirmation from a minimum threshold of original reporters, plus periodic random officer audit spot-checks |
| 14 | Connectivity | Submission fails mid-upload in a low-connectivity area | Client-side offline queue (PWA service worker) retries when back online; a client-generated idempotency key prevents double submission on retry |
| 15 | Multi-tenancy | Data leakage between states in a shared deployment | Every query is scoped by `state_id` at the data-access layer, enforced server-side, never trusted from client input |
| 16 | Scoring | Very small/rural clusters with too few reports to be statistically meaningful | Minimum `report_count` threshold before a cluster is eligible for the prioritization list, to avoid noise-driven recommendations |
| 17 | Geography | Conflicting administrative boundaries (ward vs. village vs. district naming differs by state) | Use `lat`/`lng` as the source of truth, join to admin boundaries via a GIS boundary dataset rather than trusting citizen-typed admin names |
| 18 | AI reliability | Gemini API outage or degraded latency | Ingestion still succeeds (raw submission is stored); categorization/dedup retries via Pub/Sub with exponential backoff — the citizen is never blocked by AI availability |
| 19 | Privacy | Submission contains sensitive personal content unrelated to infrastructure (e.g. a personal medical emergency) | A PII/sensitive-content scrubbing pass before analytics storage; anything referencing personal safety is routed to a separate review flow, not the public infra pipeline |
| 20 | Language coverage | Translation API doesn't support a very local dialect | Log the unsupported-language event — this becomes a genuine, data-backed feature-request signal for extending language coverage, worth mentioning in the pitch deck's roadmap slide |
