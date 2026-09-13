#!/usr/bin/env bash
# Verifies required GCP resources for JanSetu exist. Safe to re-run.
set -euo pipefail

echo "== Checking required APIs =="
REQUIRED_APIS=(aiplatform.googleapis.com run.googleapis.com firestore.googleapis.com \
  bigquery.googleapis.com pubsub.googleapis.com secretmanager.googleapis.com \
  translate.googleapis.com speech.googleapis.com)
ENABLED=$(gcloud services list --enabled --format="value(config.name)")
for api in "${REQUIRED_APIS[@]}"; do
  if echo "$ENABLED" | grep -q "$api"; then
    echo "  [ok] $api"
  else
    echo "  [MISSING] $api  -> run: gcloud services enable $api"
  fi
done

echo "== Checking Firestore database =="
gcloud firestore databases describe --database='(default)' >/dev/null 2>&1 \
  && echo "  [ok] Firestore database exists" \
  || echo "  [MISSING] Firestore database -> gcloud firestore databases create --location=asia-south1"

echo "== Checking Pub/Sub topic/subscription =="
gcloud pubsub topics describe raw-submissions >/dev/null 2>&1 \
  && echo "  [ok] topic raw-submissions exists" \
  || echo "  [MISSING] topic raw-submissions"
gcloud pubsub subscriptions describe raw-submissions-worker-sub >/dev/null 2>&1 \
  && echo "  [ok] subscription raw-submissions-worker-sub exists" \
  || echo "  [MISSING] subscription raw-submissions-worker-sub"

echo "== Checking BigQuery dataset =="
bq show jansetu_analytics >/dev/null 2>&1 \
  && echo "  [ok] dataset jansetu_analytics exists" \
  || echo "  [MISSING] dataset jansetu_analytics -> bq mk --dataset --location=asia-south1 jansetu_analytics"

echo "Done. Re-run any time — this script only reports, never mutates."
