# Tech Stack & Repository Structure: JanSetu

This document makes the implementation decisions concrete. `ARCHITECTURE.md`, `API_SPEC.md`, and `AI_PIPELINE.md` describe the system in language-agnostic terms — this is the layer on top that says exactly what to type into `pnpm create`.

## TL;DR
- **Language: TypeScript, end-to-end** — frontend, backend API, and the AI worker service all in one language.
- **Repo: Monorepo** — pnpm workspaces + Turborepo, one GitHub repo.
- Both decisions are driven by the same constraint: **a small team with ~18 days and one repo to submit** should minimize coordination overhead everywhere it can, and spend the saved time on the AI pipeline (Phase 3 of `ROADMAP.md`), which is where the judging weight actually is.

---

## 1. Language decision

### 1.1 The real choice
The frontend is locked to the JavaScript/TypeScript ecosystem regardless (React is the practical default for a PWA on this timeline). So the actual decision is: **what language runs the backend API and the AI pipeline worker?**

| Criterion | TypeScript (Node.js) | Python |
|---|---|---|
| Gemini API / Vertex AI SDK maturity | Official `@google/genai` and `@google-cloud/vertexai` Node clients are solid and fully cover what this project needs (structured output, multimodal, embeddings) | Most mature SDK overall, slightly ahead on bleeding-edge features, but nothing here needs those |
| This project's actual AI workload | API orchestration (call Gemini, call embeddings, do a cosine similarity + radius query, call Gemini again) — no custom model training | Same workload, but Python's edge (numpy/pandas/scikit-learn) matters most for *training* models, which is a stretch goal here, not the MVP |
| Shared types between frontend and backend | Free — one `shared-types` package, no contract drift | Requires generating a client from an OpenAPI spec, or hand-syncing types — an extra step |
| Team coordination for 1-4 people | One language, one set of tooling, anyone can touch any part of the stack | Two languages (Python backend, TS frontend) means either two skillsets or context-switching for everyone |
| Cosine similarity / geo-radius dedup logic (`AI_PIPELINE.md` Stage 3) | Trivial to hand-roll in ~30 lines, no heavy library needed | Also trivial, but doesn't get anything extra from scikit-learn at this scale |
| Risk under time pressure | Lower — one less integration seam | Higher — cross-language contract drift is exactly the kind of bug that eats a day right before demo day |

**Decision: TypeScript, end-to-end.** The Python ecosystem's real advantage (data science tooling for training models) isn't where this project's MVP effort goes — the AI work here is orchestration, not training. Given that, the cost of a two-language split isn't worth paying.

### 1.2 Why not other stacks (brief, for completeness)
- **Go / Java** — excellent for large-scale, long-lived backend systems, but slower iteration speed for a small team on an 18-day clock, with no specific benefit for this workload.
- **Full Python (FastAPI) backend + separate TS frontend** — a legitimate alternative if your team is meaningfully stronger in Python than TypeScript. See Section 5 for how to do this without paying the full contract-drift cost.

### 1.3 Per-layer stack table

