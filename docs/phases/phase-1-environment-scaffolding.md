# Phase 1 of 9: Environment & Scaffolding

## Plan at a glance (all phases)

| # | Phase | Time budget | Track | Depends on |
|---|---|---|---|---|
| 1 | Environment & Scaffolding | 1 day | Whole team | — |
| 2 | Data Layer | 1 day | Whole team | Phase 1 |
| 3 | Core Backend: Ingestion, Auth & Validation | 2 days | Backend/AI | Phase 1, 2 |
| 4 | AI Pipeline I: Normalization, Categorization & Deduplication | 4 days | Backend/AI | Phase 3 |
| 5 | AI Pipeline II: Prioritization & Grounded Generation | 3 days | Backend/AI | Phase 2, 4 |
| 6 | Frontend: Citizen Report Flow | 5 days (parallel) | Frontend | Phase 3 |
| 7 | Frontend + Backend: Officer/Policymaker Dashboard | 5 days (parallel) | Frontend + Backend | Phase 3, tail of 4/5 |
| 8 | Verification, Anti-Fraud & Impact Loop | 3 days | Whole team converges | Phase 4, 7 |
| 9 | Security Hardening, Deployment & Demo Prep | 3 days (+1 day buffer) | Whole team | Phases 1-8 |

**Suggested day map for an 18-day window, assuming a 3-4 person team split into a Backend/AI track and a Frontend track:**
Day 1 → Phase 1. Day 2 → Phase 2. Days 3-4 → Phase 3 (Backend/AI track), Phase 6 also starts day 5 (Frontend track). Days 5-8 → Phase 4. Days 9-11 → Phase 5. Days 10-14 → Phase 7 (Frontend track, overlapping Phase 5's tail). Days 12-14 → Phase 8. Days 15-17 → Phase 9. Day 18 → buffer.

The critical path is 1→2→3→4→5→8→9 (17 days). Phases 6 and 7 run on a parallel frontend track and must both be done before Phase 8 needs Phase 7's officer "mark-complete" action point — adjust the day map to your actual team composition, but keep this dependency order.

---

## Header
- **Goal (done = ):** A running, empty monorepo skeleton, deployed to a placeholder Cloud Run health-check endpoint, with CI green, that every later phase builds directly into.
- **Preconditions:** None — this is the first phase. Team has GCP billing/project access and a GitHub org/repo.
- **Specs implemented:** `TECH_STACK_AND_REPO.md` (all sections), `ARCHITECTURE.md` §1-2 (component list), `DEPLOYMENT.md` §1 (environments).

## Task breakdown
1. Create the GitHub repo (`jansetu`). Add `.gitignore` (node, env files, terraform state). Enable branch protection on `main` requiring CI to pass before merge.
2. Bootstrap the monorepo: `pnpm dlx create-turbo@latest jansetu`. Confirm `turbo.json`, `pnpm-workspace.yaml`, and root `package.json` exist.
3. Scaffold `apps/web`: `pnpm create vite apps/web --template react-ts`. Add Tailwind: `pnpm --filter web add -D tailwindcss postcss autoprefixer`, then `npx tailwindcss init -p` inside `apps/web`.
4. Scaffold `apps/api-gateway`: create `apps/api-gateway/package.json` and `apps/api-gateway/src/index.ts` with a minimal Fastify server and a `GET /healthz` route returning `{status: "ok"}`.
5. Scaffold `apps/worker-ai-pipeline`: create `apps/worker-ai-pipeline/package.json` and `apps/worker-ai-pipeline/src/index.ts` exposing `POST /pubsub-push`, which for now just logs the payload (real logic arrives in Phase 4).
6. Scaffold shared packages: `packages/shared-types/src/index.ts`, `packages/shared-utils/src/index.ts`, `packages/ai-prompts/src/index.ts` — each an empty export placeholder for now.
7. Wire workspace references: add `"@jansetu/shared-types": "workspace:*"` (and the other packages) to each app's `package.json`. Confirm `pnpm install` resolves cleanly at the repo root.
8. Create `infra/gcp/setup.sh` — a documented shell script that runs, in order: `gcloud services enable aiplatform.googleapis.com run.googleapis.com firestore.googleapis.com bigquery.googleapis.com pubsub.googleapis.com secretmanager.googleapis.com translate.googleapis.com speech.googleapis.com`.
9. Run `infra/gcp/setup.sh` against the team's GCP project. Confirm every API shows `ENABLED` via `gcloud services list --enabled`.
10. Create the Firestore database (Native mode, `asia-south1`): `gcloud firestore databases create --location=asia-south1`.
11. Create the Pub/Sub topic and a placeholder push subscription: `gcloud pubsub topics create raw-submissions`, then `gcloud pubsub subscriptions create raw-submissions-worker-sub --topic=raw-submissions --push-endpoint=<placeholder-url>` (updated to the real URL in Phase 9).
12. Add `.github/workflows/ci.yml`: on `pull_request`, run `pnpm install` then `pnpm turbo run lint test build`, using Turborepo's path filtering so unaffected apps are skipped.
13. Update the root `README.md` to link to `/docs` (the spec set) and describe the monorepo layout.
14. Unit test: `apps/api-gateway/src/index.test.ts` — `"GET /healthz returns 200 and {status: 'ok'}"` (Vitest + Fastify's `.inject()`).
15. Deploy the health-check-only `api-gateway` build once, manually: `gcloud run deploy api-gateway-staging --source apps/api-gateway`. Confirm the live URL responds — this proves the deploy path works before anything real depends on it.

## Real-world engineering concerns
- **Idempotent infra scripts:** `setup.sh` should be safe to re-run — enabling an already-enabled service is a no-op, and resource-creation steps should tolerate re-runs (`--quiet`, or an existence check where the CLI doesn't already no-op).
- **CI must fail loudly and fast:** a broken `lint`/`build` step here blocks every subsequent phase's PRs — get this right before moving on, don't defer it.

## Definition of done
- [ ] `pnpm turbo run build` succeeds at the repo root with zero errors.
- [ ] CI is green on a test PR that touches each app.
- [ ] `GET /healthz` on the deployed staging `api-gateway` URL returns `200 {"status":"ok"}`.
- [ ] All 7 required GCP APIs show `ENABLED`.
- [ ] The Firestore database and `raw-submissions` Pub/Sub topic exist and are visible in the GCP console.

## Risks & blockers
- GCP billing/quota approval can be slow on a project the team hasn't used before. **Mitigation:** assign one person to GCP account setup the moment the team starts, in parallel with repo scaffolding, so it isn't a day-3 surprise.

## Time budget
**1 day.** If it runs long, cut: the CI path-filtering optimization (just run everything on every PR for now) and the one-time staging deploy (do the first real deploy in Phase 9 instead). Do **not** cut: GCP API enablement and Firestore/Pub/Sub creation — every later phase needs these to exist.

## Handoff
A working, deployed skeleton exists on `main` with CI green; every app/package directory exists with a working local dev loop (`pnpm turbo run dev`). Tag this commit `phase-1-done`. Phase 2 can now write real Firestore/BigQuery schema code against a real project.
