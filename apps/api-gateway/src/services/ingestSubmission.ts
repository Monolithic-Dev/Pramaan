import { createHash, randomUUID } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import type { ConsentRecord, Submission, SubmissionChannel } from "@jansetu/shared-types";
import { isWithinCountryBoundingBox, scrubPii } from "@jansetu/shared-utils";
import type { Deps } from "../deps.js";
import { newTrackingCode } from "../lib/trackingCode.js";

export interface IngestSubmissionInput {
  channel: SubmissionChannel;
  text?: string | null;
  audio_url?: string | null;
  photo_url?: string | null;
  lat?: number;
  lng?: number;
  location_text?: string | null;
  consent_version: string;
  citizenId: string | undefined;
  idempotencyKey: string;
  /** Language the consent notice was shown in — defaults to English for channels that don't ask. */
  languageShown?: string;
  /** Raw IP from the request — hashed before storage, never persisted as-is
   *  (docs/SECURITY_PRIVACY.md §4). null for webhook channels with no citizen IP. */
  submitterIp?: string | null;
  /** Client-declared country for anonymous submissions (docs/CROSS_BORDER_AND_DPG.md)
   *  — the frontend derives this from the selected language. Ignored (overridden by
   *  the citizen's own record) whenever citizenId resolves to a known Citizen, so an
   *  authenticated request can't spoof its country by lying in the body. */
  countryCode?: string;
}

function hashIp(ip: string): string {
  return `sha256:${createHash("sha256").update(ip).digest("hex")}`;
}

export interface IngestSubmissionResult {
  submission_id: string;
  status: Submission["status"];
  /** Lets a citizen with no account follow the report (GET /public/track/:code). */
  tracking_code?: string | null;
}

function hashRequestBody(input: IngestSubmissionInput): string {
  // The client IP is deliberately excluded: a retry after the phone switches from Wi-Fi to
  // mobile data arrives from a different address but is still the same request, and must
  // replay the original response rather than be rejected as an Idempotency-Key conflict.
  const { submitterIp: _ip, ...payload } = input;
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

// Shared by POST /v1/submissions and the WhatsApp/SMS webhooks (API_SPEC.md §9:
// "calls the same internal ingestion path ... not a parallel implementation").
export async function ingestSubmission(
  deps: Deps,
  input: IngestSubmissionInput,
  log: FastifyBaseLogger,
): Promise<{ result: IngestSubmissionResult; conflict?: true }> {
  const requestHash = hashRequestBody(input);

  // Idempotency-Key replay (docs/EDGE_CASES.md #14): the same key within 24h
  // returns the original response verbatim; the same key with a different
  // payload is a conflict, not a silent overwrite.
  const existing = await deps.store.getIdempotencyRecord(input.idempotencyKey);
  if (existing) {
    if (existing.requestHash !== requestHash) {
      return { result: { submission_id: existing.submissionId, status: "queued" }, conflict: true };
    }
    const original = await deps.store.getSubmission(existing.submissionId);
    return {
      result: {
        submission_id: existing.submissionId,
        status: original?.status ?? "queued",
        tracking_code: original?.tracking_code ?? null,
      },
    };
  }

  const submissionId = `sub_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const hasCoords = input.lat !== undefined && input.lng !== undefined;
  const rawText = input.text ?? null;

  const citizen = input.citizenId ? await deps.store.getCitizen(input.citizenId) : null;
  const countryCode = citizen?.country_code ?? input.countryCode ?? "IN";

  const submission: Submission = {
    submission_id: submissionId,
    idempotency_key: input.idempotencyKey,
    citizen_id: input.citizenId ?? "anonymous",
    country_code: countryCode,
    channel: input.channel,
    raw_text: rawText,
    raw_audio_url: input.audio_url ?? null,
    photo_url: input.photo_url ?? null,
    detected_language: null,
    translated_text: null,
    // Regex-only pass here (cheap, inline); the Gemini pass that catches names/
    // addresses runs later in the worker (docs/phases/phase-3-ingestion.md §3.5).
    pii_scrubbed_text: rawText ? scrubPii(rawText) : null,
    lat: hasCoords ? (input.lat as number) : null,
    lng: hasCoords ? (input.lng as number) : null,
    location_text: hasCoords ? null : (input.location_text ?? null),
    location_confidence: hasCoords
      ? isWithinCountryBoundingBox(countryCode, input.lat as number, input.lng as number)
        ? "high"
        : "low"
      : "low",
    geohash: null,
    resolved_region_id: null,
    state_id: null,
    issue_id: null,
    submitted_at: new Date().toISOString(),
    status: "queued",
    processing_error: null,
    submitter_ip_hash: input.submitterIp ? hashIp(input.submitterIp) : null,
    tracking_code: newTrackingCode(),
  };

  const consent: ConsentRecord = {
    consent_id: `consent_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
    citizen_id: submission.citizen_id,
    purpose: "infrastructure_submission",
    consent_text_version: input.consent_version,
    language_shown: input.languageShown ?? "en",
    granted_at: submission.submitted_at,
    channel: input.channel,
    withdrawn_at: null,
  };

  await deps.store.putSubmission(submission);
  await deps.store.putConsentRecord(consent);
  await deps.store.putIdempotencyRecord(input.idempotencyKey, { submissionId, requestHash });

  // Ingestion latency must be independent of AI pipeline / Pub/Sub health
  // (docs/EDGE_CASES.md #18) — the Firestore write already succeeded, so a
  // publish failure is logged and the submission is marked "deferred", never
  // surfaced to the citizen as a failure.
  try {
    await deps.publisher.publishRawSubmission({ submission_id: submissionId });
  } catch (err) {
    log.error({ err, submissionId }, "failed to publish raw-submission event");
    submission.status = "deferred";
    await deps.store.putSubmission(submission);
  }

  return { result: { submission_id: submissionId, status: submission.status, tracking_code: submission.tracking_code } };
}
