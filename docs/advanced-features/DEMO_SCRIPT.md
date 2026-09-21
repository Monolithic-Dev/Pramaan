# Demo Script: Making Judges See the Difference

A feature nobody sees in the demo video or pitch deck doesn't exist to the judges. This script
exists so building Tier 1/2 features actually converts into points, not just GitHub commits.
Use it for both the required 3-5 minute demo video and any live demo day walkthrough.

## Before anything else
Rehearse this against the real deployed production URL, not staging, at least 24 hours ahead —
per `docs/DEPLOYMENT.md` §7 and `docs/TESTING.md` §6. Time yourself with a stopwatch. Cut
ruthlessly to fit; a shorter, tight demo beats a longer, rushed one.

## Suggested flow (~4 minutes, adjust to what you actually built)

**0:00-0:20 — The gap everyone else will miss**
Show 10+ raw, differently-worded citizen submissions about the same real-world pothole, then cut
to the officer dashboard showing them collapsed into **one** `Issue` with `report_count: 10+`.
Say plainly: *"Most systems would show you ten complaints. We show you one real problem."* This
is your `docs/AI_PIPELINE.md` Stage 3 dedup — lead with it, it's your most defensible technical
claim.

**0:20-0:50 — Core flow, multilingual and voice, live**
A citizen records a voice report in a non-English language, sees categorization happen, gets a
confirmation read back to them in their own language. This single-handedly proves the
multilingual/voice requirement isn't a checkbox.

**0:50-1:30 — Explainable prioritization**
Officer dashboard: ranked list, click one issue, show the score breakdown (not just a number)
and the grounded brief. Say: *"Every number here traces back to real data — we can show you
exactly why, not just that."*

**1:30-1:55 — Predictive Early-Warning** *(Feature 1, if built)*
Point at a dashed-outline forecast marker with zero linked reports: *"Nobody has reported this
yet. We're already flagging it."*

**1:55-2:20 — Equity & Fairness Audit** *(Feature 2, if built)*
Open the Equity tab, read the real generated verdict line aloud, whatever it says: *"We built the
dashboard that would catch us if our own prioritization was unfair."*

**2:20-2:45 — Citizen Explainability Portal** *(Feature 3, if built)*
Return to the citizen from the opening, show their status page in their own language: *"The same
transparency we gave the officer, we give the citizen who filed it."*

**2:45-3:05 — Impact loop**
Show a pre-seeded resolved project with citizen confirmations: *"This is the part of the brief
almost every other team will skip — proof the fix actually happened, confirmed by the people who
asked for it."*

**3:05-3:30 — Deployability flex** *(Feature 5 or 6, if built; pick one, don't rush both)*
Either live-add a new state (Feature 5) or open the public transparency page in an incognito
window (Feature 6) — whichever is more solid on the day.

**3:30-3:50 — Agentic Co-Pilot** *(Feature 4, only if thoroughly rehearsed)*
One scripted, pre-tested question spanning two data sources, answered live with the tool-call
trail visible. If there's any doubt about reliability, cut this and end on 3:30 instead — a clean
finish beats a shaky flex.

**Final 10 seconds — spell it out**
A single closing line or title card explicitly naming the five judging criteria and which part of
what was just shown addresses each one. Don't make judges reconstruct your scoring case
themselves after watching — do it for them.

## What to do if something breaks live
Have the recorded demo video ready as an immediate fallback — this is exactly why the required
3-5 minute video exists, and rehearsing it is not wasted effort even if the live demo goes
perfectly.
