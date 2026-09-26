import type { Issue, PriorityScore, Submission } from "@pramaan/shared-types";

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
  /** Submissions still queued/deferred (Pub/Sub-less deployments poll these). Oldest first. */
  listPendingSubmissions(limit: number): Promise<Submission[]>;
  /** Submissions stuck in "processing" since before `cutoffIso` (worker crashed or was killed mid-run). */
  listStaleProcessingSubmissions(cutoffIso: string, limit: number): Promise<Submission[]>;

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

  // --- Phase 5: scoring ---

  /** distinct_reporter_count >= 3, OR emergency_override, excluding resolved/tombstoned
   *  (docs/EDGE_CASES.md #16, #11). */
  getEligibleIssuesForScoring(countryCode: string): Promise<Issue[]>;

  /** Every non-tombstoned issue's distinct_reporter_count, for the batch's P95_country. */
  getAllDistinctReporterCounts(countryCode: string): Promise<number[]>;

  putPriorityScore(score: PriorityScore): Promise<void>;

  /** Denormalizes the canonical score onto the Issue for fast reads (§5.4). */
  updateIssueScore(issueId: string, score: { composite_score: number; latest_score_id: string }): Promise<void>;

  /** Mean ImpactRecord.efficacy for (category, any region in the ancestry chain); null if no history. */
  getImpactEfficacy(category: string, regionAncestry: string[]): Promise<number | null>;

  /** Latest canonical PriorityScore for an issue, or null if never scored. */
  getCanonicalScore(issueId: string): Promise<PriorityScore | null>;

  // --- Phase 8: anti-fraud ---

  /** Count of submissions from this IP hash at or after `sinceIso` — burst-detection input
   *  (docs/phases/phase-8-fraud-impact-crossborder.md §8.1). */
  countRecentSubmissionsByIpHash(ipHash: string, sinceIso: string): Promise<number>;

  /** Adds `flag` to the issue's fraud_flags if not already present (idempotent). */
  addFraudFlag(issueId: string, flag: string): Promise<void>;
}
