import type { Citizen, ConsentRecord, Issue, PriorityScore, Submission } from "@jansetu/shared-types";
import type { AuditLogEntry, IdempotencyRecord, Store } from "./types.js";

// Used by tests, and as a same-process fallback if no Firestore project is
// configured — never used for a real deploy (state doesn't survive a restart).
// Exposes `issues`/`priorityScores` beyond the Store interface so tests can
// seed data the worker would normally have written.
export function createInMemoryStore(): Store & {
  issues: Map<string, Issue>;
  priorityScores: Map<string, PriorityScore>;
  auditLog: AuditLogEntry[];
} {
  const citizens = new Map<string, Citizen>();
  const submissions = new Map<string, Submission>();
  const rateLimits = new Map<string, { count: number; windowStart: number }>();
  const idempotencyKeys = new Map<string, IdempotencyRecord>();
  const consentRecords = new Map<string, ConsentRecord>();
  const issues = new Map<string, Issue>();
  const priorityScores = new Map<string, PriorityScore>();
  const auditLog: AuditLogEntry[] = [];

  return {
    async getCitizen(citizenId) {
      return citizens.get(citizenId) ?? null;
    },
    async putCitizen(citizen) {
      citizens.set(citizen.citizen_id, citizen);
    },
    async putSubmission(submission) {
      submissions.set(submission.submission_id, submission);
    },
    async getSubmission(submissionId) {
      return submissions.get(submissionId) ?? null;
    },
    async incrementRateLimit(key, windowMs) {
      const now = Date.now();
      const existing = rateLimits.get(key);
      if (!existing || now - existing.windowStart >= windowMs) {
        rateLimits.set(key, { count: 1, windowStart: now });
        return 1;
      }
      existing.count += 1;
      return existing.count;
    },
    async getIdempotencyRecord(key) {
      return idempotencyKeys.get(key) ?? null;
    },
    async putIdempotencyRecord(key, record) {
      idempotencyKeys.set(key, record);
    },
    async putConsentRecord(record) {
      consentRecords.set(record.consent_id, record);
    },
    async getIssue(issueId) {
      return issues.get(issueId) ?? null;
    },
    async getCanonicalScore(issueId) {
      const candidates = [...priorityScores.values()].filter(
        (s) => s.issue_id === issueId && s.is_canonical,
      );
      if (candidates.length === 0) return null;
      return candidates.sort((a, b) => (a.computed_at < b.computed_at ? 1 : -1))[0];
    },
    async setEmergencyOverride(issueId, enabled) {
      const issue = issues.get(issueId);
      if (!issue) throw new Error(`setEmergencyOverride: issue ${issueId} not found`);
      const updated = { ...issue, emergency_override: enabled };
      issues.set(issueId, updated);
      return updated;
    },
    async putAuditLogEntry(entry) {
      auditLog.push(entry);
    },
    issues,
    priorityScores,
    auditLog,
  };
}
