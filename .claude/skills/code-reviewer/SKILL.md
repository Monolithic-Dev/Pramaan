---
name: code-reviewer
description: >
  Use when reviewing a pull request or diff anywhere in the Pramaan monorepo before merging.
  Trigger on "review this PR", "review this diff", "is this ready to merge", "check this
  code before I merge it".
---

## What this covers for Pramaan specifically
A single consolidated checklist pulling the highest-value "watch out for" items from every
other skill in this set, so a reviewer — human or agent — doesn't need all eleven other skills
open at once to catch the mistakes this project specifically tends to produce.

## Core guidance (condensed — full checklist in references/review-checklist.md)
- Does every new endpoint have Zod validation and, if state-changing, jurisdiction/auth
  checks? (`senior-backend`, `senior-security`)
- Does every new Gemini/Vertex AI call have schema validation and a documented fallback, and
  does anything user-submitted going into a prompt avoid unnecessary PII?
  (`senior-prompt-engineer`, `ai-security`)
- Does every new Firestore/BigQuery field or collection carry `state_id` and have a matching
  security rule/index? (`senior-database`)
- Is there a happy-path test *and* at least one negative-path test? (`senior-qa`)
- Does a new anti-fraud signal flag-for-review rather than auto-reject?
  (`threat-detection`)
- Does a new UI string go through i18n, not get hardcoded? (`localization-voice-ux`,
  `senior-frontend`)

## Example
Reviewing a PR that adds `POST /projects/{id}/mark-complete`: confirm it checks officer
jurisdiction, writes an audit log entry, and that the citizen-notification call (Phase 8,
task 6) is wrapped in `withRetry()` and doesn't block the response if it fails.

## Watch out for
- Approving a PR because it "looks clean" without checking it against the specific
  cross-cutting risks above.
- A large PR touching multiple skills' territory getting only a surface read.
- A new file duplicating logic that already exists in `packages/shared-utils`.

## References
`references/review-checklist.md` — the full consolidated checklist, one line per watch-out
item across all eleven other skills, meant to be worked through top to bottom on any
non-trivial PR.

## Hand off to
Whichever specific skill matches an issue found during review.
