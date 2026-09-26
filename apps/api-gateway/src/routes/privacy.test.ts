import { describe, it, expect } from "vitest";
import type { Citizen, ConsentRecord, Issue, Submission } from "@pramaan/shared-types";
import { buildApp } from "../app.js";
import { createFakeDeps } from "../testUtils/fakeDeps.js";

function makeSubmission(overrides: Partial<Submission> = {}): Submission {
  return {
    submission_id: "sub_1",
    idempotency_key: "idem_1",
    citizen_id: "cit_1",
    country_code: "IN",
    channel: "web",
    raw_text: "pothole near my house",
    raw_audio_url: null,
    photo_url: "https://example.com/photo.jpg",
    detected_language: "hi",
    translated_text: "pothole near my house",
    pii_scrubbed_text: "pothole near my house",
    lat: 28.6,
    lng: 77.2,
    location_text: null,
    location_confidence: "high",
    geohash: "ttnfv2",
    resolved_region_id: null,
    state_id: null,
    issue_id: "iss_1",
    submitted_at: "2026-09-10T08:00:00Z",
    status: "processed",
    processing_error: null,
    submitter_ip_hash: "sha256:abc",
    ...overrides,
  };
}

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    issue_id: "iss_1",
    country_code: "IN",
    state_id: "UNRESOLVED",
    category: "roads",
    subcategory: "pothole",
    canonical_description: "pothole",
    embedding: null,
    embedding_model: null,
    geo_cluster_id: "gc_1",
    admin_region_id: null,
    geohash: "ttnfv2",
    submission_ids: ["sub_1"],
    report_count: 1,
    distinct_reporter_count: 1,
    first_reported_at: "2026-09-10T08:00:00Z",
    last_reported_at: "2026-09-10T08:00:00Z",
    emergency_override: false,
    fraud_flags: [],
    status: "open",
    composite_score: null,
    latest_score_id: null,
    ...overrides,
  };
}

function citizenHeaders(deps: ReturnType<typeof createFakeDeps>, uid = "cit_1") {
  deps.tokens.set(`${uid}-token`, { uid, claims: {} });
  return { authorization: `Bearer ${uid}-token` };
}

describe("POST /privacy/erasure-requests", () => {
  it("nulls content fields, tombstones the submission, and unlinks the citizen", async () => {
    const deps = createFakeDeps();
    await deps.store.putSubmission(makeSubmission());
    deps.store.issues.set("iss_1", makeIssue()); // sole-source

    const app = buildApp(deps);
    const response = await app.inject({
      method: "POST",
      url: "/v1/privacy/erasure-requests",
      payload: { scope: "all_submissions" },
      headers: citizenHeaders(deps),
    });

    expect(response.statusCode).toBe(202);
    expect(response.json().sla_days).toBe(30);

    const submission = await deps.store.getSubmission("sub_1");
    expect(submission?.status).toBe("tombstoned");
    expect(submission?.citizen_id).toBe("erased");
    expect(submission?.raw_text).toBeNull();
    expect(submission?.lat).toBeNull();
  });

  it("tombstones a sole-source issue but preserves report_count", async () => {
    const deps = createFakeDeps();
    await deps.store.putSubmission(makeSubmission());
    deps.store.issues.set("iss_1", makeIssue({ report_count: 1 }));

    const app = buildApp(deps);
    await app.inject({
      method: "POST",
      url: "/v1/privacy/erasure-requests",
      payload: { scope: "all_submissions" },
      headers: citizenHeaders(deps),
    });

    const issue = await deps.store.getIssue("iss_1");
    expect(issue?.status).toBe("tombstoned");
    expect(issue?.report_count).toBe(1); // never decremented
  });

  it("does not tombstone an issue that has other, still-live sources", async () => {
    const deps = createFakeDeps();
    await deps.store.putSubmission(makeSubmission());
    deps.store.issues.set("iss_1", makeIssue({ submission_ids: ["sub_1", "sub_2"], report_count: 2 }));

    const app = buildApp(deps);
    await app.inject({
      method: "POST",
      url: "/v1/privacy/erasure-requests",
      payload: { scope: "all_submissions" },
      headers: citizenHeaders(deps),
    });

    const issue = await deps.store.getIssue("iss_1");
    expect(issue?.status).not.toBe("tombstoned");
  });

  it("requires authentication", async () => {
    const app = buildApp(createFakeDeps());
    const response = await app.inject({
      method: "POST",
      url: "/v1/privacy/erasure-requests",
      payload: { scope: "all_submissions" },
    });
    expect(response.statusCode).toBe(401);
  });
});

describe("GET /privacy/my-data", () => {
  it("returns the citizen, their submissions, and their consent records", async () => {
    const deps = createFakeDeps();
    const citizen: Citizen = {
      citizen_id: "cit_1",
      phone_hash: "sha256:...",
      preferred_language: "hi-IN",
      country_code: "IN",
      created_at: "2026-01-01T00:00:00Z",
      erasure_requested_at: null,
    };
    await deps.store.putCitizen(citizen);
    await deps.store.putSubmission(makeSubmission());
    const consent: ConsentRecord = {
      consent_id: "consent_1",
      citizen_id: "cit_1",
      purpose: "infrastructure_submission",
      consent_text_version: "dpdp-notice-v1",
      language_shown: "hi",
      granted_at: "2026-09-10T08:00:00Z",
      channel: "web",
      withdrawn_at: null,
    };
    await deps.store.putConsentRecord(consent);

    const app = buildApp(deps);
    const response = await app.inject({
      method: "GET",
      url: "/v1/privacy/my-data",
      headers: citizenHeaders(deps),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.citizen.citizen_id).toBe("cit_1");
    expect(body.submissions).toHaveLength(1);
    expect(body.consent_records).toHaveLength(1);
  });

  it("requires authentication", async () => {
    const app = buildApp(createFakeDeps());
    const response = await app.inject({ method: "GET", url: "/v1/privacy/my-data" });
    expect(response.statusCode).toBe(401);
  });
});
