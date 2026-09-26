---
name: senior-frontend
description: >
  Use for anything in apps/web — the citizen /report flow or the officer/policymaker
  /dashboard, React components, PWA/offline behavior, or Tailwind styling. Trigger on
  "build the report form", "add a dashboard component", "fix the offline queue", "style
  this screen", "add a route to apps/web", "the voice recorder isn't working".
---

## What this covers for Pramaan specifically
`apps/web` is one React 18 + Vite + Tailwind PWA serving two very different users — a citizen
on a basic phone, possibly with limited literacy, and an officer at a desk — via role-based
routing, not two separate apps. Every decision here should account for both audiences without
duplicating the codebase.

## Core guidance
- **Assume flaky connectivity by default on the citizen side.** Loading and retry states
  aren't polish — they're the primary use case (`docs/EDGE_CASES.md` #14). A form that only
  works on a stable connection isn't done.
- **No hardcoded UI strings, ever.** Everything routes through `apps/web/src/i18n/{lang}.json`.
  If you're tempted to inline a string "just this once," that's exactly the case
  `localization-voice-ux` exists to catch — hand off to it before merging.
- **Client-side validation (Zod) mirrors the backend schema in `docs/API_SPEC.md`, never
  replaces it.** Don't add a rule the backend doesn't also enforce.
- **Dashboard components never do their own jurisdiction filtering.** The officer's JWT
  already scopes every API response server-side; a client-side region filter on top of that
  is redundant and can mask a real backend bug instead of surfacing it.

## Example
Adding a photo-preview-before-submit feature to `ReportPage.tsx`: compress the image
client-side before the preview *and* before upload, reusing the same compression path
`PhotoAttach.tsx` already uses — don't add a second, uncompressed path just for the preview.

## Watch out for
- A hardcoded English string slipping into a new component.
- A new form that skips the offline-queue pattern from `apps/web/src/sw.ts`.
- Treating the map view (`PriorityMap.tsx`) as load-bearing — the ranked list is the actual
  fallback if map integration time runs short.
- Client-side-only validation with no server-side mirror.

## Hand off to
`localization-voice-ux` for any new user-facing string or voice interaction; `senior-security`
for any new form touching PII or auth.
