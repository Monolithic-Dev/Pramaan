# DPDP Act 2023 Practical Checklist — Pramaan

Expanded from `docs/SECURITY_PRIVACY.md` §3. Walk this for any feature touching citizen data.

## Consent
- [ ] Is there an explicit consent notice, in the citizen's selected language, shown *before*
      any location/contact/photo data is collected for this feature?
- [ ] Is the consent notice specific about what the data will be used for (infrastructure
      prioritization), not a generic blanket statement?

## Purpose limitation
- [ ] Is this data used only for infrastructure prioritization, or does this feature introduce
      a secondary use (analytics dashboards for a different purpose, marketing, etc.)?
- [ ] If a secondary use is genuinely needed, has fresh, specific consent been designed for it?

## Data minimization
- [ ] Does this feature collect only the fields it actually needs?
- [ ] Is any PII being sent somewhere (a log, an analytics table, an AI API prompt) that
      doesn't need it? (Cross-check with `ai-security` for the AI-API case specifically.)

## Retention
- [ ] Does this new PII field have a stated retention window?
- [ ] Is there an automated deletion mechanism (e.g. a Cloud Storage lifecycle rule, a
      scheduled Firestore cleanup job) rather than a manual "we'll delete it eventually"?

## Right to erasure
- [ ] If a citizen requests deletion, is there an actual code path that removes their data?
- [ ] If their submission was the sole source for an `Issue`, does that `Issue` get tombstoned
      rather than left silently orphaned or attributed to nobody?

## Data localization
- [ ] Is data for this feature stored in an India region (`asia-south1`), not a default
      multi-region bucket/dataset?

## Breach process
- [ ] Is there a documented (even if simple, for hackathon scope) process for who gets
      notified and within what window if this data were exposed?

## Audit
- [ ] Does every access/modification to this data get logged with an actor and timestamp?
