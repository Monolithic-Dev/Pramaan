---
name: threat-detection
description: >
  Use for anti-gaming and abuse-resistance work — burst detection, geofencing, photo
  plausibility checks, or anything defending the public prioritization system against being
  manipulated to fake demand or game the impact-confirmation loop. Trigger on "how do we
  stop someone gaming this", "detect a burst of fake reports", "is this submission pattern
  suspicious", "prevent double funding", "someone is spamming the platform".
---

## What this covers for JanSetu specifically
JanSetu's core output is a ranked list that influences real government funding — that makes it
a genuine target for gaming (inflating demand for one's own area, discrediting a rival area, or
defrauding the impact-confirmation loop). Every defense here is deliberately soft/advisory,
flagging for officer review rather than auto-rejecting, because falsely blocking a real citizen
is worse than an officer spending a minute reviewing a flagged case.

## Core guidance
- **Every new input channel** (WhatsApp, a future IVR line) **gets the same geofence and
  burst-detection treatment as the existing web/voice channel** — a new channel is never
  exempt just because it's new.
- **Burst detection compares against a cluster's own historical average, not a fixed global
  threshold.** A genuinely large real event (a bridge collapse) should stay distinguishable
  from a coordinated fake-report campaign — `docs/EDGE_CASES.md` #11's emergency-override flag
  is the escape hatch for the former.
- **Every anti-fraud signal is stored and visible to the officer, never silently applied.** An
  officer should be able to see *why* something was flagged, not just that it was.
- **The impact-confirmation loop needs its own abuse model** — a minimum-confirmations
  threshold and periodic random officer audits, not a single citizen's word deciding a project
  is "resolved" (`docs/EDGE_CASES.md` #13).

## Example
Someone reports the same nonexistent pothole from 15 different phone numbers within an hour.
Burst detection on the `geo_cluster` catches the rate anomaly and routes the `Issue` to
required-review status before it contributes to public ranking. This exact scenario should be
one of the seeded cases in the synthetic demo dataset (`docs/TESTING.md` §4) — it's a concrete,
demoable answer to "how do you prevent gaming," not just a design claim.

## Watch out for
- A new anti-fraud signal that auto-rejects instead of flagging.
- Burst detection tuned against a global constant instead of per-cluster history.
- The impact-confirmation loop trusting a single citizen's confirmation.
- A new channel that skips geofencing because "it's a trusted partner API."

## Scripts
`scripts/simulate-burst.ts` — generates a synthetic burst of near-duplicate submissions
against a target geo-cluster (local/staging only) to test `burstDetection.ts`'s response
without waiting for real abusive traffic.

## Hand off to
`senior-backend` for implementing the actual detection logic; `senior-qa` for writing the
adversarial test cases these scenarios imply.
