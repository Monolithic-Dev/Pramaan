import type { Firestore } from "firebase-admin/firestore";
import type { Issue, Submission } from "@jansetu/shared-types";
import type { CandidateQuery, Store } from "./types.js";

export function createFirestoreStore(db: Firestore): Store {
  return {
    async getSubmission(submissionId) {
      const doc = await db.collection("submissions").doc(submissionId).get();
      return doc.exists ? (doc.data() as Submission) : null;
    },
    async putSubmission(submission) {
      await db.collection("submissions").doc(submission.submission_id).set(submission);
    },
    async findOwnRecentIssue(citizenId, category, sinceIso) {
      // Firestore has no "array element belongs to citizen X" query — fetch the
      // small recent-by-category set and filter in memory. Fine at hackathon
      // scale (docs/EDGE_CASES.md #4 is a same-reporter check, not a broad scan).
      const snapshot = await db
        .collection("issues")
        .where("category", "==", category)
        .where("last_reported_at", ">=", sinceIso)
        .limit(200)
        .get();

      for (const doc of snapshot.docs) {
        const issue = doc.data() as Issue;
        const ownSubmissions = await db
          .collection("submissions")
          .where("issue_id", "==", issue.issue_id)
          .where("citizen_id", "==", citizenId)
          .limit(1)
          .get();
        if (!ownSubmissions.empty) return issue;
      }
      return null;
    },
    async queryCandidateIssues({ stateId, category, geohashCells }: CandidateQuery) {
      // Firestore 'in' caps at 30 values — 9 geohash neighbours is fine
      // (docs/phases/phase-4-extraction-dedup.md "Traps").
      const snapshot = await db
        .collection("issues")
        .where("state_id", "==", stateId)
        .where("category", "==", category)
        .where("geohash", "in", geohashCells)
        .where("status", "not-in", ["resolved", "tombstoned"])
        .limit(200)
        .get();
      return snapshot.docs.map((doc) => doc.data() as Issue);
    },
    async createIssue(issue) {
      await db.collection("issues").doc(issue.issue_id).set(issue);
    },
    async getIssue(issueId) {
      const doc = await db.collection("issues").doc(issueId).get();
      return doc.exists ? (doc.data() as Issue) : null;
    },
    async hasCitizenReportedIssue(issueId, citizenId) {
      const snapshot = await db
        .collection("submissions")
        .where("issue_id", "==", issueId)
        .where("citizen_id", "==", citizenId)
        .limit(1)
        .get();
      return !snapshot.empty;
    },
    async mergeIssue(issueId, merge) {
      const ref = db.collection("issues").doc(issueId);
      return db.runTransaction(async (tx) => {
        const doc = await tx.get(ref);
        if (!doc.exists) throw new Error(`mergeIssue: issue ${issueId} not found`);
        const updated = merge(doc.data() as Issue);
        tx.set(ref, updated);
        return updated;
      });
    },
  };
}
