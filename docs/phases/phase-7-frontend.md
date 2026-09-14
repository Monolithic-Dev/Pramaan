# Phase 7 of 10: Frontend

**Days 5-13 · Track B · Runs in parallel with Phases 4-6**

## Objective
One React PWA, role-routed: a citizen report flow that works in under 60 seconds on a slow connection, and an officer interface where the chat is primary and the map supports it.

Starts Day 5 against the Phase 3 mock server. **Does not wait for backend completion.**

## Prerequisites
Phase 1 complete. Phase 3 mock server available (Day 4). Phase 2 shared types available.

## Reference docs
`API_SPEC.md` · `TECH_STACK_AND_REPO.md` §1.3, §2.3 · `PRD.md` §6

---

## Deliverables

### 7.1 Citizen flow (`/report`)
Design constraint: a first-time user, low literacy, patchy 3G, no English. Everything below follows from that.

- **Language selector first**, before anything else, with native script labels (हिन्दी · தமிழ் · বাংলা · English). Not a dropdown buried in a header.
- **Big voice-record button as the primary action**, text entry secondary. Typing is the fallback, not the default — this inverts the usual form design and it is the whole point of the accessibility claim.
- Photo: optional, single tap.
- Location: auto from GPS, with a clear "describe it instead" path that accepts a landmark in the citizen's own language.
- Consent notice in the selected language, shown **before** location is requested, not after.
- Confirmation with a tracking ID and **spoken read-back** via Text-to-Speech (`PRD.md` §6.7 — a written confirmation is useless to the user this flow is designed for).

Performance target: usable on a simulated 3G connection. Test with Chrome DevTools throttling, not on office WiFi.

### 7.2 Offline PWA
Service worker, IndexedDB queue, background sync, original idempotency key preserved on replay. Visible "queued — will send when you're back online" state in the citizen's language.

Demos in ten seconds: airplane mode on, submit, airplane mode off, watch it sync. Worth including in the video.

### 7.3 Officer interface (`/officer`)
Split view. **Chat is primary — roughly 60% of the width.** The map supports the conversation; it is not the main event.

**Chat panel:**
- Streaming response with **visible tool-call chips** as they fire: `🔧 query_fused_data → 3 rows (340ms)`. Do not hide these behind a details toggle. They are the evidence that function calling is real, and they are what a judge is looking for.
- Citations as inline superscripts; clicking one opens the underlying tool result.
- Refusals rendered distinctly — a neutral informational card, not an error state. The agent declining to guess is correct behaviour and the UI should communicate that, not apologise for it.
- Suggested starter questions, so a judge who does not know what to ask still sees the feature work.

**Map panel:**
- Clustered markers sized by `distinct_reporter_count`, coloured by `composite_score`.
- Click → issue detail with the full score breakdown.
- Filters: category, status, score range.
- Syncs with chat context — asking about Ward 14 pans the map there.

### 7.4 Score breakdown component
The single most important officer-facing component. Show every term, its weight, its contribution, and **every fallback disclosure in plain language**: *"No ward-level poverty data available — district average used."*

This is what answers "why did my ward rank lower." Make it a first-class panel, not a tooltip.

### 7.5 Issue detail
Merged submissions list (showing the original language of each alongside its translation — this makes the multilingual dedup visible rather than merely claimed), photos, timeline, verify/dispute actions, generated brief with its citation panel and groundedness status.

### 7.6 Impact loop UI
Officer: mark complete. Citizen: confirmation prompt in their language, photo optional, yes/no. Officer: confirmation count against the required threshold.

### 7.7 Data-origin badges
Anywhere `data_origin: "synthetic_demo"` appears, badge it visibly. The hackathon explicitly rewards honesty about what is real versus illustrative — a visible badge in the UI is far stronger evidence of that than a line in the README, and it costs nothing.

### 7.8 Design
Government-tool aesthetic: high contrast, generous type, no decorative motion. Restraint reads as credibility here — a dashboard that looks like a consumer analytics product undermines the "a state IT department could run this" claim.

Minimum 16px base font on the citizen flow. Test at 200% browser zoom.

---

## Acceptance criteria

- [ ] Citizen report submitted in under 60 seconds by someone who has not seen the app before (time an actual person)
- [ ] Full citizen flow works throttled to slow 3G
- [ ] Voice recording works on Android Chrome **and** iOS Safari (iOS audio permissions differ — test on a real device)
- [ ] Offline submit → reconnect → exactly one record created
- [ ] All 4 languages render correctly, including Tamil and Bengali script
- [ ] Spoken confirmation plays in the selected language
- [ ] Tool-call chips appear in the chat **before** the response text streams
- [ ] Clicking a citation shows the underlying tool result
- [ ] Score breakdown shows every component and every fallback in plain language
- [ ] A refusal renders as an informational card, not an error
- [ ] Map with ~500 issues loads in under 3 seconds
- [ ] Officer outside their jurisdiction sees a clear permission message, not a blank screen
- [ ] Synthetic-data badges visible wherever synthetic data is displayed
- [ ] Lighthouse accessibility ≥ 90 on the citizen flow

## Definition of done
Hand a phone to someone who has never seen the app, in a language you do not read, and they successfully file a report.

## Traps
- iOS Safari requires a user gesture to start audio recording and will not autoplay TTS. Test on real hardware, not the simulator.
- SSE reconnection on mobile network switching needs explicit handling or the chat silently dies mid-answer.
- Tamil and Bengali need proper font fallbacks; system defaults on some Android builds render boxes. Bundle Noto.
- Do not build a separate citizen app. One app, role-based routing — `TECH_STACK_AND_REPO.md` §2.3 is right about this.
- Map marker clustering at 500+ points needs the clustering library, not raw markers, or the map janks on mid-range phones.

## Handoff
A real, deployed citizen-facing flow and a working officer chat+map interface exist. Tag `phase-7-done`.
