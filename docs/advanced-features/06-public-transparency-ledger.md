# Feature 6: Public Transparency Ledger

## Why this is unique
Pramaan already calls itself a "Digital Public Good." This is the feature that makes that phrase
literally true rather than aspirational: a public, no-login page showing aggregate accountability
data — how many issues are reported, verified, funded, and resolved, and how long each stage
takes, per state. Any citizen, journalist, or auditor can see it without an account. That's a
concrete, demoable answer to "what does 'digital public good' actually mean here."

## What to build (~1 day)

- New endpoint: `GET /public/transparency?state=` — **explicitly unauthenticated**, aggregate-only,
  rate-limited (this is a public surface, protect it like one).
- Returns, per state: total issues reported, % verified, % reaching `funded` status, % `resolved`,
  average days from report to verification and from verification to resolution, and (if Feature 2
  is built) the equity-audit summary.
- **No PII, ever, on this endpoint** — no individual submissions, no photos, no location finer
  than district-level aggregates, no citizen-identifying information of any kind. This is the one
  endpoint in the whole system where a mistake is maximally public, so the review bar is higher,
  not lower.
- Minimum-count threshold before publishing any stat (same k-anonymity-style principle as
  Feature 2's sample-size guard) — never publish "1 unresolved case in Ward X," which could
  effectively identify who reported it.
- New public page: `apps/web/src/routes/public/TransparencyPage.tsx`, no auth wrapper, linked
  from the citizen-facing site's footer.

## Demo moment
Open the page in an incognito browser window with no login: *"This is the same accountability
data our officers see, available to any citizen or journalist, with nothing hidden behind a
login — that's the actual test of 'digital public good,' not just the phrase."*

## Watch out for
- Treat this endpoint's review bar higher than any authenticated one — run it past
  `senior-security`'s PII checklist explicitly before shipping, since there's no auth layer to
  catch a mistake after the fact.
- Don't skip the minimum-count threshold "just for the demo" — a demo habit has a way of
  surviving into the real submission.

## Effort
~1 day — mostly a new aggregation query over data you already compute, plus one public page.
