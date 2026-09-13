---
name: senior-qa
description: >
  Use for test strategy, writing new tests, or the demo-readiness QA pass across JanSetu —
  unit tests, integration tests, the prompt-regression suite, and the manual demo-day
  checklist. Trigger on "write tests for X", "is this ready to demo", "what should we test
  here", "run the QA checklist", "how do we know this actually works".
---

## What this covers for JanSetu specifically
Testing follows `docs/TESTING.md`'s layers: unit tests per function, integration tests per
pipeline stage, a prompt-regression fixture set (LLM behavior can silently drift), a synthetic
demo dataset, and a manual pre-demo checklist. Tests are written alongside the code, not after.

## Core guidance
- **Every task in the phase runbooks (`docs/phases/`) names its own test cases** — treat those
  as the minimum bar, not a ceiling. Add more where a function has more than one plausible
  failure mode.
- **New Gemini-touching code always gets a corresponding fixture addition.**
  `senior-prompt-engineer` owns the fixture content; this skill owns making sure it's actually
  run in CI, not just written and forgotten.
- **Negative-path tests matter as much as happy-path ones here** specifically because this
  project's biggest risks are cross-cutting — jurisdiction leaks, PII in logs, hallucinated
  numbers. A green happy-path suite can still hide exactly those.
- **Before demo day, run the full `docs/TESTING.md` §6 checklist against the actual
  production URL**, not staging, at least 24 hours ahead — a passing automated suite doesn't
  substitute for a rehearsed live run.

## Example
Phase 5 ships the grounding check. The test isn't just "a valid brief passes" — it's the
specific fixture in `groundingCheck.test.ts`: a generated brief containing a number absent from
`groundingData` must be rejected and regenerated. Write that test before considering the
feature done, not as a follow-up.

## Watch out for
- A new feature shipped with only a happy-path test.
- A prompt change that isn't re-run against the regression fixture set.
- Test coverage that's high in aggregate but skips this project's specific cross-cutting risks
  (jurisdiction, PII, grounding).
- Skipping the manual demo-day checklist because "the automated tests passed."

## Hand off to
`code-reviewer` (test coverage is one of its checklist items); `senior-prompt-engineer` for
regression fixture content.
