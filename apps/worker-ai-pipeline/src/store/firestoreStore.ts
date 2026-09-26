import type { Firestore } from "firebase-admin/firestore";
import type { Issue, PriorityScore, Submission } from "@pramaan/shared-types";
import type { CandidateQuery, Store } from "./types.js";

export function createFirestoreStore(db: Firestore): Store {
  return {
    async listStaleProcessingSubmissions(cutoffIso, limit) {
      const snap = await db.collection("submissions").where("status", "==", "processing").get();
      return snap.docs
        .map((d) => d.data() as Submission)
        .filter((s) => s.submitted_at < cutoffIso)
        .slice(0, limit);
    },
    async listPendingSubmissions(limit) {
      const snap = await db
        .collection("submissions")
        .where("status", "in", ["queued", "deferred"])
        .limit(limit)
        .get();
      return (snap.docs.map((d) => d.data() as Submission)).sort((a, b) =>
        a.submitted_at < b.submitted_at ? -1 : 1,
      );
    },
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
      // No range filter in the query: equality + range on different fields would need a
      // composite index the deployer has to create by hand. Filter the recency in memory.
      const snapshot = await db.collection("issues").where("category", "==", category).limit(500).get();

      for (const doc of snapshot.docs) {
        const issue = doc.data() as Issue;
        if (issue.last_reported_at < sinceIso) continue;
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
        .limit(200)
        .get();
      // Firestore forbids not-in together with in; filter open issues in memory.
      return snapshot.docs
        .map((doc) => doc.data() as Issue)
        .filter((i) => i.status !== "resolved" && i.status !== "tombstoned");
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
      // One equality query, filtered in memory: a range/OR filter alongside the country
      // equality would need a hand-made composite index. Fine at prototype scale.
      const snapshot = await db.collection("issues").where("country_code", "==", countryCode).get();
      return snapshot.docs
        .map((doc) => doc.data() as Issue)
        .filter((issue) => {
          const statusOk = !["resolved", "tombstoned"].includes(issue.status);
          const eligible = issue.distinct_reporter_count >= 3 || issue.emergency_override;
          // Fraud-flagged issues are suppressed unless emergency_override
          // confirms them (docs/phases/phase-8-fraud-impact-crossborder.md "Traps").
          const fraudOk = issue.emergency_override || issue.fraud_flags.length === 0;
          return statusOk && eligible && fraudOk;
        });
    },
    async getAllDistinctReporterCounts(countryCode) {
      const snapshot = await db.collection("issues").where("country_code", "==", countryCode).get();
      return snapshot.docs
        .map((doc) => doc.data() as Issue)
        .filter((i) => i.status !== "tombstoned")
        .map((i) => i.distinct_reporter_count);
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
        .get();
      if (snapshot.empty) return null;
      // Sorted in memory: equality + orderBy would need a hand-made composite index.
      return (snapshot.docs.map((d) => d.data() as PriorityScore).sort((a, b) => (a.computed_at < b.computed_at ? 1 : -1)))[0];
    },
    async countRecentSubmissionsByIpHash(ipHash, sinceIso) {
      const snapshot = await db
        .collection("submissions")
        .where("submitter_ip_hash", "==", ipHash)
        .select("submitted_at")
        .get();
      return snapshot.docs.filter((d) => (d.data().submitted_at as string) >= sinceIso).length;
    },
    async addFraudFlag(issueId, flag) {
      const ref = db.collection("issues").doc(issueId);
      await db.runTransaction(async (tx) => {
        const doc = await tx.get(ref);
        if (!doc.exists) throw new Error(`addFraudFlag: issue ${issueId} not found`);
        const issue = doc.data() as Issue;
        if (issue.fraud_flags.includes(flag)) return;
        tx.update(ref, { fraud_flags: [...issue.fraud_flags, flag] });
      });
    },
  };
}
