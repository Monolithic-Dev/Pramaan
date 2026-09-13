---
name: senior-backend
description: >
  Use for apps/api-gateway and apps/worker-ai-pipeline — Fastify routes, Pub/Sub handlers,
  validation, rate limiting, and pipeline orchestration. Trigger on "add an endpoint",
  "handle this webhook", "write the Pub/Sub handler", "add rate limiting", "why did this
  request fail", "wire up this API route".
---

## What this covers for JanSetu specifically
Two Fastify/Node services: `api-gateway` (synchronous, citizen/officer-facing) and
`worker-ai-pipeline` (Pub/Sub-triggered, does the AI work). They're deliberately decoupled so
AI latency never blocks a citizen-facing response — every change here should preserve that.

## Core guidance
- **Every new endpoint gets a Zod schema before it gets a handler.** Validation is not
  bolted on after the happy path works — write it first.
- **Every external call goes through `packages/shared-utils/withRetry()`** — Gemini,
  Translation, STT, BigQuery, WhatsApp. No bare `fetch`/SDK calls without retry/backoff, per
  the pattern established in Phase 4 of `docs/phases`.
- **Every Pub/Sub handler must be idempotent.** Pub/Sub is at-least-once delivery, not
  exactly-once — check the resource's `status` field before processing, every time.
- **`api-gateway` never degrades because `worker-ai-pipeline` is slow or down.** A submission
  gets a `202` as soon as it's durably written and published — see
  `docs/EDGE_CASES.md` #18.

## Example
Adding `POST /issues/{id}/dispute` from `docs/API_SPEC.md` §3: Zod-validate `{reason}`, check
`request.officer.jurisdiction` against `issue.geo_cluster.admin_boundary` before writing
(`403 JURISDICTION_MISMATCH` on mismatch), write the audit log entry, then update status — in
that order, matching the pattern already used for `/verify`.

## Watch out for
- A new endpoint missing jurisdiction scoping.
- A Pub/Sub handler that isn't idempotent.
- A synchronous call from `api-gateway` into `worker-ai-pipeline`.
- Skipping `withRetry()` on a new external call.
- A new state-changing action that forgets to write an audit log entry.

## Hard question
If this external call (Gemini/Translation/BigQuery) times out or errors, what does the
citizen or officer actually see — "nothing changes, they can retry," or does something
silently break? If it's the latter, that's a blocker, not a follow-up.

## Hand off to
`senior-database` for schema changes; `ai-security` before sending citizen-submitted text,
photos, or audio to any AI API; `senior-security` before shipping any new auth-touching
endpoint.
