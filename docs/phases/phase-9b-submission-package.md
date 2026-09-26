# Phase 9b: Submission Package (core-plan baseline)

**Days 15-16 of the core 16-day plan · Track C leads, all hands · 30 Sep is buffer only**

> **Renumbered 21 Sep 2026.** This was originally "Phase 10 of 10" in the core build plan. Once the team decided to build the six advanced-feature phases in `docs/advanced-features/`, those claimed numbers 10-16, and **`docs/phases/phase-16-integration-demo-rehearsal.md` is now the actual final phase** that assembles the submission package — its task 8 explicitly redoes this checklist with the expanded feature set. This document is kept as detailed reference material (the video cut-by-criterion table, the slide-by-slide deck structure, the Rule-compliance table) for whichever phase actually ships the submission, whether that's here (if the advanced-feature phases don't happen) or via Phase 16 (if they do).

## Objective
The five required artifacts, assembled and submitted. Nothing here is optional and each one is independently scored by someone who has never seen your project.

## Prerequisites
Phase 9 complete. Feature freeze held since end of Day 14 (or, if the advanced-feature phases ran, since Phase 16 starts — see the renumbering note above).

## Reference docs
`About.pdf` (submission package requirements, evaluation parameters, Rules 01-06)

---

## The five required artifacts

Per `About.pdf`:

1. **Source code** — public or access-granted GitHub repository
2. **Demo video** — 3-5 minutes, working end-to-end walkthrough
3. **Pitch deck** — 10-12 slides
4. **Brief description** — 2-3 lines
5. **Deployed link** — live prototype

Missing any one is a scoring loss you cannot recover. Check them off explicitly.

---

## 10.1 Demo video (3-5 min)

The brief says *"working end-to-end walkthrough"* — **not slides.** Screen recording of the real product.

Suggested cut, mapped to judging weights:

| Time | Content | Criterion |
|---|---|---|
| 0:00-0:25 | The problem, stated once, plainly. Fragmented complaints, no prioritisation, no outcome measurement | Problem-Solution Fit |
| 0:25-1:00 | Citizen files a Hindi voice complaint on a phone. Confirmation with spoken read-back | Problem-Solution Fit, Reach |
| 1:00-1:35 | **Dedup:** 14 reports, 3 languages, collapsing into one Issue. Show the similarity scores | Problem-Solution Fit |
| 1:35-2:35 | **The agent.** Officer asks a question, tool chips fire visibly, cited answer appears. Then ask something unanswerable and show the refusal naming what is missing | **AI/Technical Execution (25%)** |
| 2:35-3:05 | Score breakdown with the fallback disclosure. The "we don't double-fund" comparison | Impact Potential |
| 3:05-3:25 | Impact loop: mark complete → citizen confirms → efficacy changes a future score | Impact Potential |
| 3:25-3:45 | **Country toggle to Brazil.** Same agent, Portuguese, Brazilian regions | Depth & Reach, Rule 04 |
| 3:45-4:15 | Architecture, load-test graph, Option A→B→C federation | Deployability |
| 4:15-4:30 | Live URL on screen, DPG indicators, close | — |

Give the agent segment a full minute. It is the heaviest-weighted criterion and it is the only segment where a judge sees something they have not seen in twenty other submissions.

Practical notes:
- Edit from the footage captured during Phase 9 rehearsals. Do not perform live on Day 15.
- Voiceover, not on-screen text. Subtitles for the non-English segments.
- Record at 1080p minimum. Screen text must be legible.
- Watch it once at 1.5× speed with no sound. If the story is still clear, the pacing is right.

## 10.2 Pitch deck (10-12 slides)

Structure it explicitly around the five evaluation parameters. Judges score against a rubric; make their job mechanical.

