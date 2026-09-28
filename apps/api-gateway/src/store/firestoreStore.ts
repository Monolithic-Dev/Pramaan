import { randomUUID } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import type {
  AgentSession,
  BudgetPlan,
  IssueComment,
  Notification,
  AgentTurn,
  Citizen,
  ConsentRecord,
  ImpactRecord,
  Issue,
  PriorityScore,
  Project,
  StateRecord,
  Submission,
} from "@pramaan/shared-types";
import type { AuditLogEntry, IdempotencyRecord, Store } from "./types.js";

// Most console pages scan every issue, score, project and impact record. On Firebase's free plan (50,000
// reads a day) doing that on every request would exhaust the quota within an hour of demo traffic, so each
// scan is reused for STORE_SCAN_CACHE_MS and dropped whenever this process writes one of those collections.
// The worker writes issues and scores directly; its changes appear once the TTL passes.
const SCANS = new Set(["listIssues", "listProjects", "listScores", "listImpactRecords"]);
const INVALIDATES = new Set(["setEmergencyOverride", "updateIssue", "tombstoneIssue", "putProject", "updateProject", "putImpactRecord"]);

export function withScanCache(store: Store, ttlMs = Number(process.env.STORE_SCAN_CACHE_MS ?? 30_000)): Store {
  if (ttlMs <= 0) return store;
  const cache = new Map<string, { at: number; value: Promise<unknown[]> }>();
  const wrapped: Record<string, unknown> = { ...store };
  for (const [name, fn] of Object.entries(store) as [string, (...args: unknown[]) => Promise<unknown>][]) {
    if (SCANS.has(name)) {
      wrapped[name] = (...args: unknown[]) => {
        const key = `${name}:${JSON.stringify(args)}`;
        const hit = cache.get(key);
        let value = hit && Date.now() - hit.at < ttlMs ? hit.value : undefined;
        if (!value) {
          value = fn(...args) as Promise<unknown[]>;
          cache.set(key, { at: Date.now(), value });
          value.catch(() => cache.delete(key));
        }
        // A fresh array per caller: some sort their result in place.
        return value.then((rows) => [...rows]);
      };
    } else if (INVALIDATES.has(name)) {
      wrapped[name] = async (...args: unknown[]) => {
        try {
          return await fn(...args);
        } finally {
          cache.clear();
        }
      };
    }
  }
  return wrapped as unknown as Store;
}

export function createFirestoreStore(db: Firestore): Store {
  return withScanCache(createUncachedFirestoreStore(db));
}

