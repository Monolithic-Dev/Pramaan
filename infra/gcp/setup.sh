#!/usr/bin/env bash
# Enables the GCP APIs JanSetu needs. Safe to re-run (enabling an already-enabled
# service is a no-op). Requires: gcloud CLI authenticated, GOOGLE_CLOUD_PROJECT set
# or passed as $1.
set -euo pipefail

PROJECT_ID="${1:-${GOOGLE_CLOUD_PROJECT:-}}"
if [[ -z "$PROJECT_ID" ]]; then
  echo "Usage: $0 <gcp-project-id>  (or set GOOGLE_CLOUD_PROJECT)" >&2
  exit 1
fi

gcloud config set project "$PROJECT_ID"

gcloud services enable \
  aiplatform.googleapis.com \
  run.googleapis.com \
  firestore.googleapis.com \
  bigquery.googleapis.com \
  pubsub.googleapis.com \
  secretmanager.googleapis.com \
  translate.googleapis.com \
  speech.googleapis.com

echo "Enabled APIs:"
gcloud services list --enabled --format="value(config.name)"
