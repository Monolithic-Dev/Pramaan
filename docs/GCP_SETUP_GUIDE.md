# GCP Setup Guide: from zero to a live JanSetu

For someone with **no Google Cloud account yet**. Follow the parts in order. Every command is
copy-paste; replace anything in `<angle brackets>`. Budget about 2-3 hours the first time.

**What you end up with:** Firestore (data), BigQuery (reference data), Pub/Sub (queue), two Cloud Run
services (`api-gateway`, `worker-ai-pipeline`), a Cloud Storage bucket (photos/audio), Cloud Scheduler
(scoring job), Firebase Hosting (the web app), and Firebase Phone sign-in.

**Cost: this guide is written to stay inside Google's free offers.** New accounts get a 90-day free trial
with about $300 credit, and many products also have "Always Free" monthly quotas that continue afterwards.
A card is required to sign up, but it is not charged during the trial, and Google does **not** auto-charge
when the trial ends: you must click "Activate full account" to keep paying resources running. Read
**"Staying inside the free tier"** below before Part 1.

## Staying inside the free tier

| Product | Free allowance | How JanSetu stays under it |
|---|---|---|
| Cloud Run | 2M requests, 180k vCPU-seconds, 360k GiB-seconds / month | Scale to zero (default); never set min instances |
| Firestore | 1 GiB storage, 50k reads / 20k writes per day (1 database per project) | Demo data is tiny; use one database |
| BigQuery | 10 GB storage, 1 TB queries / month | Reference tables are a few KB |
| Pub/Sub | 10 GB / month | Messages are tiny |
| Cloud Build | 120 build-minutes / day | Build only when needed |
| Cloud Scheduler | 3 jobs | We use 1 |
| Secret Manager | 6 secret versions | We use 2 |
| Artifact Registry | 0.5 GB | Two images can exceed this; delete old image versions (Part 8) |
| Cloud Storage | 5 GB, **only in us-central1, us-east1 or us-west1** | Bucket is created in `us-central1`, not Mumbai |
| Firebase Hosting | 10 GB storage, 360 MB/day transfer (Spark plan) | Static site is a few MB |
| Gemini API (your AI Studio key) | Free tier with rate limits | No cloud billing needed; 429/503 errors under load are the limit |

**Not free, so avoided:** Vertex AI (use your Gemini API key instead), Cloud Speech-to-Text and Translation
(the app uses Gemini for both), a Cloud Run minimum-instance setting, and buckets outside the three US regions.

**Phone OTP is the one exception to worry about.** Firebase phone sign-in sends real SMS, which needs the
Blaze pay-as-you-go plan (with free monthly verifications, then a per-SMS charge). To stay at zero cost,
use **Firebase test phone numbers** (Part 10). They work with no SMS and no Blaze upgrade. Only enable Blaze
if you need real SMS, and then set a budget cap (Part 14).

**Three safety rails:**
1. Create a budget alert at $1-5 before anything else (Part 14, do it right after Part 2).
2. Keep an eye on **Billing, Reports** for the first days.
3. Free-trial accounts cannot be silently overcharged: when credit runs out, services stop. That is the
   safe failure mode for a hackathon.

Notation: `PROJECT_ID` is your project id, `REGION` is `asia-south1` (Mumbai).

---

## Part 1: Create the Google Cloud account

1. Go to <https://console.cloud.google.com> and sign in with your Google account.
2. Accept the terms. When offered **"Activate free trial"** (top banner), click it, choose your country,
   select "Individual", and add a card. Verification can take a few minutes.
3. Check: the console shows a billing account under **Billing**.

## Part 2: Use your existing Firebase project (do not create a new one)

You already created a Firebase project (its id is `FIREBASE_PROJECT_ID` in your `.env`). Every Firebase
project **is** a Google Cloud project, so reuse it. One project keeps Firebase Auth and GCP together.

1. Open <https://console.cloud.google.com>, click the project picker (top bar), and select that project.
2. **Link billing:** menu, **Billing**, **Link a billing account**, choose the trial account. Cloud Run,
   Cloud Build and Pub/Sub cannot be used without a billing account attached, even for free usage. (Firebase
   may ask you to move from the "Spark" to the "Blaze" plan; Blaze is also free up to the same quotas, and
   your credit covers anything beyond. Only accept it after creating the budget alert below.)
3. **Create a budget alert now:** **Billing, Budgets & alerts, Create budget**, amount **$5**, alerts at
   50%, 90%, 100%.
