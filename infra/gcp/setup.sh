#!/usr/bin/env bash
# Enables the GCP APIs Pramaan needs. Safe to re-run (enabling an already-enabled
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

# --- Phase 2: BigQuery dataset/tables + Cloud Storage buckets ---
# All idempotent: bq/gsutil no-op (with a warning) when the resource already exists.

bq mk --dataset --location=asia-south1 "${PROJECT_ID}:pramaan_analytics" || true
bq mk --dataset --location=asia-south1 "${PROJECT_ID}:pramaan_reference" || true

SCHEMA_DIR="$(dirname "$0")/bigquery-schemas"
for table in infra_index investment_record priority_score_history; do
  bq mk --table \
    "${PROJECT_ID}:pramaan_analytics.${table}" \
    "${SCHEMA_DIR}/${table}.json" || true
done

# admin_regions is the fix for the GeoCluster-keyed reference-data bug (see
# docs/phases/phase-2-data-layer.md's migration note) — InfraIndex/InvestmentRecord
# join here, never to a dynamically-created GeoCluster.
bq mk --table \
  "${PROJECT_ID}:pramaan_reference.admin_regions" \
  "${SCHEMA_DIR}/admin_regions.json" || true

gcloud storage buckets create "gs://pramaan-media" --location=asia-south1 || true
gcloud storage buckets create "gs://pramaan-audio" --location=asia-south1 || true

# Voice recordings may contain sensitive citizen speech — auto-delete after 90 days
# per docs/SECURITY_PRIVACY.md's retention policy.
cat > /tmp/pramaan-audio-lifecycle.json <<'EOF'
{
  "rule": [
    { "action": { "type": "Delete" }, "condition": { "age": 90 } }
  ]
}
EOF
gcloud storage buckets update "gs://pramaan-audio" \
  --lifecycle-file=/tmp/pramaan-audio-lifecycle.json
