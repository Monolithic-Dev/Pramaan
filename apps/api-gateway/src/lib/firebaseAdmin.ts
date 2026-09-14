import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export function ensureFirebaseApp() {
  if (getApps().length === 0) {
    initializeApp();
  }
}

export function getDb() {
  ensureFirebaseApp();
  return getFirestore();
}