4. Write down the **project id** (not the display name). Export it in your terminal for the rest of this guide:

```bash
export PROJECT_ID=<your-project-id>
export REGION=asia-south1
```

## Part 3: Install tools on your computer

1. **Google Cloud CLI:** <https://cloud.google.com/sdk/docs/install> (Windows installer). Tick the option to
   run `gcloud init` at the end, or run it yourself later.
2. **Node 20 + pnpm** (you already have these for the repo).
3. **Firebase CLI** (for the web app): `npm install -g firebase-tools`.
4. Docker is **not** needed: Cloud Build builds the images for you.

Open a new terminal (Git Bash) and verify: `gcloud --version`.

## Part 4: Log in and point gcloud at your project

```bash
gcloud auth login                        # opens a browser
gcloud config set project $PROJECT_ID
gcloud auth application-default login    # lets local scripts/apps use your credentials
```

`application-default login` is what makes the seed script and local runs work without a key file.

## Part 5: Enable APIs and create the data stores

The repo already has a script for most of this. From the repo root, in Git Bash:

```bash
gcloud services enable cloudbuild.googleapis.com artifactregistry.googleapis.com \
  cloudscheduler.googleapis.com iam.googleapis.com identitytoolkit.googleapis.com
bash infra/gcp/setup.sh $PROJECT_ID
```

`setup.sh` enables the APIs (enabling one costs nothing; only usage does), creates the two BigQuery datasets
and tables, and tries to create two buckets in Mumbai. **Ignore those two buckets** (Mumbai storage is not in
the free tier, and `jansetu-media` is a global name someone else likely owns). Create your own free-tier bucket
in a US region instead and remember it:

```bash
export MEDIA_BUCKET=jansetu-media-$PROJECT_ID
gcloud storage buckets create gs://$MEDIA_BUCKET --location=us-central1 --uniform-bucket-level-access
```

If `setup.sh` created `jansetu-audio`/`jansetu-media` in Mumbai, delete any you don't use:
`gcloud storage buckets delete gs://jansetu-audio`.

The app writes **both photos and audio** to the single bucket named in `MEDIA_BUCKET`. Cloud Storage is
free only up to 5 GB, so for a demo keep uploads small (the app already caps photos at 8 MB, audio at 10 MB).

### Firestore

1. Console, **Firestore Database**, **Create database**.
2. Choose **Native mode** (not Datastore), location `asia-south1`, start in **production mode**.
   (Only the backend touches it, using service credentials, so client rules stay locked.)
3. **Indexes:** some queries combine filters. The first time one fails, the error message contains a
   link that creates the missing index in one click. Open the link, click Create, wait a minute, retry.

### Pub/Sub topic

```bash
gcloud pubsub topics create raw-submissions
```

(The push subscription comes in Part 8, after the worker is deployed.)

## Part 6: Service accounts and permissions

Two identities, one per service, each with only what it needs.

```bash
gcloud iam service-accounts create api-gateway-sa --display-name="JanSetu api-gateway"
gcloud iam service-accounts create worker-sa --display-name="JanSetu worker"

for SA in api-gateway-sa worker-sa; do
  for ROLE in roles/datastore.user roles/bigquery.dataViewer roles/bigquery.jobUser \
              roles/aiplatform.user roles/secretmanager.secretAccessor; do
    gcloud projects add-iam-policy-binding $PROJECT_ID \
      --member="serviceAccount:$SA@$PROJECT_ID.iam.gserviceaccount.com" --role=$ROLE
  done
done

# api-gateway publishes to Pub/Sub and creates Firebase users' custom claims lookups
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:api-gateway-sa@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/pubsub.publisher
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:api-gateway-sa@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/firebaseauth.viewer

# both services read/write the media bucket
for SA in api-gateway-sa worker-sa; do
  gcloud storage buckets add-iam-policy-binding gs://$MEDIA_BUCKET \
    --member="serviceAccount:$SA@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/storage.objectAdmin
done

# worker writes scoring history to BigQuery
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:worker-sa@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/bigquery.dataEditor
```

## Part 7: Secrets and the Gemini key

The simplest, known-working AI setup is your **Gemini API key** (already verified with `gemini-3.6-flash`).
Store it in Secret Manager instead of pasting it into deploy commands:

```bash
printf '%s' '<your-gemini-api-key>' | gcloud secrets create gemini-api-key --data-file=-
printf '%s' '<your-firebase-web-api-key>' | gcloud secrets create firebase-web-api-key --data-file=-
```

