# Phase 1 — manual steps (run these yourself)

Everything scaffoldable from the repo is done (monorepo, apps, CI config, Dockerfiles, `infra/gcp/setup.sh`). These steps need your GitHub/GCP credentials and can't be run from here:

1. **GitHub branch protection** — on `main`, require the `CI / build` check to pass before merge, disallow force-push.
2. **GCP project** — create/select a project with billing enabled, then:
   ```bash
   gcloud auth login
   infra/gcp/setup.sh <your-project-id>
   ```
3. **Firestore** (Native mode, `asia-south1`):
   ```bash
   gcloud firestore databases create --location=asia-south1
   ```
4. **Pub/Sub topic + placeholder push subscription**:
   ```bash
   gcloud pubsub topics create raw-submissions
   gcloud pubsub subscriptions create raw-submissions-worker-sub \
     --topic=raw-submissions --push-endpoint=<placeholder-url>
   ```
   Update `--push-endpoint` to the real `worker-ai-pipeline` Cloud Run URL once deployed (Phase 9).
5. **First staging deploy** (build context must be the repo root, since `api-gateway` depends on the `shared-types` workspace package):
   ```bash
   gcloud run deploy api-gateway-staging \
     --source . \
     --dockerfile apps/api-gateway/Dockerfile \
     --region asia-south1 \
     --allow-unauthenticated
   ```
   Confirm the deployed URL's `/healthz` returns `200 {"status":"ok"}`.

## Definition of done (from `phase-1-environment-scaffolding.md`)
- [x] `pnpm turbo run build` succeeds at the repo root with zero errors.
- [ ] CI green on a test PR (verify once pushed to GitHub).
- [ ] `GET /healthz` on deployed staging `api-gateway` returns `200 {"status":"ok"}` (step 5 above).
- [ ] All 7 GCP APIs `ENABLED` (step 2 above).
- [ ] Firestore database + `raw-submissions` topic exist (steps 3-4 above).
