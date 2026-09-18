# Phase 15 of 16: Agentic Policy Co-Pilot

## Header
- **Goal (done = ):** An officer/policymaker can ask a natural-language question spanning
  multiple data sources (issues, forecasts, equity) in a chat panel and get a grounded answer
  with a visible tool-call trail, via genuine Gemini function-calling — not a single-shot
  prompt.
- **Preconditions:** Phase 3 (auth), Phase 7 (`GET /issues`), Phase 10 (`GET /forecasts`,
  recommended), Phase 12 (`GET /equity-audit`, recommended). **Build this only after Phases
  10-14 are confirmed stable** — this is deliberately last.
- **Specs implemented:** `docs/advanced-features/04-agentic-policy-copilot.md`.

## Task breakdown
1. `apps/api-gateway/src/routes/copilot.ts`: `POST /copilot/ask {question}` — officer/policymaker
   only. The officer's jurisdiction is passed into every tool call automatically from the JWT —
   **never** trusted from the question text itself.
2. `apps/worker-ai-pipeline/src/copilot/tools.ts`: define tool schemas —
   `queryIssues(region, category?, status?, minAgeDays?)`,
   `getEquityAudit(state)`, `getForecasts(region, category?)`,
   `compareDistricts(districtA, districtB, category?)` — each a thin wrapper calling the
   **existing underlying functions directly, in-process**, not a self-referential HTTP call to
   the project's own API.
3. `apps/worker-ai-pipeline/src/copilot/orchestrator.ts`: `runCopilotQuery(question, officerContext)` — the Gemini function-calling loop: send the question and tool definitions, execute whichever tool(s) Gemini requests, feed results back, repeat up to `MAX_TOOL_CALLS` (default 4), then generate a final natural-language answer.
4. Hard cap enforcement: if `MAX_TOOL_CALLS` is reached without a final answer, return a graceful
   *"I wasn't able to fully answer this within my tool-call budget — here's what I found so far"*
   rather than looping silently or timing out.
5. Grounding check reused: every number in the final answer must trace back to a tool result
   (reuse the existing `groundingCheck.ts` interface if generic enough, or a thin
   copilot-specific wrapper around it). On failure: regenerate once, then fall back to returning
   the raw tool results with no generated prose.
6. Empty-result handling: a tool returning zero matching records is represented to the model as
   explicitly empty, with the final-answer prompt instructed to say "no matching data" rather
   than infer or fabricate one.
7. `apps/web/src/routes/dashboard/components/CoPilotChat.tsx`: chat UI showing the final answer
   plus an expandable "what I checked" section listing the tools called and their raw results —
   transparency by default, not hidden reasoning.
8. Unit tests: `"a question triggering 2 tool calls returns an answer grounded in both results"`, `"a tool call returning zero results produces a 'no matching data' answer, not a fabricated one"`, `"a query requiring more than MAX_TOOL_CALLS returns the graceful partial-answer fallback, not an infinite loop or timeout"`.
9. **Rehearsal requirement (not a code task — a required step):** run the exact scripted demo
   question from `docs/advanced-features/DEMO_SCRIPT.md` at least 5 times against the real
   deployed environment before demo day, confirming consistent, correct behavior each time.

## Real-world engineering concerns
- In-process tool calls (task 2) avoid an unnecessary network hop and a confusing
  self-referential auth story — call the same underlying functions the HTTP handlers call, not
  the HTTP endpoints themselves.
- **This is the highest live-demo-risk feature in the whole project.** The hard tool-call cap
  (task 4) and explicit empty-result handling (task 6) are what stand between "impressive" and
  "embarrassing" on stage — treat neither as optional under time pressure.

## Definition of done
- [ ] The scripted demo question from `DEMO_SCRIPT.md` produces a correct, grounded answer with
      a visible tool-call trail, consistently across 5 rehearsal runs.
- [ ] A deliberately impossible/empty-result question produces an honest "no matching data"
      response.
- [ ] The tool-call cap is enforced and triggers the graceful fallback in a test.
- [ ] All tests in task 8 pass.

## Risks & blockers
- Gemini function-calling behavior can vary run-to-run — this is inherent to the feature, not a
  bug to eliminate entirely. The rehearsal requirement (task 9) exists specifically to catch
  inconsistency before demo day; the manual dashboard remains the explicit fallback per
  `DEMO_SCRIPT.md` if reliability is still a concern going into the final rehearsal.

## Time budget
**2-3 days**, and only start once Phases 10-14 are confirmed stable. If it runs long, or
rehearsal (task 9) shows inconsistent results, **cut this feature from the live demo entirely**
and keep it in the codebase as a documented "built, not demoed live" item in the pitch deck —
per `docs/advanced-features/README.md`'s tiering, this is explicitly the item to drop first.

## Handoff
If stable: a genuine agentic differentiator ready for the demo. If not stable after rehearsal: a
documented, honest fallback decision has been made rather than a last-minute gamble. Tag
`phase-15-done` either way.