(Your keys are in the repo's `.env`. Never commit that file.) Vertex AI is the alternative that needs no key,
but it is **paid** (not in the free tier) and model availability in `asia-south1` varies, so the key path is
both cheaper and safer. Leave `GEMINI_API_KEY` set on both services so they never fall back to Vertex.

## Part 8: Build and deploy the two services

Artifact Registry's free allowance is only 0.5 GB, so after each successful deploy delete old image versions
(console: **Artifact Registry, jansetu, select images, Delete**) or the small monthly charge starts.

Create an image repository once:

```bash
gcloud artifacts repositories create jansetu --repository-format=docker --location=$REGION
```

Build (from the repo root; each takes a few minutes):

```bash
for SVC in api-gateway worker-ai-pipeline; do
  gcloud builds submit --config infra/gcp/cloudbuild.yaml \
    --substitutions=_SERVICE=$SVC,_IMAGE=$REGION-docker.pkg.dev/$PROJECT_ID/jansetu/$SVC .
done
```

Deploy the **worker** first (it is private; only Pub/Sub and Scheduler call it):

```bash
gcloud run deploy worker-ai-pipeline \
  --image=$REGION-docker.pkg.dev/$PROJECT_ID/jansetu/worker-ai-pipeline \
  --region=$REGION --service-account=worker-sa@$PROJECT_ID.iam.gserviceaccount.com \
  --no-allow-unauthenticated \
  --set-env-vars=GCP_PROJECT_ID=$PROJECT_ID,MEDIA_BUCKET=$MEDIA_BUCKET \
  --set-secrets=GEMINI_API_KEY=gemini-api-key:latest
```

Then the **api-gateway** (public: citizens and the web app call it):

```bash
gcloud run deploy api-gateway \
  --image=$REGION-docker.pkg.dev/$PROJECT_ID/jansetu/api-gateway \
  --region=$REGION --service-account=api-gateway-sa@$PROJECT_ID.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --set-env-vars=GCP_PROJECT_ID=$PROJECT_ID,FIREBASE_PROJECT_ID=$PROJECT_ID,MEDIA_BUCKET=$MEDIA_BUCKET,PUBSUB_RAW_SUBMISSIONS_TOPIC=raw-submissions \
  --set-secrets=GEMINI_API_KEY=gemini-api-key:latest,FIREBASE_WEB_API_KEY=firebase-web-api-key:latest
```

Each command prints a **Service URL**. Save them:

```bash
export API_URL=$(gcloud run services describe api-gateway --region=$REGION --format='value(status.url)')
export WORKER_URL=$(gcloud run services describe worker-ai-pipeline --region=$REGION --format='value(status.url)')
curl $API_URL/healthz     # expect {"status":"ok"}
```

### Connect Pub/Sub to the worker

```bash
gcloud run services add-iam-policy-binding worker-ai-pipeline --region=$REGION \
  --member="serviceAccount:worker-sa@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/run.invoker

gcloud pubsub subscriptions create raw-submissions-push --topic=raw-submissions \
  --push-endpoint=$WORKER_URL/pubsub-push \
  --push-auth-service-account=worker-sa@$PROJECT_ID.iam.gserviceaccount.com \
  --ack-deadline=120
```

### Scheduled scoring (every 15 minutes)

```bash
gcloud scheduler jobs create http score-batch --location=$REGION --schedule="*/15 * * * *" \
  --uri=$WORKER_URL/jobs/score --http-method=POST \
  --oidc-service-account-email=worker-sa@$PROJECT_ID.iam.gserviceaccount.com
```

## Part 9: Load the reference data (regions, infrastructure, investments)

From the repo root, with `gcloud auth application-default login` done (Part 4):

```bash
GOOGLE_CLOUD_PROJECT=$PROJECT_ID pnpm --filter @jansetu/scripts generate-reference-data
```

This loads the India and Brazil sample regions into BigQuery. Check in the console: **BigQuery**,
`jansetu_reference.admin_regions` should have 13 rows.

## Part 10: Firebase console steps

1. <https://console.firebase.google.com>, your project, **Authentication**, **Get started**.
2. **Sign-in method**, enable **Phone**. **On a free-only setup, use test numbers:** under Phone, add
   **Phone numbers for testing** (for example `+91 98765 43210` with code `123456`). They sign in with no SMS
   and no cost, which is enough for a demo. Sending real SMS to real phones requires upgrading to Blaze.
3. **Authentication, Settings, Authorized domains:** add your web domain (Part 12) once you have it.

### Create an officer login (needed to use the dashboard)

Officers are Firebase users with custom claims. In the console create a user (**Authentication, Users, Add
user**, email + password), copy their **User UID**, then set claims. From the repo root:

```bash
node -e '
const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
initializeApp({ credential: applicationDefault(), projectId: process.env.PROJECT_ID });
getAuth().setCustomUserClaims(process.argv[1], {
  role: "state_admin", region_id: "IN-DL", country_code: "IN"
}).then(() => console.log("claims set"));
' <USER_UID>
```

`role` values: `state_admin` (all features), `district_collector`, `field_officer`. `region_id` is the
jurisdiction, such as `IN-DL` or `dl-central-delhi`. The user must sign out/in to get a fresh token.
(The officer login screen currently takes a pasted ID token; ask me to add email/password login if you want
it polished.)

## Part 11: Configure and deploy the web app

1. Create `apps/web/.env.production`:

```
VITE_API_BASE_URL=<API_URL>/v1
```

2. Build and host on Firebase Hosting:

```bash
pnpm --filter @jansetu/web build
firebase login
firebase init hosting     # choose your project; public directory: apps/web/dist; single-page app: Yes
firebase deploy --only hosting
```

3. The command prints your site URL (`https://<project>.web.app`). Add that domain to the Firebase
   Authorized domains (Part 10, step 3).

## Part 12: Smoke test end to end

1. Open the site, choose a language, agree to the notice, submit a text report with a manual location.
2. In Firestore, `submissions` should get a document with status `queued`, then `processed` within ~30 seconds.
3. `issues` should contain the new issue. Submit the same problem from another browser: `report_count` rises
   and no second issue is created (deduplication working).
4. Trigger scoring now: `curl -X POST $WORKER_URL/jobs/score -H "Authorization: Bearer $(gcloud auth print-identity-token)"`.
   An issue needs 3 distinct reporters (or emergency override) before it is scored.
5. Sign in as the officer at `/login` (you land in `/console`): ask the co-pilot a question, check the map, forecasts and equity tabs.
6. Open `/transparency?` in a private window: it works without login (shows "insufficient data" until 5 issues exist).

**If something fails:** Cloud Run, select the service, **Logs**. Common causes: a missing IAM role (Part 6),
a missing Firestore index (click the link in the log), or a wrong env var.

## Part 13: Before the demo

- Get the venue Wi-Fi's public IP and set `RATE_LIMIT_ALLOWLIST_CIDRS=<ip>/32` on api-gateway
  (`gcloud run services update api-gateway --region=$REGION --update-env-vars=RATE_LIMIT_ALLOWLIST_CIDRS=<ip>/32`)
  so a room of judges doesn't rate-limit each other.
- Seed enough varied reports (10+ across several districts and a few categories) so scoring, the map and the
  transparency page show real numbers. Forecasts need issue history spanning two or more years, which a fresh
  deployment won't have; say so honestly in the demo.
- Rehearse `docs/DEMO_SCRIPT.md` against the deployed URL.

## Part 14: Control costs and clean up

- Set a budget alert: **Billing, Budgets & alerts, Create budget** (e.g. $20, alerts at 50/90%).
- Cloud Run scales to zero when idle, so the services cost almost nothing unused. Cloud Scheduler's first 3
  jobs are free.
- To stop everything after the hackathon: `gcloud projects delete $PROJECT_ID` (permanent; it also removes
  the Firebase project), or pause by deleting the Scheduler job and Cloud Run services.

## Known risks (please read)

- **The Dockerfiles have not been run.** They copy the workspace packages but the shared packages'
  `package.json` points at TypeScript source (`src/index.ts`), which plain `node` cannot run in the final
  image. If the deployed service crashes on start with an "unknown file extension .ts" or "cannot find module
  @jansetu/..." error, that is this issue. The fix is to bundle each service with a bundler (esbuild) or build
  the shared packages to `dist`. Tell me and I will fix it and re-verify locally; do not spend time debugging it
  yourself.
- Firestore composite indexes are created on demand (Part 5), not from a checked-in file.
- Media upload/transcription and BigQuery/Firestore code paths are unit-tested with fakes, and have not run
  against real GCP yet. Expect a round of small fixes during your first real smoke test.
