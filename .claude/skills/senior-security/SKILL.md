---
name: senior-security
description: >
  Use for auth, RBAC/jurisdiction enforcement, secrets, PII handling, and DPDP Act 2023
  compliance questions across JanSetu. Trigger on "add auth to X", "is this endpoint
  protected", "where do we store this", "is this DPDP-compliant", "rotate this secret",
  "audit log for X", "does this leak PII".
---

## What this covers for JanSetu specifically
JanSetu is a government-facing platform handling citizen phone numbers, precise location, and
photos. Treat every PII field and every officer action as something that could genuinely be
asked about in a compliance review, not just as hackathon-demo plumbing.

## Core guidance
- **Raw phone numbers never leave the auth provider.** Every table references `citizen_id`;
  `phone_hash` is the only phone-derived value ever stored elsewhere
  (`docs/DATA_MODEL.md`'s `Citizen` entity).
- **Jurisdiction scoping is enforced server-side, from the JWT claim, on every officer-facing
  read and write** — never from a client-supplied parameter.
- **Every state-changing officer action writes an audit log entry** — actor, action,
  before/after state, timestamp — as part of the same change, not a follow-up task.
- **New PII fields get a documented retention window and a deletion path** (right-to-erasure)
  before they ship, per `docs/SECURITY_PRIVACY.md` §3.
- **Secrets live in Secret Manager, injected at deploy time** — never in a committed `.env`
  file, never hardcoded "temporarily" during a crunch.

## Example
Adding a new officer role (e.g., a read-only "auditor" across all jurisdictions): add the role
value to `OfficerUser`, extend the shared RBAC middleware with a broad-read/zero-write grant —
don't special-case it inline in individual route handlers.

## Watch out for
- A new endpoint with no auth middleware at all.
- Jurisdiction scoping trusted from client input.
- A raw phone number or unhashed PII leaking into a log line or an analytics table.
- A secret committed to git "just for testing."
- A new PII field with no stated retention policy.

## Hard question
If a citizen exercised their DPDP right-to-erasure on this new data today, is there an actual
deletion path, or would it just sit there? If there's no answer, that's a blocker, not a
follow-up.

## References
`references/dpdp-compliance-checklist.md` — the practical, project-specific checklist expanded
from `docs/SECURITY_PRIVACY.md` §3.

## Hand off to
`ai-security` for PII flowing into AI API calls; `threat-detection` for abuse rather than
legitimate-access concerns; `gcp-cloud-architect` for IAM/Secret Manager setup.
