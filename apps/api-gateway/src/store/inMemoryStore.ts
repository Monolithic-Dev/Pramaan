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
} from "@jansetu/shared-types";
import type { AuditLogEntry, IdempotencyRecord, Store } from "./types.js";

// Used by tests, and as a same-process fallback if no Firestore project is
// configured — never used for a real deploy (state doesn't survive a restart).
// Exposes `issues`/`priorityScores` beyond the Store interface so tests can
// seed data the worker would normally have written.
export function createInMemoryStore(): Store & {
  issues: Map<string, Issue>;
  priorityScores: Map<string, PriorityScore>;
  auditLog: AuditLogEntry[];
  agentSessions: Map<string, AgentSession>;
  agentTurns: Map<string, AgentTurn>;
  projects: Map<string, Project>;
} {
  const citizens = new Map<string, Citizen>();
  const submissions = new Map<string, Submission>();
  const rateLimits = new Map<string, { count: number; windowStart: number }>();
  const idempotencyKeys = new Map<string, IdempotencyRecord>();
  const consentRecords = new Map<string, ConsentRecord>();
  const issues = new Map<string, Issue>();
  const priorityScores = new Map<string, PriorityScore>();
  const auditLog: AuditLogEntry[] = [];
  const agentSessions = new Map<string, AgentSession>();
  const agentTurns = new Map<string, AgentTurn>();
  const projects = new Map<string, Project>();
  const impactRecords = new Map<string, ImpactRecord>(); // keyed by project_id
  const states = new Map<string, StateRecord>();
  const comments = new Map<string, IssueComment>();
  const notifications = new Map<string, Notification>();
  const plans = new Map<string, BudgetPlan>();
  const supports = new Set<string>();

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
    async getIssuesByRegion(regionId, category) {
      return [...issues.values()].filter(
        (issue) =>
          issue.admin_region_id === regionId && (!category || issue.category === category),
      );
    },
    async putAgentSession(session) {
      agentSessions.set(session.session_id, session);
    },
    async getAgentSession(sessionId) {
      return agentSessions.get(sessionId) ?? null;
    },
    async putAgentTurn(turn) {
      agentTurns.set(turn.turn_id, turn);
    },
    async getAgentTurns(sessionId) {
      return [...agentTurns.values()]
        .filter((t) => t.session_id === sessionId)
        .sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
    },
    async queryAgentTurns(filter) {
      let sessionIds: Set<string> | null = null;
      if (filter.officerId) {
        sessionIds = new Set(
          [...agentSessions.values()]
            .filter((s) => s.officer_id === filter.officerId)
            .map((s) => s.session_id),
        );
      }
      return [...agentTurns.values()].filter((turn) => {
        if (sessionIds && !sessionIds.has(turn.session_id)) return false;
        if (filter.from && turn.timestamp < filter.from) return false;
        if (filter.to && turn.timestamp > filter.to) return false;
        if (filter.refused !== undefined && turn.refused !== filter.refused) return false;
        return true;
      });
    },
    async getProject(projectId) {
      return projects.get(projectId) ?? null;
    },
    async putProject(project) {
      projects.set(project.project_id, project);
    },
    async updateProject(projectId, patch) {
      const project = projects.get(projectId);
      if (!project) throw new Error(`updateProject: project ${projectId} not found`);
      const updated = { ...project, ...patch };
      projects.set(projectId, updated);
      return updated;
    },
    async getSubmissionsByIssue(issueId) {
      return [...submissions.values()].filter((s) => s.issue_id === issueId);
    },
    async getImpactRecord(projectId) {
      return impactRecords.get(projectId) ?? null;
    },
    async putImpactRecord(record) {
      impactRecords.set(record.project_id, record);
    },
    async getSubmissionsByCitizen(citizenId) {
      return [...submissions.values()].filter((s) => s.citizen_id === citizenId);
    },
    async getConsentRecordsByCitizen(citizenId) {
      return [...consentRecords.values()].filter((c) => c.citizen_id === citizenId);
    },
    async tombstoneIssue(issueId) {
      const issue = issues.get(issueId);
      if (!issue) return;
      issues.set(issueId, { ...issue, status: "tombstoned" });
    },
    async listIssues(stateId) {
      return [...issues.values()].filter(
        (i) => i.status !== "tombstoned" && (!stateId || i.state_id === stateId),
      );
    },
    async getProjectByIssue(issueId) {
      return [...projects.values()].find((p) => p.issue_id === issueId) ?? null;
    },
    async getImpactRecordByIssue(issueId) {
      return [...impactRecords.values()].find((r) => r.issue_id === issueId) ?? null;
    },
    async putState(state) {
      states.set(state.state_id, state);
    },
    async listStates() {
      return [...states.values()];
    },
    async updateIssue(issueId, patch) {
      const issue = issues.get(issueId);
      if (!issue) throw new Error(`updateIssue: issue ${issueId} not found`);
      const updated = { ...issue, ...patch };
      issues.set(issueId, updated);
      return updated;
    },
    async listProjects() {
      return [...projects.values()];
    },
    async listAuditLog(limit) {
      return [...auditLog].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)).slice(0, limit);
    },
    async listScores() {
      const latest = new Map<string, PriorityScore>();
      for (const s of priorityScores.values()) {
        if (!s.is_canonical) continue;
        const cur = latest.get(s.issue_id);
        if (!cur || cur.computed_at < s.computed_at) latest.set(s.issue_id, s);
      }
      return [...latest.values()];
    },
    async listImpactRecords() {
      return [...impactRecords.values()];
    },
    async putComment(comment) {
      comments.set(comment.comment_id, comment);
    },
    async listComments(issueId) {
      return [...comments.values()].filter((c) => c.issue_id === issueId).sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    },
    async putNotification(notification) {
      notifications.set(notification.notification_id, notification);
    },
    async listNotifications(recipientId, limit) {
      return [...notifications.values()]
        .filter((n) => n.recipient_id === recipientId)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .slice(0, limit);
    },
    async markNotificationsRead(recipientId, ids) {
      let changed = 0;
      for (const n of notifications.values()) {
        if (n.recipient_id !== recipientId || n.read_at || (ids && !ids.includes(n.notification_id))) continue;
        notifications.set(n.notification_id, { ...n, read_at: new Date().toISOString() });
        changed += 1;
      }
      return changed;
    },
    async putPlan(plan) {
      plans.set(plan.plan_id, plan);
    },
    async getPlan(planId) {
      return plans.get(planId) ?? null;
    },
    async listPlans(regionId) {
      return [...plans.values()]
        .filter((p) => !regionId || p.region_id === regionId)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    },
    async getSubmissionByTrackingCode(code) {
      return [...submissions.values()].find((s) => s.tracking_code === code) ?? null;
    },
    async putSupport(issueId, citizenId) {
      const key = `${issueId}:${citizenId}`;
      if (supports.has(key)) return false;
      supports.add(key);
      return true;
    },
    async hasSupport(issueId, citizenId) {
      return supports.has(`${issueId}:${citizenId}`);
    },
    issues,
    priorityScores,
    auditLog,
    agentSessions,
    agentTurns,
    projects,
  };
}
