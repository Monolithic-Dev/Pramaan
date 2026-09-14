# Testing: JanSetu

## 1. Unit tests
- Dedup similarity threshold logic (given two embeddings + a distance, does it merge or not, at the boundary values).
- Scoring formula (given known inputs, does `composite_score` match the expected calculation, including the log-scaling and duplication penalty).
- Input validation (malformed `lat`/`lng`, missing required fields, oversized payloads).

## 2. Integration tests
- Full pipeline: submission → categorization → dedup → scoring → brief generation, with Gemini calls mocked to fixed responses for deterministic CI runs.
- Webhook handlers (WhatsApp/IVR payload → correctly mapped `Submission` schema).

## 3. Prompt regression tests
Maintain a fixed set of ~20 sample citizen complaints spanning all target languages and categories, each with an expected category/severity/summary. Re-run this set whenever a prompt changes (Stage 2 and Stage 7 of `AI_PIPELINE.md`) to catch quality drift before it reaches the demo. Store expected vs. actual output diffs, not just pass/fail, so regressions are easy to diagnose.

Two additional suites are required for the agent (Stage 5) and are specified in full in `docs/phases/phase-6-agent-rag.md` §5.7 — they did not exist in earlier test planning despite the agent being PRD goal G5:
- **Tool-selection accuracy:** 30 questions with expected tool-call sequences. Target ≥80% exact-match.
- **Refusal suite:** 15 questions that cannot be answered from available data. Target 15/15 refuse, zero fabricated figures.

## 4. Synthetic demo dataset
Build a small generator script that produces a realistic (not random) dataset for demo day:
- ~1,000-2,000 synthetic submissions across 3 states, 5 categories, 3 languages.
- Geographically clustered (not uniformly random) so dedup and hotspot detection have something meaningful to show.
- A deliberate mix: some issues with heavy duplicate reporting (to show dedup), some flagged fraud/burst patterns (to show the anti-fraud layer), at least one fully resolved project with citizen confirmations (to show the impact loop).
- Clearly labeled in the repo/README as synthetic demo data, distinct from the real public reference datasets (`InfraIndex` source, etc.) — judges specifically reward honesty about what's real vs. illustrative.

## 5. Load testing
- A basic k6 or Locust script hitting `POST /submissions` at a burst rate (e.g. simulate 500 submissions/minute for 2 minutes) to demonstrate the ingestion path stays responsive even when the AI pipeline behind it is momentarily slower. This is a concrete, demoable answer to "could this scale."

## 6. Manual QA checklist (run this the day before demo day, not the morning of)
- [ ] Voice input tested live in at least 2 of the target languages.
- [ ] A live submission visibly triggers dedup against an existing seeded issue.
- [ ] Dashboard loads in under a few seconds with the full synthetic dataset present.
- [ ] A generated brief is shown with its underlying numbers visible, so the "grounded, not hallucinated" claim can be verified on the spot if a judge asks.
- [ ] The impact-loop flow (mark complete → citizen confirmation) is demonstrated with at least one pre-seeded example.
- [ ] Fallback plan confirmed: if the live deployed link has issues during the demo, the recorded demo video is ready as backup.

## 7. Acceptance criteria mapping
Each functional requirement in `PRD.md` (Section 6) should have at least one corresponding test above before being marked done — treat the PRD user stories as your test-case source of truth, not an afterthought written after the code.
