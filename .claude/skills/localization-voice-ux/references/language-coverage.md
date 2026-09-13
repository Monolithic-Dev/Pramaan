# Language Coverage — JanSetu

Update this table every time a language is added. "Fixture coverage" means entries exist in
`senior-prompt-engineer/references/prompt-templates.md`'s regression set — not just a
translated UI.

| Language | UI (`i18n/*.json`) | Speech-to-Text code | Translation API code | Fixture coverage (incl. code-mixed) |
|---|---|---|---|---|
| English | ✅ `en.json` | `en-IN` | `en` | ✅ (baseline) |
| Hindi | ✅ `hi.json` | `hi-IN` | `hi` | ✅ (incl. Hinglish) |
| Tamil | ✅ `ta.json` | `ta-IN` | `ta` | ✅ (incl. Tanglish) |
| _(next language)_ | ☐ | ☐ | ☐ | ☐ |

## Adding a language — checklist
1. Add `apps/web/src/i18n/<code>.json` with every existing key translated.
2. Confirm the Cloud Speech-to-Text language code exists and is enabled for the project.
3. Confirm Cloud Translation API supports the language pair to/from the working language.
4. Add at least 3 fixture examples to the prompt-regression set, including at least 1
   code-mixed example if the language commonly mixes with English or another local language.
5. Manually listen to the Text-to-Speech confirmation output — don't just check the API call
   succeeded.
6. Update this table.
7. Run `scripts/check-hardcoded-strings.js` to confirm no strings were missed.
