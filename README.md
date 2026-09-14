# JanSetu

AI-powered citizen demand → infrastructure priority platform. See [`docs/`](docs/) for the full spec set (PRD, architecture, data model, AI pipeline, security, roadmap) and [`docs/phases/`](docs/phases/) for the phase-by-phase build plan.

## Monorepo layout
```
apps/
  web/                 React (Vite) PWA — citizen report flow + officer/policymaker dashboard
  api-gateway/          Fastify — ingestion, auth, agent endpoint
  worker-ai-pipeline/   Node service — categorization, dedup, prioritization, brief generation
packages/
  shared-types/         TypeScript interfaces mirroring docs/DATA_MODEL.md
  shared-utils/         geospatial helpers, cosine similarity, formatting
  ai-prompts/           versioned prompt templates from docs/AI_PIPELINE.md
infra/gcp/              gcloud setup scripts
```

## Getting started
```bash
pnpm install
pnpm turbo run dev
```

- `apps/api-gateway` → http://localhost:8080/healthz
- `apps/worker-ai-pipeline` → http://localhost:8081/healthz
- `apps/web` → http://localhost:5173

## Scripts
- `pnpm turbo run build` — build every app/package
- `pnpm turbo run lint` — typecheck every app/package
- `pnpm turbo run test` — run all tests (Vitest)

## GCP setup
```bash
infra/gcp/setup.sh <gcp-project-id>
```
Enables the APIs required by later phases (Vertex AI, Cloud Run, Firestore, BigQuery, Pub/Sub, Secret Manager, Translation, Speech-to-Text).
