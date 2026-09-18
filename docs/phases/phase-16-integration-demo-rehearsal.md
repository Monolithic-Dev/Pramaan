# Phase 16 of 16: Integration, Pitch Deck/Video Update & Final Rehearsal

## Header
- **Goal (done = ):** Every feature actually built in Phases 10-15 is reflected in the demo
  video, the pitch deck, and the GitHub repo — and the whole system has been rehearsed
  end-to-end at least once against production, incorporating the new features.
- **Preconditions:** Phases 10-15, whichever were actually completed — this phase adapts to
  what got built, per the tiering system in `docs/advanced-features/README.md`.
- **Specs implemented:** `docs/advanced-features/DEMO_SCRIPT.md`, `docs/TESTING.md` §6,
  `docs/ROADMAP.md` (the original submission-package step, redone with the enhanced feature
  set).

## Task breakdown
1. Re-run the authorization audit pattern from Phase 9 task 1, extended to cover every new
   endpoint added in Phases 10-15: `/forecasts`, `/my-reports/*`, `/equity-audit`,
   `/public/transparency`, `/admin/states`, `/copilot/ask`.
2. Re-run the secrets scan from Phase 9 task 2 — new features may have introduced new API keys
   or config.
3. Update `docs/advanced-features/DEMO_SCRIPT.md`'s timing to reflect which features actually
   made it in versus which are being described as roadmap-only.
4. Re-record the 3-5 minute demo video following the updated script.
5. Update the pitch deck: add or update a slide explicitly naming the new differentiators and
   which judging criterion each maps to — reuse the mapping table from
   `docs/advanced-features/README.md` directly rather than re-deriving it.
6. Update the root project `README.md` and `docs/README.md` to mention the advanced features and
   link to `docs/advanced-features/`.
7. Full end-to-end manual QA pass (`docs/TESTING.md` §6, extended with a new-feature checklist):
   every new feature demoed live against the production URL, cold, at least 24 hours before the
   actual demo/submission.
8. Final submission package check: source code (repo, now including Phases 10-16), demo video,
   pitch deck, 2-3 line description (update if the elevator pitch changed given the new
   features), deployed link.

## Real-world engineering concerns
- The authorization audit (task 1) matters exactly as much here as in Phase 9 — every endpoint
  added under time pressure in Phases 10-15 is a fresh opportunity for a jurisdiction or auth
  gap, and this is the last checkpoint before submission.
- Resist adding more features once this phase starts. This is explicitly the phase where
  building stops and presenting starts.

## Definition of done
- [ ] Every new endpoint from Phases 10-15 passes the extended authorization audit.
- [ ] The demo video accurately reflects what's actually deployed and working — no vaporware in
      the video.
- [ ] The pitch deck explicitly maps each shown feature to a judging criterion.
- [ ] The full submission package is complete and the deployed link works cold with no prior
      state.

## Risks & blockers
- The single biggest risk at this stage is a late feature that "mostly works" making it into the
  demo video and then behaving differently live. If something didn't pass its rehearsal cleanly
  in Phase 15 or elsewhere, cut it from the video too, not just from the live demo plan.

## Time budget
**3 days**, using the remaining buffer in the ~12-day window. Do **not** cut this phase short to
squeeze in more features — an unrehearsed demo of five great features scores worse than a
rehearsed demo of three.

## Handoff
Submission-ready with the enhanced feature set. Tag `phase-16-done` / `submission-v2`. This is
the last phase — there is no next phase, only the actual submission.
