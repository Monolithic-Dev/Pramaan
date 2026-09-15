import { randomUUID } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import type { Issue, Submission } from "@jansetu/shared-types";
import { CATEGORIZATION_PROMPT_VERSION, type CategorizationResult } from "@jansetu/ai-prompts";
import {
  cosine,
  densityClass,
  geohashDecodeCenter,
  geohashNeighbours,
  haversineMeters,
  RADIUS_M,
} from "@jansetu/shared-utils";
import type { Deps } from "../deps.js";
import { mergeSubmissionIntoIssue, updateRunningEmbedding } from "./issueMerge.js";
import { resolveLocation } from "./regionResolution.js";
import { env } from "../lib/env.js";

const SAME_REPORTER_WINDOW_MS = 72 * 60 * 60 * 1000;
const EMBEDDING_MODEL = "text-embedding-005";

// docs/phases/phase-8-fraud-impact-crossborder.md §8.1: rule-based, not ML.
// Flag for officer review, never auto-reject — a false positive silently
// disenfranchises a legitimate citizen, a strictly worse failure.
const BURST_WINDOW_MS = 20 * 60 * 1000;
const BURST_THRESHOLD = 5;

// Statuses this worker still has work to do on. Pub/Sub is at-least-once
// delivery, not exactly-once — anything already past this stage is a no-op
// replay (senior-backend's "every Pub/Sub handler must be idempotent").
const PENDING_STATUSES: Submission["status"][] = ["queued", "deferred"];

export async function processSubmission(
  deps: Deps,
  submissionId: string,
  log: FastifyBaseLogger,
): Promise<void> {
  const submission = await deps.store.getSubmission(submissionId);
  if (!submission || !PENDING_STATUSES.includes(submission.status)) return;

  submission.status = "processing";
  await deps.store.putSubmission(submission);

  const textForExtraction =
    submission.pii_scrubbed_text ?? submission.translated_text ?? submission.raw_text;

  if (!textForExtraction) {
    // Voice channel not yet transcribed (STT isn't wired up — see
    // docs/phases/phase-3-manual-checklist.md). Nothing to categorize yet.
    submission.status = "flagged";
    submission.processing_error = "no_text_available_for_categorization";
    await deps.store.putSubmission(submission);
    return;
  }

  let categorization = await deps.categorization.categorize(textForExtraction);
  let isFallback = false;
  if (!categorization) {
    // Malformed twice (docs/EDGE_CASES.md #9) — raw-text-only fallback,
    // never silently dropped. This path deliberately skips the confidence
    // gate below: the whole point of the fallback is that the submission
    // still becomes an Issue, just an uncategorized one.
    isFallback = true;
    categorization = {
      category: "other",
      subcategory: "unspecified",
      severity_estimate: "medium",
      extracted_location_text: null,
      summary: textForExtraction.slice(0, 150),
      confidence: 0,
      contains_personal_emergency: false,
    };
  }

  if (categorization.contains_personal_emergency) {
    submission.status = "flagged";
    submission.processing_error = "personal_emergency_detected";
    await deps.store.putSubmission(submission);
    return;
  }

  if (!isFallback && categorization.confidence < 0.5) {
    submission.status = "flagged";
    submission.processing_error = "low_confidence_extraction";
    await deps.store.putSubmission(submission);
    return;
  }

  const { geohash, adminRegionId, stateId } = resolveLocation(submission.lat, submission.lng);

  try {
    const issueId = await dedupe(deps, submission, categorization, geohash, stateId, log);
    submission.issue_id = issueId;
    submission.state_id = stateId;
    submission.status = "processed";
    await evaluateAntiFraud(deps, submission, issueId, log);
  } catch (err) {
    log.error({ err, submissionId }, "dedup pipeline failed");
    submission.status = "flagged";
    submission.processing_error = "dedup_pipeline_error";
  }

  await deps.store.putSubmission(submission);
  void adminRegionId; // resolved once Phase 4.6 lands; unused until then
}

