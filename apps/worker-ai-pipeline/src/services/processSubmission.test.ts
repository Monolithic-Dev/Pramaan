import { describe, expect, it } from "vitest";
import pino from "pino";
import type { CategorizationResult } from "@jansetu/ai-prompts";
import type { Submission } from "@jansetu/shared-types";
import { createFakeDeps } from "../testUtils/fakeDeps.js";
import { processSubmission } from "./processSubmission.js";

const log = pino({ level: "silent" });

let counter = 0;
function makeSubmission(overrides: Partial<Submission> = {}): Submission {
  counter += 1;
  return {
    submission_id: `sub_test_${counter}`,
    idempotency_key: `idem_${counter}`,
    citizen_id: `cit_${counter}`,
    country_code: "IN",
    channel: "web",
    raw_text: "large pothole near the market",
    raw_audio_url: null,
    photo_url: null,
    detected_language: null,
    translated_text: null,
    pii_scrubbed_text: "large pothole near the market",
    lat: 28.6139,
    lng: 77.209,
    location_text: null,
    location_confidence: "high",
    geohash: null,
    resolved_region_id: null,
    state_id: null,
    issue_id: null,
    submitted_at: new Date().toISOString(),
    status: "queued",
    processing_error: null,
    ...overrides,
  };
}

const goodCategorization: CategorizationResult = {
  category: "roads",
  subcategory: "pothole",
  severity_estimate: "high",
  extracted_location_text: null,
  summary: "large pothole near the market",
  confidence: 0.9,
  contains_personal_emergency: false,
};

