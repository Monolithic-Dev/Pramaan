# Free Deployment Guide: no Google Cloud billing account needed

Use this if you do not want to (or cannot) add a Google Cloud billing account. Everything here is free and
needs **no card**. If you later get GCP credits, `docs/GCP_SETUP_GUIDE.md` is the Cloud Run alternative;
the code supports both.

## What runs where

| Piece | Runs on | Cost |
|---|---|---|
| Database (all app data, uploaded photos/audio, reference data) | **Firebase Firestore**, Spark plan | Free |
| Officer login (email/password) and citizen OTP | **Firebase Authentication**, Spark plan (test phone numbers) | Free |
| AI: categorization, embeddings, transcription, photo analysis, translation, agent | **Gemini API** (Google AI Studio key) | Free tier, rate-limited |
| API and AI worker | **Render** free web services | Free (sleeps when idle) |
| Web app | **Render** free static site | Free |
| Queue and scheduling | HTTP call + **GitHub Actions** cron (replaces Pub/Sub and Cloud Scheduler) | Free |
| Map | OpenStreetMap + Leaflet | Free |

Google AI in use: Gemini (generative + agent + function calling), Gemini multimodal (photo analysis and audio
transcription), Gemini embeddings, Firebase (Auth + Firestore). This satisfies the "Google AI" requirement.
Not used because they need GCP billing: Vertex AI, BigQuery, Cloud Run, Cloud Storage, Pub/Sub.

## Honest limits of the free setup
- **No data-residency guarantee.** `SECURITY_PRIVACY.md` §3 claims India-region (`asia-south1`) data residency, but that's true only on the Vertex-AI path. Here, `GEMINI_API_KEY` routes every Gemini call through the public Gemini API with no region pinning — Firestore's location picked in Step 1 is the *only* piece of this deployment with a residency guarantee. Don't represent this path as DPDP-compliant.
- **Cold starts:** Render free services sleep after ~15 minutes idle; the first request after that takes
  30-60 seconds. **Open the site and the `/healthz` URLs 2 minutes before any demo.**
- **Free instance hours** are shared across services (750/month). Two sleeping services are fine for a demo.
- **Uploads are small:** photos are compressed in the browser and voice notes are capped at 60 seconds, to fit
  Firestore's 1 MiB document limit. Fine for a prototype; move to Cloud Storage at scale.
- **Phone OTP** works with **test phone numbers** only (no SMS cost). Real SMS needs Firebase Blaze billing.
- **Gemini free tier** can return 429/503 under load. Google's newest Flash models were observed returning
  "high demand" errors that took 40-60 seconds to fail, so every Gemini call has a 25-second timeout and a
  fallback chain (`GEMINI_CATEGORIZATION_MODEL`, `GEMINI_AGENT_MODEL`, `GEMINI_TRANSLATION_MODEL`, comma-separated,
  fastest first). If a model is retired, change the list, not the code.
- **Processing speed:** one report takes roughly 5-15 seconds (categorize, embed, dedup, store) and reports are
  processed one at a time per worker instance (this is what prevents duplicate issues). A room of judges
  submitting simultaneously will see a short queue.
- **Rate limits:** anonymous reporters are limited to 3 submissions per hour per IP (signed-in: 10). On demo
  day set `RATE_LIMIT_ALLOWLIST_CIDRS=<venue-ip>/32` on the API service so a room sharing one IP is exempt.
  The API trusts one proxy hop (`TRUST_PROXY_HOPS`, default 1) to find the real client IP behind Render.
- Reference data is in Firestore instead of BigQuery (fine at this size; set `REFERENCE_BACKEND=bigquery` on
  GCP for national scale).

---

## Step 1: Firebase project (you already have one)

1. <https://console.firebase.google.com>, open your project. Stay on the **Spark (free)** plan.
2. **Firestore Database, Create database:** Production mode, any location (pick `asia-south1` / nearest).
3. **Authentication, Get started, Sign-in method:**
   - Enable **Email/Password** (for officers).
   - Enable **Phone**, then under **Phone numbers for testing** add e.g. `+91 98765 43210` = code `123456`
     (and a Brazilian one such as `+55 11 91234 5678` = `123456` for the pt-BR demo).
   - **Allow the SMS regions** (required even for test numbers): **Authentication, Settings tab, SMS region
     policy** (sometimes shown as "SMS regions"), choose **Allow**, add **India** and **Brazil**, save. Without
     this, requesting a code fails with `OPERATION_NOT_ALLOWED: SMS unable to be sent until this region
     enabled by the app developer`.
4. **Project settings (gear), General:** note the **Project ID** and the **Web API Key** (already in `.env`).
5. **Project settings, Service accounts, Generate new private key.** A JSON file downloads. **Treat it like a
   password; never commit it.** Convert it to one line for Render:

```bash
base64 -w0 path/to/downloaded-key.json      # Git Bash; copy the output
```

## Step 2: Load reference data into Firestore

From the repo root (Git Bash), using that key file:

```bash
export FIREBASE_SERVICE_ACCOUNT_JSON=$(base64 -w0 path/to/downloaded-key.json)
export FIREBASE_PROJECT_ID=<your-project-id>
pnpm --filter @jansetu/scripts seed-firestore-reference
```

It writes 13 regions (India + Brazil), infrastructure indexes and investment records. Check in Firestore:
collections `ref_admin_regions`, `ref_infra_index`, `ref_investment_record`.

## Step 3: Create an officer login

```bash
pnpm --filter @jansetu/scripts create-officer officer@example.com 'ChooseAStrongPassword1' state_admin IN-DL IN
```

