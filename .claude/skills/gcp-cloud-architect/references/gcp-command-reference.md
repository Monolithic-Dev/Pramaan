# GCP Command Reference — Pramaan

Condensed from `docs/DEPLOYMENT.md` and the phase runbooks. One place to look these up instead
of re-deriving them.

## APIs
```bash
gcloud services enable aiplatform.googleapis.com run.googleapis.com firestore.googleapis.com \
  bigquery.googleapis.com pubsub.googleapis.com secretmanager.googleapis.com \
  translate.googleapis.com speech.googleapis.com
gcloud services list --enabled
```

## Firestore
```bash
gcloud firestore databases create --location=asia-south1
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

## Pub/Sub
```bash
gcloud pubsub topics create raw-submissions
gcloud pubsub subscriptions create raw-submissions-worker-sub \
  --topic=raw-submissions --push-endpoint=<worker-ai-pipeline-url>/pubsub-push
# Update the push endpoint after a real deploy:
gcloud pubsub subscriptions update raw-submissions-worker-sub --push-endpoint=<new-url>
```

## BigQuery
```bash
bq mk --dataset --location=asia-south1 pramaan_analytics
bq mk --table pramaan_analytics.infra_index infra/gcp/bigquery-schemas/infra_index.json
bq load --source_format=CSV pramaan_analytics.infra_index path/to/data.csv
```

## Cloud Run
```bash
gcloud run deploy api-gateway --source apps/api-gateway \
  --min-instances=1 --region=asia-south1 --service-account=api-gateway-sa@PROJECT.iam.gserviceaccount.com
gcloud run deploy worker-ai-pipeline --source apps/worker-ai-pipeline \
  --min-instances=0 --region=asia-south1 --service-account=worker-ai-pipeline-sa@PROJECT.iam.gserviceaccount.com
```

## Service accounts / IAM
```bash
gcloud iam service-accounts create worker-ai-pipeline-sa
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:worker-ai-pipeline-sa@PROJECT.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
# Repeat per-role: datastore.user, bigquery.dataViewer, pubsub.subscriber
```

## Cloud Scheduler (rescore job)
```bash
gcloud scheduler jobs create http rescore-job --schedule="*/15 * * * *" \
  --uri="<worker-ai-pipeline-url>/jobs/rescore" --http-method=POST
```
