import type { Issue, Submission } from "@pramaan/shared-types";

function normalise(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return norm === 0 ? vec : vec.map((v) => v / norm);
}

/** Running mean of member embeddings, re-normalised — not a replacement with the
 *  newest, otherwise the canonical issue drifts toward whoever reported last
 *  (docs/phases/phase-4-extraction-dedup.md §4.4). `priorCount` is report_count
 *  *before* this merge. */
export function updateRunningEmbedding(
  current: number[] | null,
  incoming: number[],
  priorCount: number,
): number[] {
  if (!current || priorCount === 0) return normalise(incoming);
  const mean = current.map((v, i) => v + (incoming[i] - v) / (priorCount + 1));
  return normalise(mean);
}

export interface MergeOptions {
  embedding?: number[];
  incrementDistinctReporter: boolean;
}

export function mergeSubmissionIntoIssue(
  issue: Issue,
  submission: Submission,
  options: MergeOptions,
): Issue {
  return {
    ...issue,
    submission_ids: [...issue.submission_ids, submission.submission_id],
    report_count: issue.report_count + 1,
    distinct_reporter_count: options.incrementDistinctReporter
      ? issue.distinct_reporter_count + 1
      : issue.distinct_reporter_count,
    last_reported_at: submission.submitted_at,
    embedding: options.embedding
      ? updateRunningEmbedding(issue.embedding, options.embedding, issue.report_count)
      : issue.embedding,
  };
}
