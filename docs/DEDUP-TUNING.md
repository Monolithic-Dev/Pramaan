# Dedup similarity threshold tuning

**⚠ Placeholder run** — swept against 10 illustrative pairs in
`scripts/dedup-tuning/pairs.json`, not the real 120 hand-labelled pairs (60
true duplicates, 60 near-misses) the phase plan calls for. Re-run this script
against real labelled submission data before treating the selected threshold
as production-final — see docs/phases/phase-4-manual-checklist.md.

| threshold | precision | recall | F1 |
|---|---|---|---|
| 0.7 | 0.63 | 1.00 | 0.77 |
| 0.72 | 0.63 | 1.00 | 0.77 |
| 0.74 | 0.63 | 1.00 | 0.77 |
| 0.76 | 0.63 | 1.00 | 0.77 |
| 0.78 | 0.63 | 1.00 | 0.77 |
| 0.8 | 0.63 | 1.00 | 0.77 |
| 0.82 | 0.71 | 1.00 | 0.83 |
| 0.84 | 0.71 | 1.00 | 0.83 |
| 0.86 | 0.71 | 1.00 | 0.83 |
| 0.88 | 0.71 | 1.00 | 0.83 |
| 0.9 | 0.71 | 1.00 | 0.83 |
| 0.92 | 0.83 | 1.00 | 0.91 |

Best F1 in this run: **0.92** (precision 0.83, recall 1.00).
Current default in `apps/worker-ai-pipeline/src/lib/env.ts` (`DEDUP_SIMILARITY_THRESHOLD`): 0.82.
