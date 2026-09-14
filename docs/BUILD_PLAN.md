# JanSetu — 16-Day Build Plan

Replaces `ROADMAP.md`, which assumed 18-20 working days remaining and scheduled the submission package past the deadline.

**Today: 14 Sep 2026 · Deadline: 30 Sep 2026 · 16 calendar days.**

Day numbers below are calendar days from today. Day 1 = 14 Sep. Day 16 = 29 Sep. **30 Sep is buffer only — nothing is scheduled on it.** If you are writing code on 30 Sep, something upstream went wrong.

---

## How to use this with an AI coding agent

Each `docs/phases/phase-N-*.md` is written to be handed over on its own. The pattern that works:

> Read `DATA_MODEL.md`, `API_SPEC.md`, and `docs/phases/phase-4-extraction-dedup.md`. Implement Phase 4 exactly as specified. Do not start Phase 5. Stop when every acceptance criterion in the phase doc passes and show me the test output.

Three rules that matter:
1. **One phase per session.** Phase docs declare their prerequisites; a session that tries to do three phases will silently skip acceptance criteria.
2. **The phase doc's acceptance criteria are the contract.** Ask for test output, not a summary.
3. **These docs are the current, authoritative spec set.** There is no separate "corrected" version to reconcile against — `DATA_MODEL.md`, `API_SPEC.md`, `AI_PIPELINE.md`, and `ARCHITECTURE.md` already reflect it.

---

## Tracks

Three parallel tracks. With a team of four: two on backend, one on frontend, one floating between data and submission package. Solo: collapse to serial order and cut everything marked 🟡 immediately.

| Track | Owner | Phases |
|---|---|---|
| **A — Backend & AI** | 2 devs | 1, 2, 3, 4, 5, 6, 8 |
| **B — Frontend** | 1 dev | 1, 7 (starts Day 5 against mocks) |
| **C — Data & submission** | 1 dev | 2 (reference data), 9, 10 |

Track B must not wait for Track A. Phase 2 produces typed schemas and Phase 3 produces a mock server on Day 4 — the frontend builds against those.

---

## Schedule

| Days | Phase | Track | Output |
|---|---|---|---|
| 1 | **1 — Foundation** | A+B | Monorepo, GCP project, indexes, LICENSE, CI green |
| 1-3 | **2 — Data layer** | A+C | Schemas, AdminRegion + LGD, InfraIndex loaded, seed generator |
| 3-5 | **3 — Ingestion** | A | Web + voice + WhatsApp + SMS → Submission, idempotent, <2s |
| 5-8 | **4 — Extraction & dedup** | A | Gemini categorisation, embeddings, geohash dedup, threshold tuned |
| 8-9 | **5 — Scoring** | A | Canonical PriorityScore, breakdown, fallback disclosure |
| 9-12 | **6 — Agent & RAG** | A | Function calling, 6 tools, SSE, refusal guardrail, groundedness verifier |
| 5-13 | **7 — Frontend** | B | Citizen PWA + officer chat/map, streaming tool trace |
| 13-14 | **8 — Fraud, impact, cross-border** | A | Anti-fraud, impact loop, CountryProfile toggle |
| 14-15 | **9 — Deploy, seed, QA** | All | Prod live, dataset loaded, 10 full rehearsals |
| 15-16 | **10 — Submission package** | C | Video, deck, repo, description, deployed link |

### Hard cut-lines

- **End of Day 11:** if the agent is not answering with real tool results, cut RAG (Stage 7) and ship template-generated briefs. The agent answering with citations is the 25% criterion; the RAG brief is a bonus on top of it.
- **End of Day 14:** feature freeze, absolute. Days 15-16 are the submission package only. A team that keeps building into Day 15 submits a broken link and a rushed video — that loses more points than any feature gains.

### Stretch goals — all demoted

`🟡 Dialogflow CX IVR` · `🟡 Vertex AutoML ranking` · `🟡 Gemini Vision photo check`

Only Vision is likely to fit, in Phase 8, and only if Phase 6 finished on Day 11. IVR and AutoML are roadmap-slide material for this timeline. Do not start either.

---

## Daily discipline

- **Deploy to prod from Day 1.** A prod deploy on Day 14 is a prod deploy that fails on Day 14. `DEPLOYMENT.md` already says this; it is the single most-ignored line in most hackathon plans.
- **15-minute standup, three questions:** what shipped, what is blocked, what got cut.
- **Log attribution as you go** into the `ARCHITECTURE.md` §6 table. Rule 03 is a disqualification risk, and reconstructing provenance from memory on Day 16 is how teams end up inventing it.
- **Record demo footage from Day 8 onward.** Every time a feature works, capture it. On Day 15 you edit rather than perform — and you have footage even if something breaks.

---

## Judging-criteria traceability

| Criterion | Weight | Proven by | Phase |
|---|---|---|---|
| Problem-Solution Fit | 20% | 12 raw submissions → 1 Issue, live | 4 |
| **AI/Technical Execution** | **25%** | Agent function calling with visible tool trace; refusal demo; threshold tuning numbers | **6** |
| Depth & Reach Across India | 20% | 3 states, 4 languages, 6 categories + country profile toggle | 2, 8 |
| Impact Potential | 15% | Population-weighted impact estimate; closed impact loop in the formula | 5, 8 |
| Deployability & Scalability | 20% | Live URL, load test, Option A→B→C federation, DPG indicators | 9 |

Phase 6 is the highest-weighted phase and the most likely to overrun. It has three days and a cut-line. Protect it — if something has to slip, slip Phase 7 polish, never Phase 6.

---

## Budget

GCP credits are finite. Estimated full build + seed + rehearsals:

| Service | Estimate |
|---|---|
| Gemini (categorisation ×2,500, agent turns ×400, briefs ×150) | $18 |
| Vertex embeddings (~3,000 calls) | $2 |
| Speech-to-Text (~200 min) | $5 |
| Translation (~400k chars) | $8 |
| Vector Search index (2 weeks) | $15 |
| Cloud Run / Firestore / BigQuery / Maps | $12 |
| **Total** | **~$60** |

Set a billing alert at $150 on Day 1. The realistic overrun risk is an accidental loop re-embedding the seed dataset, not steady-state usage.
