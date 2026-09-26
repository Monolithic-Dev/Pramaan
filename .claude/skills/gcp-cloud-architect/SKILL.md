---
name: gcp-cloud-architect
description: >
  Use for anything touching Cloud Run configs, Firestore/BigQuery/Pub/Sub provisioning,
  IAM/service accounts, CI/CD deploy pipelines, or scaling/cost questions for Pramaan's
  all-GCP stack. Trigger on "how do I deploy this", "what Cloud Run settings", "IAM
  permissions for X", "why is this Cloud Run service cold-starting", "CI/CD pipeline",
  "how much will this cost at national scale".
---

## What this covers for Pramaan specifically
Pramaan is 100% GCP-native: Cloud Run for all compute, Firestore + BigQuery as the split
datastore, Pub/Sub as the decoupling layer between ingestion and the AI pipeline, per
`docs/DEPLOYMENT.md` and `docs/ARCHITECTURE.md`. This skill owns getting that stack actually
deployed, scoped, and affordable — not just described.

## Core guidance
- `api-gateway` needs **min-instances ≥ 1** in production — it's citizen-facing, and a cold
  start is a visible bad first impression. `worker-ai-pipeline` can scale to zero — it's
  Pub/Sub-triggered and latency-tolerant.
- Every service gets **its own minimal service account**, never the default Compute Engine
  SA. `worker-ai-pipeline` needs Firestore write, BigQuery read, Vertex AI user, and Pub/Sub
  subscriber — nothing more.
- CI/CD path-filtering (Turborepo + GitHub Actions) should mean a PR touching only `apps/web`
  doesn't redeploy `worker-ai-pipeline` — verify the filters actually match the monorepo
  layout in `docs/TECH_STACK_AND_REPO.md`, don't assume they do.
- BigQuery cost scales with bytes scanned, not rows — `infra_index`/`investment_record` must
  stay partitioned by `state_id` and date per `docs/DEPLOYMENT.md` §4, or a demo-scale mistake
  becomes a real bill at national scale.

## Example
Adding an endpoint that needs BigQuery data on every request: don't call BigQuery directly
from `api-gateway` per-request — that's the wrong latency profile for a citizen-facing
endpoint. Read from the Firestore/cache copy that Phase 5's 15-minute rescore job already
maintains, the same pattern `GET /priorities` already uses.

## Watch out for
- Using the default Compute Engine service account instead of a scoped one.
- Forgetting to set min-instances on `api-gateway` before a demo.
- An unpartitioned BigQuery table.
- A Pub/Sub subscription still pointed at a placeholder URL after a redeploy (the exact trap
  Phase 1 sets up and Phase 9 is supposed to fix).

## Hard question
What's this service's actual expected request volume at the national-scale story the pitch
deck tells — and does the current Cloud Run concurrency/instance config support that, or just
the demo dataset?

## Scripts
`scripts/check-gcp-config.sh` — verifies the required GCP APIs are enabled and expected
resources (Firestore DB, `raw-submissions` Pub/Sub topic/subscription, `pramaan_analytics`
BigQuery dataset) exist. Safe to re-run at any point.

## References
`references/gcp-command-reference.md` — condensed `gcloud`/`bq`/`firebase` CLI commands used
across `docs/DEPLOYMENT.md` and the phase runbooks, kept in one place.

## Hand off to
`senior-security` for IAM/secrets specifics; `senior-architect` before adding a new service
rather than extending an existing one.