function createUncachedFirestoreStore(db: Firestore): Store {
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
        .get();
      if (snapshot.empty) return null;
      // Sorted in memory: equality + orderBy would need a hand-made composite index.
      return (snapshot.docs.map((d) => d.data() as PriorityScore).sort((a, b) => (a.computed_at < b.computed_at ? 1 : -1)))[0];
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
        .get();
      return snapshot.docs
        .map((doc) => doc.data() as AgentTurn)
        .sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
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

      // At most one range field in the query (no composite index needed); the rest in memory.
      let ref: FirebaseFirestore.Query = db.collection("agentTurns");
      if (filter.from) ref = ref.where("timestamp", ">=", filter.from);
      const snapshot = await ref.limit(1000).get();
      return snapshot.docs
        .map((doc) => doc.data() as AgentTurn)
        .filter((turn) => !filter.to || turn.timestamp <= filter.to)
        .filter((turn) => filter.refused === undefined || turn.refused === filter.refused)
        .filter((turn) => !sessionIds || sessionIds.has(turn.session_id));
    },
    async getProject(projectId) {
      const doc = await db.collection("projects").doc(projectId).get();
      return doc.exists ? (doc.data() as Project) : null;
    },
    async putProject(project) {
      await db.collection("projects").doc(project.project_id).set(project);
    },
    async updateProject(projectId, patch) {
      const ref = db.collection("projects").doc(projectId);
      return db.runTransaction(async (tx) => {
        const doc = await tx.get(ref);
        if (!doc.exists) throw new Error(`updateProject: project ${projectId} not found`);
        const updated = { ...(doc.data() as Project), ...patch };
        tx.set(ref, updated);
        return updated;
      });
    },
    async getSubmissionsByIssue(issueId) {
      const snapshot = await db.collection("submissions").where("issue_id", "==", issueId).get();
      return snapshot.docs.map((doc) => doc.data() as Submission);
    },
    async getImpactRecord(projectId) {
      const doc = await db.collection("impactRecords").doc(projectId).get();
      return doc.exists ? (doc.data() as ImpactRecord) : null;
    },
    async putImpactRecord(record) {
      await db.collection("impactRecords").doc(record.project_id).set(record);
    },
    async getSubmissionsByCitizen(citizenId) {
      const snapshot = await db
        .collection("submissions")
        .where("citizen_id", "==", citizenId)
        .get();
      return snapshot.docs.map((doc) => doc.data() as Submission);
    },
    async getConsentRecordsByCitizen(citizenId) {
      const snapshot = await db
        .collection("consentRecords")
        .where("citizen_id", "==", citizenId)
        .get();
      return snapshot.docs.map((doc) => doc.data() as ConsentRecord);
    },
    async tombstoneIssue(issueId) {
      await db.collection("issues").doc(issueId).update({ status: "tombstoned" });
    },
    async listIssues(stateId) {
      const ref = stateId
        ? db.collection("issues").where("state_id", "==", stateId)
        : db.collection("issues");
      const snapshot = await ref.get();
      return snapshot.docs.map((d) => d.data() as Issue).filter((i) => i.status !== "tombstoned");
    },
    async getProjectByIssue(issueId) {
      const snapshot = await db.collection("projects").where("issue_id", "==", issueId).limit(1).get();
      return snapshot.empty ? null : (snapshot.docs[0].data() as Project);
    },
    async getImpactRecordByIssue(issueId) {
      const snapshot = await db
        .collection("impactRecords")
        .where("issue_id", "==", issueId)
        .limit(1)
        .get();
      return snapshot.empty ? null : (snapshot.docs[0].data() as ImpactRecord);
    },
    async putState(state) {
      await db.collection("states").doc(state.state_id).set(state);
    },
    async listStates() {
      const snapshot = await db.collection("states").get();
      return snapshot.docs.map((d) => d.data() as StateRecord);
    },
    async updateIssue(issueId, patch) {
      const ref = db.collection("issues").doc(issueId);
      return db.runTransaction(async (tx) => {
        const doc = await tx.get(ref);
        if (!doc.exists) throw new Error(`updateIssue: issue ${issueId} not found`);
        const updated = { ...(doc.data() as Issue), ...patch };
        tx.set(ref, updated);
        return updated;
      });
    },
    async listProjects() {
      const snapshot = await db.collection("projects").get();
      return snapshot.docs.map((d) => d.data() as Project);
    },
    async listAuditLog(limit) {
      // One collection scan sorted in memory: ordering by timestamp would need an index the
      // deployer creates by hand, and the audit log is small at prototype scale.
      const snapshot = await db.collection("auditLog").get();
      return snapshot.docs
        .map((d) => d.data() as AuditLogEntry)
        .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
        .slice(0, limit);
    },

    async listScores() {
      const snapshot = await db.collection("priorityScores").where("is_canonical", "==", true).get();
      const latest = new Map<string, PriorityScore>();
      for (const d of snapshot.docs) {
        const s = d.data() as PriorityScore;
        const cur = latest.get(s.issue_id);
        if (!cur || cur.computed_at < s.computed_at) latest.set(s.issue_id, s);
      }
      return [...latest.values()];
    },
    async listImpactRecords() {
      const snapshot = await db.collection("impactRecords").get();
      return snapshot.docs.map((d) => d.data() as ImpactRecord);
    },
    async putComment(comment) {
      await db.collection("issueComments").doc(comment.comment_id).set(comment);
    },
    async listComments(issueId) {
      const snapshot = await db.collection("issueComments").where("issue_id", "==", issueId).get();
      return snapshot.docs.map((d) => d.data() as IssueComment).sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    },
    async putNotification(notification) {
      await db.collection("notifications").doc(notification.notification_id).set(notification);
    },
    async listNotifications(recipientId, limit) {
      const snapshot = await db.collection("notifications").where("recipient_id", "==", recipientId).get();
      return snapshot.docs
        .map((d) => d.data() as Notification)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .slice(0, limit);
    },
    async markNotificationsRead(recipientId, ids) {
      const snapshot = await db.collection("notifications").where("recipient_id", "==", recipientId).get();
      const targets = snapshot.docs.filter((d) => {
        const n = d.data() as Notification;
        return !n.read_at && (!ids || ids.includes(n.notification_id));
      });
      const readAt = new Date().toISOString();
      for (let i = 0; i < targets.length; i += 400) {
        const batch = db.batch();
        for (const d of targets.slice(i, i + 400)) batch.update(d.ref, { read_at: readAt });
        await batch.commit();
      }
      return targets.length;
    },
    async putPlan(plan) {
      await db.collection("budgetPlans").doc(plan.plan_id).set(plan);
    },
    async getPlan(planId) {
      const doc = await db.collection("budgetPlans").doc(planId).get();
      return doc.exists ? (doc.data() as BudgetPlan) : null;
    },
    async listPlans(regionId) {
      const ref = regionId ? db.collection("budgetPlans").where("region_id", "==", regionId) : db.collection("budgetPlans");
      const snapshot = await ref.get();
      return snapshot.docs.map((d) => d.data() as BudgetPlan).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    },
    async getSubmissionByTrackingCode(code) {
      const snapshot = await db.collection("submissions").where("tracking_code", "==", code).limit(1).get();
      return snapshot.empty ? null : (snapshot.docs[0].data() as Submission);
    },
    async putSupport(issueId, citizenId) {
      try {
        // create() fails if the document exists, which makes the endorsement idempotent per citizen.
        await db.collection("issueSupports").doc(`${issueId}_${citizenId}`).create({ issue_id: issueId, citizen_id: citizenId, created_at: new Date().toISOString() });
        return true;
      } catch (err) {
        if ((err as { code?: number }).code === 6) return false; // ALREADY_EXISTS
        throw err;
      }
    },
    async hasSupport(issueId, citizenId) {
      return (await db.collection("issueSupports").doc(`${issueId}_${citizenId}`).get()).exists;
    },
    async listSupporters(issueId) {
      const snapshot = await db.collection("issueSupports").where("issue_id", "==", issueId).get();
      return snapshot.docs.map((d) => d.data().citizen_id as string);
    },
    async getSubmissionByMediaUrl(url) {
      for (const field of ["photo_url", "raw_audio_url"]) {
        const snapshot = await db.collection("submissions").where(field, "==", url).limit(1).get();
        if (!snapshot.empty) return snapshot.docs[0].data() as Submission;
      }
      return null;
    },
  };
}