async function dedupe(
  deps: Deps,
  submission: Submission,
  categorization: CategorizationResult,
  geohash: string | null,
  stateId: string,
  log: FastifyBaseLogger,
): Promise<string> {
  const category = categorization.category;

  // 1. Same-reporter pre-check (docs/EDGE_CASES.md #4) — before embedding, before cost.
  if (submission.citizen_id !== "anonymous") {
    const sinceIso = new Date(Date.now() - SAME_REPORTER_WINDOW_MS).toISOString();
    const own = await deps.store.findOwnRecentIssue(submission.citizen_id, category, sinceIso);
    if (own) {
      const merged = await deps.store.mergeIssue(own.issue_id, (issue) =>
        mergeSubmissionIntoIssue(issue, submission, { incrementDistinctReporter: false }),
      );
      return merged.issue_id;
    }
  }

  // docs/AI_PIPELINE.md Stage 3: embed the categorization summary, not the raw
  // text — short and information-dense is what makes candidate similarity work.
  const embeddingInput = categorization.summary;
  let embedding: number[] | null = null;
  let bestIssue: Issue | null = null;
  let bestScore = 0;

  if (geohash) {
    const cells = geohashNeighbours(geohash);
    const candidates = await deps.store.queryCandidateIssues({ stateId, category, geohashCells: cells });

    // Population-based density isn't resolvable until Phase 4.6 loads real
    // AdminRegion boundaries — defaults to "peri" (800m radius).
    const radius = RADIUS_M[densityClass(null)];
    const submissionPoint = { lat: submission.lat as number, lng: submission.lng as number };
    const near = candidates.filter((issue) => {
      if (!issue.geohash) return false;
      return haversineMeters(submissionPoint, geohashDecodeCenter(issue.geohash)) <= radius;
    });

    if (near.length > 0) {
      embedding = await deps.embeddings.embed(embeddingInput);
      for (const issue of near) {
        if (!issue.embedding) continue;
        const score = cosine(embedding, issue.embedding);
        if (score > bestScore) {
          bestScore = score;
          bestIssue = issue;
        }
      }
    }
  }

  if (bestIssue && bestScore >= env.similarityThreshold) {
    const isNewReporter = !(await deps.store.hasCitizenReportedIssue(
      bestIssue.issue_id,
      submission.citizen_id,
    ));
    const merged = await deps.store.mergeIssue(bestIssue.issue_id, (issue) =>
      mergeSubmissionIntoIssue(issue, submission, {
        embedding: embedding ?? undefined,
        incrementDistinctReporter: isNewReporter,
      }),
    );
    log.info(
      { submissionId: submission.submission_id, issueId: merged.issue_id, score: bestScore },
      "merged submission into existing issue",
    );
    return merged.issue_id;
  }

  // No sufficiently similar existing issue — create a new canonical Issue.
  if (!embedding) embedding = await deps.embeddings.embed(embeddingInput);
  const issueId = `iss_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const newIssue: Issue = {
    issue_id: issueId,
    country_code: submission.country_code,
    state_id: stateId,
    category,
    subcategory: categorization.subcategory,
    canonical_description: categorization.summary,
    embedding: updateRunningEmbedding(null, embedding, 0),
    embedding_model: EMBEDDING_MODEL,
    geo_cluster_id: `gc_${issueId}`,
    admin_region_id: null,
    geohash,
    submission_ids: [submission.submission_id],
    report_count: 1,
    distinct_reporter_count: submission.citizen_id === "anonymous" ? 0 : 1,
    first_reported_at: submission.submitted_at,
    last_reported_at: submission.submitted_at,
    emergency_override: false,
    fraud_flags: [],
    status: "open",
    composite_score: null,
    latest_score_id: null,
  };
  await deps.store.createIssue(newIssue);
  log.info(
    { submissionId: submission.submission_id, issueId, prompt_version: CATEGORIZATION_PROMPT_VERSION },
    "created new issue",
  );
  return issueId;
}

// docs/ARCHITECTURE.md §3 data-flow step 3: "Anti-fraud evaluates the
// new/updated issue, may set fraud_flags." Runs after dedup so it evaluates
// the canonical issue, not a raw submission.
async function evaluateAntiFraud(
  deps: Deps,
  submission: Submission,
  issueId: string,
  log: FastifyBaseLogger,
): Promise<void> {
  // Rule 2 — geofencing: coordinates were provided but fell outside a
  // plausible bounding box for the country. Flag, never reject.
  if (submission.lat !== null && submission.location_confidence === "low") {
    await deps.store.addFraudFlag(issueId, "geofence_mismatch");
    log.info({ issueId, submissionId: submission.submission_id }, "flagged geofence_mismatch");
  }

  // Rule 3 — burst detection: too many submissions from one IP hash in a
  // short window. Flags the *cluster* (the issue), suppressing it from
  // public scoring until an officer reviews — never deletes anything.
  if (submission.submitter_ip_hash) {
    const since = new Date(Date.now() - BURST_WINDOW_MS).toISOString();
    const recentCount = await deps.store.countRecentSubmissionsByIpHash(
      submission.submitter_ip_hash,
      since,
    );
    if (recentCount > BURST_THRESHOLD) {
      await deps.store.addFraudFlag(issueId, "burst_detected");
      log.info({ issueId, recentCount }, "flagged burst_detected");
    }
  }
}
