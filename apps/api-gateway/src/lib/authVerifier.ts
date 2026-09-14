import { getAuth } from "firebase-admin/auth";
import { ensureFirebaseApp } from "./firebaseAdmin.js";

export interface DecodedAuth {
  uid: string;
  claims: Record<string, unknown>;
}

export interface AuthVerifier {
  verifyIdToken(token: string): Promise<DecodedAuth>;
}

export function createFirebaseAuthVerifier(): AuthVerifier {
  ensureFirebaseApp();
  return {
    async verifyIdToken(token) {
      const decoded = await getAuth().verifyIdToken(token);
      return { uid: decoded.uid, claims: decoded };
    },
  };
}
