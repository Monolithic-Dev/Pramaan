# Feature 3: Citizen Explainability Portal

## Why this is unique
You already generate a grounded, hallucination-checked justification for policymakers (Stage 6
of `docs/AI_PIPELINE.md`). Almost every competing team that builds any explainability at all will
point it only at officials. Pointing the *same* explanation at the citizen who filed the report —
in their own language — is a small, cheap extension with an outsized trust payoff, and it
directly answers the brief's core complaint: fragmented systems where citizens have no visibility
into what happens to their input.

## What to build

### Minimum viable version (~1 day)
- New endpoint: `GET /my-reports/{submission_id}/status` (citizen-owned only — same ownership
  check as the existing `GET /submissions/{submission_id}`).
- Response combines: the linked `Issue`'s current `status`, `report_count` ("14 other people in
  your area reported this too"), a plain-language priority band (**"high/medium/low priority"**
  — never the raw composite score, which would be meaningless and potentially discouraging
  without context), and a citizen-friendly rephrasing of the same `Project.generated_brief`,
  translated into the citizen's `preferred_language` via the existing Translation API path.
- Reuse, don't duplicate: this reads the *existing* grounded brief rather than generating a new
  one — no new AI call, no new hallucination risk surface.
- New UI: `apps/web/src/routes/status/StatusPage.tsx`, reachable from the citizen's confirmation
  screen ("check status" link using their `submission_id`), OTP-gated the same way as
  `confirm-resolution`.

## Demo moment
Go back to the citizen who submitted the pothole report earlier in the demo, open their status
page in Hindi, and read it aloud: *"14 other people reported this. It's currently high priority.
Here's why, in your own words"* — then point out this is the identical grounded data the officer
saw minutes earlier, not a simplified fake version.

## Watch out for
- **Never expose other citizens' identifying information** in this view — only aggregate counts
  (`report_count`) and the same public-facing brief text an officer would see, never other
  reporters' phone hashes, exact submission text, or photos.
- The priority band must be plain language, not the raw `composite_score` — a citizen seeing
  "0.41" with no context is worse than not showing a number at all.

## Effort
~1 day — this is almost entirely a read-only view over data that already exists; it's the
highest trust-payoff-per-hour item on this whole list.
