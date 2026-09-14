import type { Firestore } from "firebase-admin/firestore";
import type { Citizen, Submission } from "@jansetu/shared-types";
import type { Store } from "./types.js";

export function createFirestoreStore(db: Firestore): Store {
  return {
    async getCitizen(citizenId) {
      const doc = await db.collection("citizens").doc(citizenId).get();
      return doc.exists ? (doc.data() as Citizen) : null;
    },
    async putCitizen(citizen) {
      await db.collection("citizens").doc(citizen.citizen_id).set(citizen);
    },
    async putSubmission(submission) {
      await db.collection("submissions").doc(submission.submission_id).set(submission);
    },
    async getSubmission(submissionId) {
      const doc = await db.collection("submissions").doc(submissionId).get();
      return doc.exists ? (doc.data() as Submission) : null;
    },
    async incrementRateLimit(key, windowMs) {
      const ref = db.collection("rateLimits").doc(key);
      return db.runTransaction(async (tx) => {
        const doc = await tx.get(ref);
        const now = Date.now();
        const data = doc.data() as { count: number; windowStart: number } | undefined;
        if (!data || now - data.windowStart >= windowMs) {
          tx.set(ref, { count: 1, windowStart: now });
          return 1;
        }
        const count = data.count + 1;
        tx.update(ref, { count });
        return count;
      });
    },
  };
}
