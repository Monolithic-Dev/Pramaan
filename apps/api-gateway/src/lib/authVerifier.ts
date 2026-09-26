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
      // Officer tokens carry jurisdiction-wide powers, so a disabled or revoked officer must lose
      // access immediately rather than when the ID token expires (up to an hour). This costs one
      // extra Auth lookup per officer request; citizen requests skip it.
      if (typeof decoded.role === "string") await getAuth().verifyIdToken(token, true);
      return { uid: decoded.uid, claims: decoded };
    },
  };
}
