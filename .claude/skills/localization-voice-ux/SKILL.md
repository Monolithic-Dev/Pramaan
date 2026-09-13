---
name: localization-voice-ux
description: >
  Use for anything involving supported languages, voice input/output, or the multilingual/
  low-literacy UX requirement that's an explicit hackathon judging criterion. Trigger on
  "add a language", "the voice flow isn't working in X language", "is this string
  translated", "code-mixed input handling", "TTS/STT for a new language".
---

## What this covers for JanSetu specifically
Multilingual and voice support isn't a UI nice-to-have here — it's a named requirement in the
hackathon brief and a specific judging criterion, and it's the single requirement most likely
to quietly erode under an 18-day crunch without something explicitly guarding it. That's this
skill's job.

## Core guidance
- **Every new user-facing string goes into `apps/web/src/i18n/{lang}.json` for every
  currently-supported language before merging.** A string only in `en.json` is a bug, not a
  follow-up task.
- **A new supported language needs three things to actually work end-to-end**, not just a
  translated UI: a Cloud Speech-to-Text language code, a Cloud Translation API language pair,
  and at least 3 entries in the prompt-regression fixture set
  (`senior-prompt-engineer/references/prompt-templates.md`) covering that language, including
  at least one code-mixed example if relevant.
- **The voice/TTS confirmation flow is for low-literacy users specifically** — verify it by
  actually listening to the audio output, not just confirming the TTS API call succeeded.
- **Code-mixed input (Hinglish, Tanglish, etc.) is not an edge case to handle "later."**
  `docs/EDGE_CASES.md` #2 names it explicitly, and it belongs in the fixture set from day one
  for every supported language pair.

## Example
Adding Bengali as a fourth demo language: add `bn.json`, confirm Speech-to-Text's `bn-IN`
language code and Cloud Translation's Bengali support, add 3+ Bengali examples (including at
least one code-mixed Bengali-English one) to the prompt-regression fixture set, and manually
listen to the TTS confirmation output before calling the language "done."

## Watch out for
- A new string that only makes it into `en.json`.
- A "supported language" only ever tested via the UI toggle, never actually run through
  STT/Translation/TTS end-to-end.
- Code-mixed input treated as an afterthought.
- A voice flow that's never actually been listened to by a human.

## Scripts
`scripts/check-hardcoded-strings.js` — scans `apps/web/src` for likely hardcoded UI string
literals outside the i18n files. Run before merging any frontend PR.

## References
`references/language-coverage.md` — current supported languages with their
Speech-to-Text/Translation API codes and fixture-set coverage status.

## Hand off to
`senior-frontend` for UI implementation; `senior-prompt-engineer` for fixture-set additions.