describe("processSubmission", () => {
  it("flags a submission with no extractable text", async () => {
    const deps = createFakeDeps();
    const sub = makeSubmission({ raw_text: null, pii_scrubbed_text: null, translated_text: null });
    await deps.store.putSubmission(sub);

    await processSubmission(deps, sub.submission_id, log);

    const stored = await deps.store.getSubmission(sub.submission_id);
    expect(stored?.status).toBe("flagged");
    expect(stored?.processing_error).toBe("no_text_available_for_categorization");
  });

  it("flags and routes out a submission containing a personal emergency", async () => {
    const deps = createFakeDeps();
    const sub = makeSubmission();
    await deps.store.putSubmission(sub);
    deps.nextCategorizations.push({ ...goodCategorization, contains_personal_emergency: true });

    await processSubmission(deps, sub.submission_id, log);

    const stored = await deps.store.getSubmission(sub.submission_id);
    expect(stored?.status).toBe("flagged");
    expect(stored?.processing_error).toBe("personal_emergency_detected");
    expect(stored?.issue_id).toBeNull();
  });

  it("flags a low-confidence extraction for officer review instead of creating an issue", async () => {
    const deps = createFakeDeps();
    const sub = makeSubmission();
    await deps.store.putSubmission(sub);
    deps.nextCategorizations.push({ ...goodCategorization, confidence: 0.3 });

    await processSubmission(deps, sub.submission_id, log);

    const stored = await deps.store.getSubmission(sub.submission_id);
    expect(stored?.status).toBe("flagged");
    expect(stored?.issue_id).toBeNull();
  });

  it("falls back to raw-text-only categorization when Gemini output is malformed twice, never dropping the submission", async () => {
    const deps = createFakeDeps();
    const sub = makeSubmission();
    await deps.store.putSubmission(sub);
    deps.nextCategorizations.push(null, null); // both attempts malformed

    await processSubmission(deps, sub.submission_id, log);

    const stored = await deps.store.getSubmission(sub.submission_id);
    expect(stored?.status).toBe("processed");
    expect(stored?.issue_id).toMatch(/^iss_/);
  });

  it("creates a new issue when no similar candidate exists nearby", async () => {
    const deps = createFakeDeps();
    const sub = makeSubmission();
    await deps.store.putSubmission(sub);
    deps.nextCategorizations.push(goodCategorization);

    await processSubmission(deps, sub.submission_id, log);

    const stored = await deps.store.getSubmission(sub.submission_id);
    expect(stored?.status).toBe("processed");
    expect(stored?.issue_id).toMatch(/^iss_/);
  });

  it("merges two submissions from different citizens with a similar embedding into one issue", async () => {
    const deps = createFakeDeps();
    const sameEmbedding = [1, 0, 0, 0, 0, 0, 0, 0];
    deps.embeddingsByText.set("large pothole near the market", sameEmbedding);

    const first = makeSubmission({ citizen_id: "cit_a" });
    await deps.store.putSubmission(first);
    deps.nextCategorizations.push(goodCategorization);
    await processSubmission(deps, first.submission_id, log);

    const second = makeSubmission({ citizen_id: "cit_b" });
    await deps.store.putSubmission(second);
    deps.nextCategorizations.push(goodCategorization);
    await processSubmission(deps, second.submission_id, log);

    const firstStored = await deps.store.getSubmission(first.submission_id);
    const secondStored = await deps.store.getSubmission(second.submission_id);
    expect(secondStored?.issue_id).toBe(firstStored?.issue_id);
  });

  it("keeps two genuinely different issues separate when embeddings aren't similar", async () => {
    const deps = createFakeDeps();
    const first = makeSubmission({ raw_text: "pothole", pii_scrubbed_text: "pothole" });
    deps.embeddingsByText.set("large pothole near the market", [1, 0, 0, 0, 0, 0, 0, 0]);
    await deps.store.putSubmission(first);
    deps.nextCategorizations.push(goodCategorization);
    await processSubmission(deps, first.submission_id, log);

    const second = makeSubmission({ raw_text: "streetlight out", pii_scrubbed_text: "streetlight out" });
    deps.embeddingsByText.set("streetlight is broken", [0, 1, 0, 0, 0, 0, 0, 0]);
    await deps.store.putSubmission(second);
    deps.nextCategorizations.push({
      ...goodCategorization,
      category: "electricity",
      subcategory: "streetlight",
      summary: "streetlight is broken",
    });
    await processSubmission(deps, second.submission_id, log);

    const firstStored = await deps.store.getSubmission(first.submission_id);
    const secondStored = await deps.store.getSubmission(second.submission_id);
    expect(secondStored?.issue_id).not.toBe(firstStored?.issue_id);
  });

  it("merges same-citizen duplicates without incrementing distinct_reporter_count", async () => {
    const deps = createFakeDeps();
    const citizenId = "cit_same";

    const first = makeSubmission({ citizen_id: citizenId });
    await deps.store.putSubmission(first);
    deps.nextCategorizations.push(goodCategorization);
    await processSubmission(deps, first.submission_id, log);
    const firstStored = await deps.store.getSubmission(first.submission_id);

    const second = makeSubmission({ citizen_id: citizenId });
    await deps.store.putSubmission(second);
    deps.nextCategorizations.push(goodCategorization);
    await processSubmission(deps, second.submission_id, log);
    const secondStored = await deps.store.getSubmission(second.submission_id);

    expect(secondStored?.issue_id).toBe(firstStored?.issue_id);
    const merged = await deps.store.getIssue(firstStored!.issue_id!);
    expect(merged?.report_count).toBe(2);
    expect(merged?.distinct_reporter_count).toBe(1);
  });

  it("is idempotent: reprocessing an already-processed submission is a no-op", async () => {
    const deps = createFakeDeps();
    const sub = makeSubmission();
    await deps.store.putSubmission(sub);
    deps.nextCategorizations.push(goodCategorization);
    await processSubmission(deps, sub.submission_id, log);
    const afterFirst = await deps.store.getSubmission(sub.submission_id);

    // No categorization queued for a second run — if it were re-processed,
    // the fake categorize() would throw.
    await processSubmission(deps, sub.submission_id, log);
    const afterSecond = await deps.store.getSubmission(sub.submission_id);

    expect(afterSecond).toEqual(afterFirst);
  });
});
