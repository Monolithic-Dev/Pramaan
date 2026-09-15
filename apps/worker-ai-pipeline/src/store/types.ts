import type { Issue, Submission } from "@jansetu/shared-types";

export interface CandidateQuery {
  stateId: string;
  category: string;
  geohashCells: string[];
}

// Narrow seam over Firestore, same pattern as api-gateway's store — lets the
// dedup pipeline run in tests against an in-memory fake with no live project.
export interface Store {
  getSubmission(submissionId: string): Promise<Submission | null>;
  putSubmission(submission: Submission): Promise<void>;

  /** Same-reporter pre-check (docs/EDGE_CASES.md #4) — before embedding, before cost. */
  findOwnRecentIssue(
    citizenId: string,
    category: string,
    sinceIso: string,
  ): Promise<Issue | null>;

  /** Geohash + category + status candidate retrieval (docs/AI_PIPELINE.md Stage 3). */
  queryCandidateIssues(query: CandidateQuery): Promise<Issue[]>;

  createIssue(issue: Issue): Promise<void>;
  getIssue(issueId: string): Promise<Issue | null>;

  /** Has this citizen already reported this issue before (any time window)? Decides
   *  whether a merge increments `distinct_reporter_count`. */
  hasCitizenReportedIssue(issueId: string, citizenId: string): Promise<boolean>;

  /**
   * Atomically reads then updates an issue — required to avoid a
   * read-modify-write race when concurrent submissions land on the same
   * cluster (docs/phases/phase-4-extraction-dedup.md "Traps").
   */
  mergeIssue(issueId: string, merge: (issue: Issue) => Issue): Promise<Issue>;
}