| Layer | Language | Framework / library |
|---|---|---|
| Frontend (citizen report flow + officer Conversational UI) | TypeScript | React 18 + Vite, Tailwind CSS, one app with role-based routing (see 4.3) |
| API Gateway (ingestion, auth, agent/dashboard reads) | TypeScript | Fastify — lighter and faster than Express/NestJS for a service this size, first-class TS support |
| AI Worker (agent orchestration, tools, categorization, dedup) | TypeScript | Node.js, hosts `@google/genai` function schemas for the Agent to call |
| Shared types/contracts | TypeScript | Internal `@jansetu/shared-types` workspace package, mirrors `DATA_MODEL.md` |
| Request/schema validation | TypeScript | Zod — same schema used for frontend form validation and backend request validation |
| Infra as code | Terraform (HCL) if someone on the team knows it; otherwise a scripted `gcloud` setup file | Don't learn Terraform under a hackathon clock just for its own sake — a documented shell script of `gcloud` commands is a perfectly fine substitute for this scope |
| Synthetic demo dataset generator (`TESTING.md`) | TypeScript (Python is fine too — it's a throwaway script, not a service) | Node script, run once to seed Firestore/BigQuery |
| Testing | TypeScript | Vitest (unit/integration), Playwright (e2e for the citizen report flow) |
| Package manager | — | pnpm |

---

## 2. Repo structure decision: monorepo vs. separate repos

### 2.1 The constraint that settles it
The hackathon submission package asks for **"Source code — public or access-granted GitHub repository"** — singular. Judges are evaluating dozens of submissions in limited time; they need to open one link and see the whole system, not chase down four repos to understand how ingestion connects to the dashboard.

### 2.2 Comparison

| Criterion | Monorepo | Polyrepo (one repo per service) |
|---|---|---|
| Judge evaluation | One link, everything visible | Requires linking multiple repos — harder to assess "end-to-end" in a short review window |
| Cross-service changes | One PR updates API + shared types + the frontend that consumes them, atomically | Requires coordinated PRs across repos — real drift risk on a tight clock |
| Shared types/contracts | Free — import from a workspace package | Needs a published/versioned package — overhead not justified at this scale |
| CI/CD | One pipeline with path-based filters | Multiple pipelines to build and maintain |
| Fits a 1-4 person team | Yes — no org/ownership boundaries to manage | Solves a problem (independent team ownership) that doesn't exist yet |
| Post-hackathon federation (`ARCHITECTURE.md` Option B) | Each `apps/*` still deploys independently — path-based CI triggers handle this without splitting the repo | N/A |

**Decision: monorepo.** There isn't a real trade-off here at this team size and timeline — polyrepo would be solving an organizational problem you don't have yet, at the cost of exactly the kind of integration overhead you can't afford this week.

### 2.3 Concrete folder layout
```
jansetu/
├── apps/
│   ├── web/                     # React app — citizen report flow (/report) +
│   │                             officer conversational AI interface (/chat),
│   │                             role-based routing, one codebase
│   ├── api-gateway/              # Fastify — ingestion, auth, agent endpoint
│   └── worker-ai-pipeline/       # Node service — agent orchestrator & tool definitions,
│                                  categorization, dedup, brief generation
├── packages/
│   ├── shared-types/             # TypeScript interfaces mirroring DATA_MODEL.md
│   ├── shared-utils/             # geospatial helpers, cosine similarity, formatting
│   └── ai-prompts/                # versioned prompt templates from AI_PIPELINE.md,
│                                  central so a prompt change is one PR, testable
│                                  against TESTING.md's regression set
├── infra/
│   └── gcp/                       # Terraform or gcloud setup scripts (Section 1.3)
├── scripts/
│   └── seed-demo-data/            # synthetic dataset generator (TESTING.md)
├── docs/                          # this doc folder — PRD.md, ARCHITECTURE.md, etc.
├── e2e/                           # Playwright end-to-end tests spanning apps
├── .github/workflows/             # CI/CD pipelines (path-filtered)
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

Note: `web` is deliberately **one app**, not two. Splitting citizen-facing and officer-facing UIs into separate apps is a reasonable choice at real production scale, but at hackathon scale it means duplicated build config, duplicated deploy pipelines, and a duplicated design system for no benefit a judge will notice. Role-based routing inside one app gets you the same result faster.

### 2.4 CI/CD in a monorepo
- Turborepo caches build/test/lint tasks and, combined with GitHub Actions path filters, only rebuilds what actually changed in a given PR.
- Each `apps/*` deploys to its own Cloud Run service or Firebase Hosting target independently — a monorepo is a source-code organization choice, not a deployment coupling. This is exactly what preserves the Option A → Option B federation path described in `ARCHITECTURE.md` and `DEPLOYMENT.md`.
- `packages/*` are consumed via the pnpm workspace protocol (`"shared-types": "workspace:*"`) — no need to actually publish an npm package during the hackathon.

---

## 3. If your team is Python-first (alternative path)
If most of your team is meaningfully stronger in Python than TypeScript, it's legitimate to trade some contract-drift risk for real velocity gains from people working in the language they know best:
- Backend + AI worker: **FastAPI**, with Pydantic models mirroring `DATA_MODEL.md`.
- Generate an OpenAPI spec from FastAPI, then generate a TypeScript client for the frontend from that spec (`openapi-typescript` or similar) — this replaces hand-maintained shared types with a generated contract, which keeps most of the drift-prevention benefit without requiring the backend team to write TypeScript.
- The monorepo decision in Section 2 doesn't change — the language split lives inside `apps/api-gateway` and `apps/worker-ai-pipeline`, everything else stays the same.
- Everything in `API_SPEC.md`, `AI_PIPELINE.md`, and `ARCHITECTURE.md` remains valid either way — those documents describe contracts and behavior, not implementation language.

---

## 4. Quickstart (bootstrap commands)
```bash
# Initialize the monorepo
pnpm dlx create-turbo@latest jansetu
cd jansetu

# Frontend
pnpm create vite apps/web --template react-ts

# Backend service scaffolds (create manually, add package.json + tsconfig per app)
mkdir -p apps/api-gateway apps/worker-ai-pipeline
mkdir -p packages/shared-types packages/shared-utils packages/ai-prompts

# Shared tooling
pnpm add -w -D typescript zod vitest @playwright/test eslint prettier

# Google AI / Cloud SDKs (in the relevant app's package.json)
pnpm --filter worker-ai-pipeline add @google/genai @google-cloud/vertexai @google-cloud/firestore @google-cloud/bigquery @google-cloud/pubsub
pnpm --filter api-gateway add fastify @google-cloud/firestore

# Run everything
pnpm turbo run dev
```

This gets a running skeleton in under an hour, leaving the rest of Phase 1 (`ROADMAP.md`) for actual data sourcing and schema finalization rather than tooling setup.
