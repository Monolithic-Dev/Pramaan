---
name: senior-architect
description: >
  Use when making or reviewing structural decisions for JanSetu — service boundaries
  between apps/api-gateway, apps/worker-ai-pipeline, and apps/web; the Firestore-vs-BigQuery
  split; the multi-tenant state_id partitioning model; or anything that would force
  revisiting docs/ARCHITECTURE.md. Trigger on "should this be its own service", "how should
  X and Y talk to each other", "does this change the architecture", "how do we scale this
  across states", "is this the right place for this logic".
---

## What this covers for JanSetu specifically
JanSetu's architecture rests on two deliberate decisions: ingestion is decoupled from the AI
pipeline via Pub/Sub (so citizen-facing latency never depends on AI availability), and every
table/collection is partitioned by `state_id` so the system can move from a single shared
deployment (Option A) to a per-state federated one (Option B) as a config change, not a
rewrite. This skill exists to keep both decisions intact as the codebase grows.

## Core guidance
- **Never reintroduce synchronous coupling.** A new feature must not make `api-gateway` call
  `worker-ai-pipeline` directly — that recreates the citizen-blocked-by-AI-latency problem
  `docs/EDGE_CASES.md` #18 was written to prevent. Publish an event; don't call a function.
- **Every new entity or query pattern gets checked against the `state_id` rule** before it
  ships. A collection or table missing it silently breaks the Option A→B federation path.
- **New AI stages need a documented fallback** — retry, then graceful degrade, never a silent
  drop — matching the pattern already established in `docs/AI_PIPELINE.md`.
- **Prefer folding a new responsibility into an existing service over spinning up a new one.**
  Ask whether it genuinely needs independent scaling, or whether it's one more scheduled job
  or route inside something that already exists — every extra Cloud Run service is one more
  thing that can fail at demo time.

## Example
A teammate proposes a "trending issues" push-notification feature. Correct call: this is a
read of already-scored `Issue` data on a schedule — a new job inside
`worker-ai-pipeline/src/scoring/scheduler.ts`'s pattern, not a new standalone service, unless
notification volume genuinely demands independent scaling (it won't, at hackathon scale).

## Watch out for
- A new feature adding a synchronous cross-service call.
- A new table/collection missing `state_id`.
- BigQuery being used as a primary write path for anything operational — it's for analytics
  and joins; Firestore owns low-latency operational writes.
- Scope creep toward Option B's per-state federation before Option A even demos cleanly.

## Hard question
Does this genuinely need independent scaling, or does it just feel more "architecturally
correct"? If there's no concrete scaling number behind the answer, default to folding it into
an existing service — this project has 18 days, not a quarter.

## Hand off to
`gcp-cloud-architect` for the deployment topology of any new service; `senior-security` for
anything that newly crosses a trust boundary.
