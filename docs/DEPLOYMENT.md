# Deployment: JanSetu

## 1. Environments
- **dev** — local + a shared GCP dev project, used during the hackathon build.
- **staging** — mirrors prod config, used for the pre-demo-day rehearsal.
- **prod** — the URL judges actually open. Deploy early and often; don't first deploy to prod the night before demo day.

Config is environment-specific via `.env` files (never committed) layered with Secret Manager for anything sensitive.

## 2. CI/CD
GitHub Actions pipeline:
1. On pull request: lint, unit tests (see `TESTING.md`), prompt-regression test suite.
2. On merge to `main`: build container image → push to Artifact Registry → deploy to **staging** Cloud Run automatically.
3. Promote staging → prod manually (or automatically, given hackathon time pressure — but keep a one-command rollback ready).

## 3. Services & scaling

| Service | Compute | Scaling notes |
|---|---|---|
| Ingestion Gateway | Cloud Run | min instances 0-1, concurrency ~40 — must stay responsive even under a submission burst |
| Categorization/Dedup worker | Cloud Run job or Pub/Sub-triggered Cloud Function | Scales with queue depth, not request rate — decoupled from citizen-facing latency |
| Prioritization Engine | Cloud Run (scheduled via Cloud Scheduler, e.g. every 15 min, or on-demand) | Doesn't need to be real-time — a policymaker dashboard refreshing every few minutes is completely acceptable |
| Dashboard API | Cloud Run | min instances 1 for demo-day reliability (avoid a cold-start on stage) |
| Frontend | Firebase Hosting / CDN | Static assets, cache aggressively |

## 4. Cost & scale considerations for a national rollout
- Partition BigQuery tables by `state_id` and date to keep query costs bounded as data grows.
- Firestore composite indexes for the common query patterns (`region + status`, `region + category`).
- Cache policymaker dashboard aggregates (Cloud CDN or an in-memory layer) — these don't need sub-second freshness, and caching is the cheapest lever for handling a large number of read-heavy officer/policymaker sessions.

## 5. Federation model ("scale across India")
- **Hackathon build (Option A):** single shared multi-tenant deployment, every table/collection partitioned by `state_id`.
- **Documented production target (Option B):** each state runs its own instance/project with in-state data residency; a lightweight national aggregator polls a shared, versioned API contract (`API_SPEC.md`) for cross-state reporting.
- The schema (`DATA_MODEL.md`) and API contract are designed so this move is a deployment/config change, not a rewrite — call this out explicitly in the pitch deck as evidence the "scale across India" requirement was a structural design decision, not an afterthought.

## 6. Monitoring & alerting
- Cloud Monitoring dashboards: submission volume, dedup merge rate, AI pipeline latency and error rate, officer response time (time from `verified` to `prioritized`).
- Example alert: Gemini API error rate > 5% over 5 minutes → page the on-call team member.
- Structured logging throughout (correlation ID per submission, traceable end-to-end through the pipeline) — useful both for debugging during the hackathon and as a "we thought about observability" signal for judges.

## 7. Demo-day readiness checklist
- Prod deployed and rehearsed at least 24 hours before demo day, not the night before.
- A realistic synthetic dataset pre-loaded (see `TESTING.md`) so the dashboard isn't empty for the judges.
- A fallback plan if live internet/demo environment fails: a recorded video walkthrough as backup (the 3-5 minute demo video required in the submission package doubles as this fallback).
