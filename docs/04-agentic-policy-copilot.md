# Feature 4: Agentic Policy Co-Pilot

## Why this is unique — and why it's last
This is the single most technically impressive item on this list: a real multi-turn,
tool-calling agent, not a single-shot prompt. Most competing "AI-powered" submissions are one
Gemini call wrapped in a form; this is Gemini deciding which of several real backend queries to
run, chaining them, and grounding its final answer in the results — genuine agentic execution.
It's listed last deliberately: a live agent doing something unexpected in front of judges is a
worse outcome than a feature you didn't build. Build it only once Tier 1 is solid, and always
keep the plain dashboard as your rehearsed fallback.

## What to build (~2-3 days)

- New endpoint: `POST /copilot/ask {question}` in `apps/api-gateway/src/routes/copilot.ts`
  (officer/policymaker only, jurisdiction-scoped).
- Gemini function-calling with a small, fixed tool set — each tool a thin wrapper around an
  **existing** endpoint, so this adds an interface layer, not new backend logic:
  - `queryIssues(region, category?, status?, minAgeDays?)` → wraps `GET /issues`
  - `getEquityAudit(state)` → wraps `GET /equity-audit` (if Feature 2 is built)
  - `getForecasts(region, category?)` → wraps `GET /forecasts` (if Feature 1 is built)
  - `compareDistricts(districtA, districtB, category?)` → two `GET /issues` calls, diffed
- Hard cap: max 4 tool calls per question, enforced in code — an agent looping indefinitely
  during a demo is the exact failure mode this cap exists to prevent.
- Every tool result is logged and returned alongside the final answer (`{answer, toolsCalled: [...]}`) so the UI can show *what the agent actually checked* — this transparency is itself a
  differentiator; don't hide the reasoning trail.
- Final answer generation reuses the grounding-check pattern from `docs/AI_PIPELINE.md` Stage 6:
  every number in the final natural-language answer must trace back to a tool result, or the
  answer is rejected and regenerated once, then falls back to just returning the raw tool
  results with no generated prose.
- New UI: a simple chat panel on the dashboard (`apps/web/src/routes/dashboard/components/CoPilotChat.tsx`).

## Demo moment
Type live: *"Which districts have unresolved water issues older than 90 days that are also
flagged in this monsoon's risk forecast?"* — a question that spans two different features
(base issue tracking + Feature 1's forecasts) that no single existing dashboard view answers
directly. Show the tool-call trail, then the grounded answer.

## Watch out for
- A tool returning empty results — the agent must say "no matching data," never fabricate a
  plausible-sounding answer.
- Any number in the final answer not traceable to a tool call result.
- No hard cap on tool-call turns (runaway loop risk).
- **Rehearse the exact demo question multiple times before presenting it live** — an
  off-script question from a judge is fine to try, but your scripted demo question should be
  bulletproof.

## Effort
~2-3 days, and don't start it until Tier 1 is fully working — this is explicitly the item to cut
first if time runs short, per the tiering in `README.md`.
