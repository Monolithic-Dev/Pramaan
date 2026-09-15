import type { Firestore } from "firebase-admin/firestore";
import type { Issue, PriorityScore, Submission } from "@jansetu/shared-types";
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
    async getEligibleIssuesForScoring(countryCode) {
      // Two separate queries (Firestore can't OR across fields) merged and deduped.
      const [byReporters, byOverride] = await Promise.all([
        db
          .collection("issues")
          .where("country_code", "==", countryCode)
          .where("distinct_reporter_count", ">=", 3)
          .get(),
        db
          .collection("issues")
          .where("country_code", "==", countryCode)
          .where("emergency_override", "==", true)
          .get(),
      ]);
      const byId = new Map<string, Issue>();
      for (const doc of [...byReporters.docs, ...byOverride.docs]) {
        const issue = doc.data() as Issue;
        if (!["resolved", "tombstoned"].includes(issue.status)) byId.set(issue.issue_id, issue);
      }
      return [...byId.values()];
    },
    async getAllDistinctReporterCounts(countryCode) {
      const snapshot = await db
        .collection("issues")
        .where("country_code", "==", countryCode)
        .where("status", "!=", "tombstoned")
        .get();
      return snapshot.docs.map((doc) => (doc.data() as Issue).distinct_reporter_count);
    },
    async putPriorityScore(score) {
      await db.collection("priorityScores").doc(score.score_id).set(score);
    },
    async updateIssueScore(issueId, score) {
      await db.collection("issues").doc(issueId).update({
        composite_score: score.composite_score,
        latest_score_id: score.latest_score_id,
      });
    },
    async getImpactEfficacy(category, regionAncestry) {
      if (regionAncestry.length === 0) return null;
      // Firestore 'in' caps at 30 — the ancestry chain is at most ~6 hops.
      const snapshot = await db
        .collection("impactRecords")
        .where("category", "==", category)
        .where("region_id", "in", regionAncestry)
        .get();
      if (snapshot.empty) return null;
      const values = snapshot.docs.map((doc) => (doc.data() as { efficacy: number }).efficacy);
      return values.reduce((sum, v) => sum + v, 0) / values.length;
    },
    async getCanonicalScore(issueId) {
      const snapshot = await db
        .collection("priorityScores")
        .where("issue_id", "==", issueId)
        .where("is_canonical", "==", true)
        .orderBy("computed_at", "desc")
        .limit(1)
        .get();
      return snapshot.empty ? null : (snapshot.docs[0].data() as PriorityScore);
    },
  };
}
