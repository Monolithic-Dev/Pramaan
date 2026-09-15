import type { Issue, Submission } from "@jansetu/shared-types";
import type { CandidateQuery, Store } from "./types.js";

export function createInMemoryStore(): Store {
  const submissions = new Map<string, Submission>();
  const issues = new Map<string, Issue>();

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
  };
}