Roles: `state_admin` (all screens), `district_collector`, `field_officer`. The `region_id` is the officer
jurisdiction, e.g. `IN-DL` (Delhi), `IN-MH`, `IN-KA`, `dl-central-delhi`, `BR-SP`. Create a second one with
`BR-SP` and `BR` for the Brazil demo.

## Step 4: Put the code on Render

1. Push this repo to GitHub (it already is) and sign up at <https://render.com> with GitHub (no card).
2. **New, Blueprint,** pick this repo. Render reads `render.yaml` and proposes three services:
   `jansetu-api`, `jansetu-worker`, `jansetu-web`. Click **Apply**.
3. Fill the environment variables it asks for (Dashboard, each service, **Environment**):

| Variable | jansetu-api | jansetu-worker | jansetu-web |
|---|---|---|---|
| `FIREBASE_PROJECT_ID` | yes | yes | |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | base64 from Step 1 | same | |
| `FIREBASE_WEB_API_KEY` | web API key | | |
| `GEMINI_API_KEY` | your key | your key | |
| `WORKER_SHARED_SECRET` | any long random string | **same string** | |
| `WORKER_URL` | `https://jansetu-worker.onrender.com` (worker's URL) | | |
| `VITE_API_BASE_URL` | | | `https://jansetu-api.onrender.com/v1` |
| `VITE_FIREBASE_API_KEY` | | | web API key |

   Generate the secret with: `openssl rand -hex 24`. The URLs are shown at the top of each Render service page;
   if Render adds a suffix, use the exact URL.
4. After the first deploy, redeploy `jansetu-web` once so it picks up the API URL.
5. In Firebase, **Authentication, Settings, Authorized domains:** add the `jansetu-web` domain
   (`something.onrender.com`).

Check: open `https://<api>/healthz` and `https://<worker>/healthz`. Both return `{"status":"ok"}`.

## Step 5: Scheduled jobs (replaces Pub/Sub + Cloud Scheduler)

Reports are handed to the worker immediately; this cron catches anything missed and runs scoring.

1. GitHub repo, **Settings, Secrets and variables, Actions:**
   - Secrets: `WORKER_URL` (worker URL) and `WORKER_SHARED_SECRET` (same string as above).
   - Variables: `SCHEDULED_JOBS_ENABLED` = `true`.
2. **Actions, scheduled-jobs, Run workflow** once to test. It should go green.

## Step 6: End-to-end test

1. Open the web URL. Pick a language, agree, file a report with text + a photo + a manual location.
2. Firestore: `submissions` gets a document that moves `queued` to `processed` (within a minute); `issues`
   gets an issue. File the same problem twice: `report_count` goes up, no duplicate issue.
3. Try a voice note (works in Chrome via browser speech, or as an uploaded recording elsewhere) and a photo-only report.
4. Open `/officer`, sign in with the officer email/password, look at the map, forecasts, equity tabs and ask the agent a question.
5. `/status`: enter a test phone number, code `123456`, and the tracking id.
6. `/transparency`: works in a private window with no login.

Scoring needs 3 distinct reporters on an issue (or emergency override). Use three test phones / different
browsers, or run more submissions, before expecting scores.

## Automated end-to-end checks (run against your real Firestore, Auth and Gemini)

With the API on :8080 and the worker on :8081 running locally (`pnpm --filter @jansetu/api-gateway dev` etc.,
with `WORKER_URL=http://localhost:8081` and `WORKER_SHARED_SECRET` set on both):

```bash
export GOOGLE_APPLICATION_CREDENTIALS=<path-to-service-account.json>
export E2E_OFFICER_PASSWORD=<password you gave create-officer>
pnpm --filter @jansetu/scripts exec tsx e2e-local.ts <folder-with-pothole.jpg-and-report-en.wav>
pnpm --filter @jansetu/scripts exec tsx e2e-agent.ts
```

`e2e-local.ts` runs about 75 checks (ingestion, idempotency, Hindi/English/Portuguese, dedup, burst detection,
photo and voice, scoring, forecasts, equity, transparency, states, agent scope guard, status translation, impact
loop, privacy erasure, sweep) and deletes the test data it created (reference data and officer logins stay). It
expects the officers `admin.in@pramaan.test` (state_admin, IN-DL), `collector.in@pramaan.test` (district_collector,
dl-central-delhi) and `admin.br@pramaan.test` (state_admin, BR-SP) from `create-officer`. Expect it to take
20-30 minutes because reports are processed one at a time against the real Gemini API.

## Troubleshooting
- **Site loads but calls fail:** `VITE_API_BASE_URL` wrong, or `jansetu-web` not redeployed after setting it.
- **CORS error in browser console:** the api service is asleep or crashed; open its `/healthz` and check Render logs.
- **Submission stays `queued`:** worker asleep or `WORKER_SHARED_SECRET` mismatch. The 15-minute cron will retry.
- **"The query requires an index":** open the link in the error; it creates the Firestore index in one click.
- **Officer login fails:** wrong email/password, or `VITE_FIREBASE_API_KEY` missing on the web service.
- **403 on officer screens:** the officer claims do not cover that region; re-run `create-officer` with the right `region_id`.

## What you still need to provide
1. The Firebase service-account key (Step 1) and Firestore + Auth enabled.
2. A Render account (GitHub sign-in) and a GitHub repo you control for the cron secrets.
3. Test phone numbers configured in Firebase (Step 1).
4. Optional: a `data.gov.in` API key if you want real government datasets loaded (tell me and I will build the loader).
