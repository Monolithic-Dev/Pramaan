import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Credentials, in order: FIREBASE_SERVICE_ACCOUNT_JSON (raw or base64 JSON, works on
// any host with no GCP billing), then Application Default Credentials (Cloud Run / gcloud login).
function loadCredential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return applicationDefault();
  const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  return cert(JSON.parse(json));
}

export function ensureFirebaseApp() {
  if (getApps().length === 0) {
    initializeApp({
      credential: loadCredential(),
      projectId: process.env.GCP_PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID,
    });
  }
}

let configured = false;

export function getDb() {
  ensureFirebaseApp();
  const db = getFirestore();
  if (!configured) {
    // Optional fields that are absent (e.g. row_count on a non-list tool result) are undefined
    // in JS; Firestore would otherwise reject the entire write.
    db.settings({ ignoreUndefinedProperties: true });
    configured = true;
  }
  return db;
}
