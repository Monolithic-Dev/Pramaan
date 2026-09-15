import type { Citizen, ConsentRecord, Issue, PriorityScore, Submission } from "@jansetu/shared-types";

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
}
