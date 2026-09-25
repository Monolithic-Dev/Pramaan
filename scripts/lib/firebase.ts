import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";

export function usingEmulators(): boolean {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST);
}

/** One place scripts get a Firebase app: service-account JSON, else Application Default Credentials. */
export function initFirebase() {
  if (getApps().length > 0) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  // With the emulators running there is nothing to authenticate against; a stale credentials path
  // would make applicationDefault() throw, so clear it (ADC itself resolves lazily and is never used).
  if (usingEmulators()) delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const credential = raw && !usingEmulators()
    ? cert(JSON.parse(raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8")))
    : applicationDefault();
  initializeApp({ credential, projectId: process.env.GCP_PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID });
}
