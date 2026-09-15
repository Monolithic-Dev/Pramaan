import type { Issue, PriorityScore, Submission } from "@jansetu/shared-types";
import type { CandidateQuery, Store } from "./types.js";

export function createInMemoryStore(): Store {
  const submissions = new Map<string, Submission>();
  const issues = new Map<string, Issue>();
  const priorityScores = new Map<string, PriorityScore>();

  return {
    async getSubmission(submissionId) {
      return submissions.get(submissionId) ?? null;
    },
    async putSubmission(submission) {
      submissions.set(submission.submission_id, submission);
    },
    async findOwnRecentIssue(citizenId, category, sinceIso) {
      for (const issue of issues.values()) {
        if (issue.category !== category) continue;
        if (issue.last_reported_at < sinceIso) continue;
        const ownSubmissions = issue.submission_ids
          .map((id) => submissions.get(id))
          .filter((s): s is Submission => Boolean(s));
        if (ownSubmissions.some((s) => s.citizen_id === citizenId)) return issue;
      }
      return null;
    },
    async queryCandidateIssues({ stateId, category, geohashCells }: CandidateQuery) {
      return [...issues.values()].filter(
        (issue) =>
          issue.state_id === stateId &&
          issue.category === category &&
          issue.geohash !== null &&
          geohashCells.includes(issue.geohash) &&
          !["resolved", "tombstoned"].includes(issue.status),
      );
    },
    async createIssue(issue) {
      issues.set(issue.issue_id, issue);
    },
    async getIssue(issueId) {
      return issues.get(issueId) ?? null;
    },
    async hasCitizenReportedIssue(issueId, citizenId) {
      const issue = issues.get(issueId);
      if (!issue) return false;
      return issue.submission_ids.some((id) => submissions.get(id)?.citizen_id === citizenId);
    },
    async mergeIssue(issueId, merge) {
      const current = issues.get(issueId);
      if (!current) throw new Error(`mergeIssue: issue ${issueId} not found`);
      const updated = merge(current);
      issues.set(issueId, updated);
      return updated;
    },
    async getEligibleIssuesForScoring(countryCode) {
      // A fraud-flagged issue is suppressed from scoring until an officer
      // clears it — unless an officer has separately confirmed it's real via
      // emergency_override, which bypasses both the report-count floor and
      // fraud suppression (docs/phases/phase-8-fraud-impact-crossborder.md
      // "Traps": "a real emergency looks exactly like a coordinated burst").
      return [...issues.values()].filter(
        (issue) =>
          issue.country_code === countryCode &&
          !["resolved", "tombstoned"].includes(issue.status) &&
          (issue.emergency_override ||
            (issue.fraud_flags.length === 0 && issue.distinct_reporter_count >= 3)),
      );
    },
    async getAllDistinctReporterCounts(countryCode) {
      return [...issues.values()]
        .filter((issue) => issue.country_code === countryCode && issue.status !== "tombstoned")
        .map((issue) => issue.distinct_reporter_count);
    },
    async putPriorityScore(score) {
      priorityScores.set(score.score_id, score);
    },
    async updateIssueScore(issueId, score) {
      const issue = issues.get(issueId);
      if (!issue) throw new Error(`updateIssueScore: issue ${issueId} not found`);
      issues.set(issueId, {
        ...issue,
        composite_score: score.composite_score,
        latest_score_id: score.latest_score_id,
      });
    },
    async getImpactEfficacy() {
      // No ImpactRecord writer exists yet (Phase 8) — always "no history",
      // which is the correct default (effFactor stays exactly 1.0).
      return null;
    },
    async getCanonicalScore(issueId) {
      const candidates = [...priorityScores.values()].filter(
        (s) => s.issue_id === issueId && s.is_canonical,
      );
      if (candidates.length === 0) return null;
      return candidates.sort((a, b) => (a.computed_at < b.computed_at ? 1 : -1))[0];
    },
    async countRecentSubmissionsByIpHash(ipHash, sinceIso) {
      return [...submissions.values()].filter(
        (s) => s.submitter_ip_hash === ipHash && s.submitted_at >= sinceIso,
      ).length;
    },
    async addFraudFlag(issueId, flag) {
      const issue = issues.get(issueId);
      if (!issue) throw new Error(`addFraudFlag: issue ${issueId} not found`);
      if (issue.fraud_flags.includes(flag)) return;
      issues.set(issueId, { ...issue, fraud_flags: [...issue.fraud_flags, flag] });
    },
  };
}
