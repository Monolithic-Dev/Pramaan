import { randomUUID } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import type {
  AgentSession,
  AgentTurn,
  Citizen,
  ConsentRecord,
  Issue,
  PriorityScore,
  Submission,
} from "@jansetu/shared-types";
import type { AuditLogEntry, IdempotencyRecord, Store } from "./types.js";

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
    async getIdempotencyRecord(key) {
      const doc = await db.collection("idempotencyKeys").doc(key).get();
      return doc.exists ? (doc.data() as IdempotencyRecord) : null;
    },
    async putIdempotencyRecord(key, record) {
      // TTL policy on this collection's `createdAt` field (24h, per docs/EDGE_CASES.md
      // #14) is configured at the infra level (infra/gcp/setup.sh), not enforced here.
      await db
        .collection("idempotencyKeys")
        .doc(key)
        .set({ ...record, createdAt: Date.now() });
    },
    async putConsentRecord(record) {
      await db.collection("consentRecords").doc(record.consent_id).set(record);
    },
    async getIssue(issueId) {
      const doc = await db.collection("issues").doc(issueId).get();
      return doc.exists ? (doc.data() as Issue) : null;
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
    async setEmergencyOverride(issueId, enabled) {
      const ref = db.collection("issues").doc(issueId);
      return db.runTransaction(async (tx) => {
        const doc = await tx.get(ref);
        if (!doc.exists) throw new Error(`setEmergencyOverride: issue ${issueId} not found`);
        const updated = { ...(doc.data() as Issue), emergency_override: enabled };
        tx.set(ref, updated);
        return updated;
      });
    },
    async putAuditLogEntry(entry) {
      await db
        .collection("auditLog")
        .doc(entry.audit_id || randomUUID())
        .set(entry);
    },
    async getIssuesByRegion(regionId, category) {
      let ref = db.collection("issues").where("admin_region_id", "==", regionId);
      if (category) ref = ref.where("category", "==", category);
      const snapshot = await ref.get();
      return snapshot.docs.map((doc) => doc.data() as Issue);
    },
    async putAgentSession(session) {
      await db.collection("agentSessions").doc(session.session_id).set(session);
    },
    async getAgentSession(sessionId) {
      const doc = await db.collection("agentSessions").doc(sessionId).get();
      return doc.exists ? (doc.data() as AgentSession) : null;
    },
    async putAgentTurn(turn) {
      await db.collection("agentTurns").doc(turn.turn_id).set(turn);
    },
    async getAgentTurns(sessionId) {
      const snapshot = await db
        .collection("agentTurns")
        .where("session_id", "==", sessionId)
        .orderBy("timestamp", "asc")
        .get();
      return snapshot.docs.map((doc) => doc.data() as AgentTurn);
    },
    async queryAgentTurns(filter) {
      let sessionIds: Set<string> | null = null;
      if (filter.officerId) {
        const sessions = await db
          .collection("agentSessions")
          .where("officer_id", "==", filter.officerId)
          .get();
        sessionIds = new Set(sessions.docs.map((doc) => doc.id));
        if (sessionIds.size === 0) return [];
      }

      let ref: FirebaseFirestore.Query = db.collection("agentTurns");
      if (filter.from) ref = ref.where("timestamp", ">=", filter.from);
      if (filter.to) ref = ref.where("timestamp", "<=", filter.to);
      if (filter.refused !== undefined) ref = ref.where("refused", "==", filter.refused);
      const snapshot = await ref.get();
      return snapshot.docs
        .map((doc) => doc.data() as AgentTurn)
        .filter((turn) => !sessionIds || sessionIds.has(turn.session_id));
    },
  };
}
