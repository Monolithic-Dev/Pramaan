# Advanced Features: Making JanSetu Unique

You've built the credible, deployable version. This folder is what turns "solid submission" into
"the one judges remember" — six differentiators, tiered by return on your remaining time, plus a
demo script that makes sure judges actually notice them.

## The honest framing
Nobody wins a hackathon by having *more* features. They win by having a small number of features
that directly answer the question a sharp judge would ask if they had one more minute with your
team. Each feature below exists because it answers one of those questions — not because "more AI"
sounds good on a slide.

## Priority tiers, mapped to your ~12 remaining days

### Tier 1 — build these (days 1-6)
| # | Feature | Judging criteria | Rough effort |
|---|---|---|---|
| 1 | [Predictive Early-Warning](01-predictive-early-warning.md) | AI/Technical Execution, Impact Potential | ~2 days |
| 3 | [Citizen Explainability Portal](03-citizen-explainability-portal.md) | Problem-Solution Fit | ~1 day |
| 2 | [Equity & Fairness Audit](02-equity-fairness-audit.md) | Depth & Reach, credibility | ~2 days |

### Tier 2 — build if Tier 1 lands early (days 6-9)
| # | Feature | Judging criteria | Rough effort |
|---|---|---|---|
| 6 | [Public Transparency Ledger](06-public-transparency-ledger.md) | Deployability, Impact Potential | ~1 day |
| 5 | [Instant State Onboarding Demo](05-instant-state-onboarding-demo.md) | Deployability & Scalability | ~1 day |
| 4 | [Agentic Policy Co-Pilot](04-agentic-policy-copilot.md) | AI/Technical Execution (biggest flex, biggest risk) | ~2-3 days |

### Days 9-12: integration, pitch deck/video update, rehearsal, buffer
Don't skip this. A feature that isn't in the demo video or pitch deck doesn't exist to the judges
— see `DEMO_SCRIPT.md`.

## Implementation phases (10-16)
Each feature above has a matching phase runbook in `phases/`, continuing the numbering from the
core build's `docs/phases/phase-1` through `phase-9` — this is the next stage of the same build,
not a restart:
- `phases/phase-10-predictive-early-warning.md`
- `phases/phase-11-citizen-explainability-portal.md`
- `phases/phase-12-equity-fairness-audit.md`
- `phases/phase-13-public-transparency-ledger.md`
- `phases/phase-14-instant-state-onboarding-demo.md`
- `phases/phase-15-agentic-policy-copilot.md`
- `phases/phase-16-integration-demo-rehearsal.md`

Phase 10 carries the full "Plan at a glance" table with the day map and parallelization notes
for all seven phases.

## Why the tiering is in this order
- Tier 1 items all **reuse infrastructure you've already built** (the grounded-brief generator,
  the scored `Issue`/`PriorityScore` pipeline) — they're extensions, not new subsystems, which
  keeps risk low this late in the build.
- The Agentic Co-Pilot is real, is the single most technically impressive item here, and is
  deliberately last: a multi-turn tool-calling agent that misbehaves live in front of judges is
  worse than not having it. Build it only once everything else is stable, and always rehearse
  with the dashboard as a manual fallback.
- If you run out of time before Tier 2, describing it honestly as roadmap on one pitch-deck slide
  is legitimate — judges can tell the difference between "we thought about this" and "we panicked
  and half-built five things."

## What NOT to do with remaining time
- Don't rebuild anything already working in the 9 phases — every hour spent polishing something
  already correct is an hour not spent on a differentiator a judge hasn't seen from anyone else.
- Don't add a feature with no demo moment. If you can't describe, in one sentence, what a judge
  will *see* happen, it's not ready to build yet — see each feature doc's "demo moment."
