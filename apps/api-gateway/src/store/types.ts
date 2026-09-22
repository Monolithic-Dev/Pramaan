import type {
  AgentSession,
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

export interface IdempotencyRecord {
  submissionId: string;
  requestHash: string;
}

/** Lightweight placeholder pending a proper AuditLog entity in shared-types
 *  (docs/SECURITY_PRIVACY.md §6) — every officer action writes one of these. */
export interface AuditLogEntry {
  audit_id: string;
  actor_id: string;
  action: string;
  before: unknown;
  after: unknown;
  justification: string | null;
  timestamp: string;
  /** The issue/project/officer the action was about, so a detail page can show its own history. */
  target_id?: string;
}

// Narrow seam over Firestore so routes/middleware never import the admin SDK
// directly — this is what lets tests run against an in-memory fake instead of
// needing live Firestore credentials.
export interface Store {
  getCitizen(citizenId: string): Promise<Citizen | null>;
  putCitizen(citizen: Citizen): Promise<void>;
  putSubmission(submission: Submission): Promise<void>;
  getSubmission(submissionId: string): Promise<Submission | null>;
  /** Increments the rolling counter for `key` and returns the new count within `windowMs`. */
  incrementRateLimit(key: string, windowMs: number): Promise<number>;
  /** Looks up a previously-seen Idempotency-Key (docs/EDGE_CASES.md #14). Null if unseen or expired. */
  getIdempotencyRecord(key: string): Promise<IdempotencyRecord | null>;
  /** Stores an Idempotency-Key -> submission mapping with a 24h TTL. */
  putIdempotencyRecord(key: string, record: IdempotencyRecord): Promise<void>;
  putConsentRecord(record: ConsentRecord): Promise<void>;

  getIssue(issueId: string): Promise<Issue | null>;
  /** Latest canonical (is_canonical: true) PriorityScore for an issue, or null if never scored. */
  getCanonicalScore(issueId: string): Promise<PriorityScore | null>;
  setEmergencyOverride(issueId: string, enabled: boolean): Promise<Issue>;
  putAuditLogEntry(entry: AuditLogEntry): Promise<void>;

  /** Exact admin_region_id match, optionally filtered by category (docs/AI_PIPELINE.md Stage 5). */
  getIssuesByRegion(regionId: string, category?: string): Promise<Issue[]>;

  putAgentSession(session: AgentSession): Promise<void>;
  getAgentSession(sessionId: string): Promise<AgentSession | null>;
  putAgentTurn(turn: AgentTurn): Promise<void>;
  getAgentTurns(sessionId: string): Promise<AgentTurn[]>;
  /** For GET /audit/agent-turns (state_admin only). */
  queryAgentTurns(filter: {
    officerId?: string;
    from?: string;
    to?: string;
    refused?: boolean;
  }): Promise<AgentTurn[]>;

  // --- Phase 8: impact loop ---

  getProject(projectId: string): Promise<Project | null>;
  /** No "recommend a project" endpoint exists yet (docs/phases/phase-8-manual-checklist.md)
   *  — used to seed a Project ahead of mark-complete/confirm-resolution. */
  putProject(project: Project): Promise<void>;
  updateProject(projectId: string, patch: Partial<Project>): Promise<Project>;
  getSubmissionsByIssue(issueId: string): Promise<Submission[]>;
  getImpactRecord(projectId: string): Promise<ImpactRecord | null>;
  putImpactRecord(record: ImpactRecord): Promise<void>;

  // --- Phase 8: privacy ---

  getSubmissionsByCitizen(citizenId: string): Promise<Submission[]>;
  getConsentRecordsByCitizen(citizenId: string): Promise<ConsentRecord[]>;
  tombstoneIssue(issueId: string): Promise<void>;

  // --- Phases 10-14: insights ---

  /** Every non-tombstoned Issue in a state (or all states when omitted). */
  listIssues(stateId?: string): Promise<Issue[]>;
  getProjectByIssue(issueId: string): Promise<Project | null>;
  getImpactRecordByIssue(issueId: string): Promise<ImpactRecord | null>;
  putState(state: StateRecord): Promise<void>;
  listStates(): Promise<StateRecord[]>;

  // --- Product console ---

  updateIssue(issueId: string, patch: Partial<Issue>): Promise<Issue>;
  listProjects(): Promise<Project[]>;
  /** Newest first. */
  listAuditLog(limit: number): Promise<AuditLogEntry[]>;
}
