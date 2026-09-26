# Full Review Checklist — Pramaan

One line per watch-out item, consolidated from every other skill. Work top to bottom on any
non-trivial PR; skip sections that genuinely don't apply to the diff.

## Architecture (senior-architect)
- [ ] No new synchronous call from `api-gateway` into `worker-ai-pipeline`.
- [ ] Any new table/collection carries `state_id`.
- [ ] No unnecessary new Cloud Run service where an existing one could absorb the work.

## Cloud/deploy (gcp-cloud-architect)
- [ ] No use of the default Compute Engine service account.
- [ ] `api-gateway` min-instances setting untouched or intentionally changed.
- [ ] No unpartitioned new BigQuery table.

## Frontend (senior-frontend)
- [ ] No hardcoded UI strings outside `i18n/*.json`.
- [ ] New forms handle offline/retry, not just the happy path.
- [ ] No client-side-only validation with no server mirror.
- [ ] No client-side jurisdiction filtering layered on top of server-side scoping.

## Backend (senior-backend)
- [ ] New endpoint has a Zod schema.
- [ ] Jurisdiction/auth check present on state-changing endpoints.
- [ ] New external calls wrapped in `withRetry()`.
- [ ] New Pub/Sub handlers are idempotent (status-checked before processing).
- [ ] State-changing actions write an audit log entry.

## Database (senior-database)
- [ ] Schema changes reflected in `packages/shared-types` and the shape-fixture test.
- [ ] New query patterns have a matching Firestore composite index.
- [ ] New collections have an explicit `firestore.rules` entry.

## AI/prompts (senior-prompt-engineer)
- [ ] New/changed prompts have schema validation on the response.
- [ ] Generation prompts have a grounding check.
- [ ] Similarity-threshold changes are validated against the regression fixture set.
- [ ] New prompts handle code-mixed input explicitly.

## AI security (ai-security)
- [ ] No `citizen_id`/`phone_hash`/unnecessary PII inside a prompt sent to an external AI API.
- [ ] Model output isn't treated as authoritative without a validation gate or human review.

## Security/privacy (senior-security)
- [ ] No raw phone numbers or unhashed PII in logs or analytics tables.
- [ ] No secrets committed to the repo.
- [ ] New PII fields have a documented retention window.

## Anti-fraud (threat-detection)
- [ ] New anti-fraud signals flag for review rather than auto-reject.
- [ ] Burst detection (if touched) compares against per-cluster history, not a global constant.

## Testing (senior-qa)
- [ ] Happy-path test present.
- [ ] At least one negative-path test present.
- [ ] Prompt-touching changes re-run the regression suite.

## Localization (localization-voice-ux)
- [ ] Any new string added to every currently-supported language file, not just `en.json`.
- [ ] Any new supported language has STT/Translation codes and fixture coverage, not just a
      translated UI.
