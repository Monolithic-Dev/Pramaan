---
name: senior-prompt-engineer
description: >
  Use for anything touching a Gemini or Vertex AI Embeddings call in worker-ai-pipeline —
  categorization, embeddings/dedup, brief generation, or Gemini Vision checks. Trigger on
  "write a Gemini prompt for X", "the categorization is wrong", "add a new AI stage", "the
  generated brief looks off", "tune the similarity threshold", "the AI hallucinated a number".
---

## What this covers for JanSetu specifically
This project's core differentiator is that its AI does real, structured work across three
chained stages — categorize, dedup via embeddings, grounded generation — each with an
explicit, tested fallback, not one clever prompt wrapping a form. This skill is the permanent
owner of prompt quality and reliability across all three.

## Core guidance
- **Every extraction prompt uses structured/JSON-mode output validated by a Zod schema.**
  Never parse free text with regex.
- **Every generation prompt shown to a policymaker is RAG-grounded**: pass the exact numbers
  to cite in the prompt, and run `groundingCheck.ts` against the output before it ships. A
  cited number absent from the input context is a rejected generation, not a rare exception.
- **The dedup similarity threshold (`SIMILARITY_THRESHOLD`, currently 0.82) is a tuned
  constant, not a magic number.** Any change gets validated against the regression fixture
  set in `references/prompt-templates.md` before merging.
- **New prompts get fixture examples added at the same time they're written**, not after — an
  untested prompt is the single most likely place a live demo breaks.
- **Code-mixed input (Hinglish, Tanglish, etc.) is a first-class case in every prompt's
  instructions**, per `docs/EDGE_CASES.md` #2 — not an afterthought.

## Example
Adding a severity re-estimation step after officer verification: new prompt, same
structured-output + Zod-validation + fallback-to-`"other"`-on-malformed-response pattern as
`categorize.ts`. Add at least 3 new fixture examples covering the verified-context case before
merging, not after.

## Watch out for
- A new prompt with no schema validation.
- A generation prompt shipped without a grounding check.
- Changing the similarity threshold without re-running the regression set.
- A prompt that doesn't explicitly instruct for code-mixed/multilingual input.
- Treating a Gemini API error as unrecoverable instead of retrying via `withRetry()`.

## Hard question
If Gemini returns something subtly wrong but schema-valid — not malformed, just incorrect —
how would this actually get caught before a policymaker sees it? If the honest answer is "it
wouldn't," the grounding check or fixture set needs to grow to cover that case before shipping.

## References
`references/prompt-templates.md` — the full current text of every production prompt
(categorization, grounding/generation, photo-plausibility) plus the prompt-regression fixture
set, kept as the single source of truth so a prompt change is a one-file diff.

## Scripts
`scripts/run-prompt-regression.ts` — runs the fixture set against the live
categorization/generation functions and diffs against expected output. Run before merging any
prompt change.

## Hand off to
`ai-security` before adding any new field of citizen-submitted content into a prompt.