| # | Slide | Content |
|---|---|---|
| 1 | Title | Pramaan, one line, team, live URL |
| 2 | Problem | The problem statement, plus the two hard parts everyone skips: dedup and outcome measurement |
| 3 | The gap in the obvious solution | The `README.md` paragraph — it is the strongest writing in your doc set, use it verbatim |
| 4 | Solution overview | The loop: citizen → issue → score → project → confirmation → score |
| 5 | **AI pipeline** | All 8 stages, with Google AI products named at each |
| 6 | **Agent architecture** | Function calling, 6 tools, tool-trace screenshot, refusal example |
| 7 | **Groundedness** | Verifier design + your measured numbers: tool-selection accuracy, 15/15 refusal |
| 8 | Explainable scoring | Formula, breakdown screenshot, fallback disclosure |
| 9 | Depth & reach | 3 states, 4 languages, 6 categories, 4 channels + dedup tuning table |
| 10 | **Scale: A → B → C** | Single tenant → federated states → cross-border. One diagram |
| 11 | Deployability | Load-test graph, DPG indicator table with the honest gap on indicator 4 |
| 12 | Impact & roadmap | Population-weighted estimates, closed loop, IVR/AutoML as next steps |

Slides 6, 7, and 10 are where you win. Slide 7 in particular — a measured guardrail with real numbers is rare in hackathon decks, and it directly defuses the hallucination question a Google Cloud judge will ask.

## 10.3 Repository

- [ ] `README.md` — pitch, live link, architecture diagram (**verify it renders in GitHub's preview**), quickstart, doc index
- [ ] `LICENSE` — Apache-2.0
- [ ] `docs/` — current doc set, including `phases/`
- [ ] Attribution table complete: every dataset, library, and API with source and licence (Rule 03)
- [ ] Synthetic data clearly labelled as synthetic, in the repo and in the UI
- [ ] `docs/DEDUP-TUNING.md` with the threshold sweep
- [ ] Test suites runnable: `pnpm turbo run test`
- [ ] No secrets in history — run `git log -p | grep -iE 'api[_-]?key|secret|password'` before making it public
- [ ] Public, or access granted to the organiser email

## 10.4 Brief description (2-3 lines)

Draft:

> Pramaan turns millions of raw, multilingual citizen infrastructure complaints — via voice, WhatsApp, SMS, and web — into a small number of deduplicated, verified, and explainable priority projects that a state government can fund and track to completion. Officers interrogate the data through a Gemini agent that cites every figure to a tool result and refuses to answer when the data does not support one. The impact loop closes: citizens confirm resolution, and realised outcomes feed back into future prioritisation.

Three sentences, each carrying a different differentiator. Adjust wording, keep the structure.

## 10.5 Deployed link

Live, stable, tested from an external network on a phone. Confirm it is still up on the morning of submission and again on 30 Sep.

---

## Rule compliance — final check

| Rule | Requirement | Status |
|---|---|---|
| 01 | Google AI integrated (GenAI, predictive, or vision) | Gemini, Vertex Embeddings, Vector Search, STT, Translation, Maps |
| 02 | Built during the hackathon period | Repo history starts Day 1 |
| 03 | Original code or properly licensed/cited | Attribution table + per-record `source_url`/`licence` |
| 04 | Cross-border applicability (BRICS) | `CountryProfile`, Brazil demo, `CROSS_BORDER_AND_DPG.md` |
| 05 | Respectful, inclusive conduct | — |
| 06 | Judges' decisions final | — |

Verify Rule 04 is visible in the deck (slide 10), the video (3:25), and the repo before submitting — a judge checking rule compliance should not have to look for it.

---

## Acceptance criteria

- [ ] Video is 3-5 minutes, shows real product, includes the agent segment with visible tool calls and a refusal
- [ ] Deck is 10-12 slides and maps explicitly to the five evaluation parameters
- [ ] Repo public, licensed, attributed, secret-free, README renders correctly
- [ ] Description is 2-3 lines
- [ ] Deployed link live and verified from an external network
- [ ] All five artifacts submitted through the official portal
- [ ] Submission confirmation received and screenshotted

## Definition of done
Submitted, with 30 Sep untouched as buffer.

## Traps
- Video length is a stated constraint. Over 5 minutes risks being cut off mid-sentence at the part you care about most.
- A private repo without access granted is functionally a missing artifact.
- Check the deployed link from outside your network. A link that only works from your machine is the most common and most avoidable submission failure.
- Do not re-edit the video on 30 Sep. Buffer means buffer.
