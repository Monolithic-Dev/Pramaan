import { describe, expect, it } from "vitest";
import type { Issue, Project, Submission } from "@pramaan/shared-types";
import { buildApp } from "../app.js";
import { createFakeDeps } from "../testUtils/fakeDeps.js";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);

async function upload(app: ReturnType<typeof buildApp>, kind: string, type: string, body: Buffer) {
  return app.inject({ method: "POST", url: `/v1/media?kind=${kind}`, headers: { "content-type": type }, payload: body });
}

describe("POST /media", () => {
  it("stores a valid photo and returns its gs:// URL", async () => {
    const deps = createFakeDeps();
    const res = await upload(buildApp(deps), "photo", "image/jpeg", JPEG);
    expect(res.statusCode).toBe(201);
    expect(res.json().url).toMatch(/^gs:\/\//);
    expect(deps.storedMedia).toEqual([{ kind: "photo", contentType: "image/jpeg", bytes: JPEG.length }]);
  });

  it("accepts audio with a codecs suffix", async () => {
    const deps = createFakeDeps();
    const res = await upload(buildApp(deps), "audio", "audio/webm;codecs=opus", Buffer.from("fake-audio"));
    expect(res.statusCode).toBe(201);
    expect(deps.storedMedia[0].contentType).toBe("audio/webm");
  });

  it("rejects an image whose bytes are not an image", async () => {
    const res = await upload(buildApp(createFakeDeps()), "photo", "image/png", Buffer.from("<script>alert(1)</script>"));
    expect(res.statusCode).toBe(415);
  });

  it("rejects a type that does not match the kind, and unknown kinds", async () => {
    const app = buildApp(createFakeDeps());
    expect((await upload(app, "audio", "image/jpeg", JPEG)).statusCode).toBe(415);
    expect((await upload(app, "video", "image/jpeg", JPEG)).statusCode).toBe(400);
  });

  it("rejects an oversized photo", async () => {
    const big = Buffer.alloc(8 * 1024 * 1024 + 1);
    big[0] = 0xff;
    big[1] = 0xd8;
    expect((await upload(buildApp(createFakeDeps()), "photo", "image/jpeg", big)).statusCode).toBe(413);
  });

  it("rate-limits anonymous uploads on their own budget, separate from submissions", async () => {
    const app = buildApp(createFakeDeps());
    for (let i = 0; i < 12; i++) expect((await upload(app, "photo", "image/jpeg", JPEG)).statusCode).toBe(201);
    expect((await upload(app, "photo", "image/jpeg", JPEG)).statusCode).toBe(429);
  });
});

describe("citizen status brief translation", () => {
  it("translates the brief into the citizen's language", async () => {
    const deps = createFakeDeps();
    await deps.store.putCitizen({
      citizen_id: "cit_a", phone_hash: "h", preferred_language: "hi-IN", country_code: "IN",
      created_at: "2026-09-01T00:00:00Z", erasure_requested_at: null,
    });
    deps.store.issues.set("iss_1", {
      issue_id: "iss_1", country_code: "IN", state_id: "IN-DL", category: "roads", subcategory: "p",
      canonical_description: "x", embedding: null, embedding_model: null, geo_cluster_id: "g", admin_region_id: null,
      geohash: null, submission_ids: [], report_count: 2, distinct_reporter_count: 2,
      first_reported_at: "2026-09-01T00:00:00Z", last_reported_at: "2026-09-01T00:00:00Z", emergency_override: false,
      fraud_flags: [], status: "prioritized", composite_score: 0.7, latest_score_id: null,
    } satisfies Issue);
    deps.store.projects.set("p1", { project_id: "p1", issue_id: "iss_1", generated_brief: "14 reports since Sep 10." } as Project);
    await deps.store.putSubmission({
      submission_id: "sub_1", idempotency_key: "k", citizen_id: "cit_a", country_code: "IN", channel: "web",
      raw_text: "t", raw_audio_url: null, photo_url: null, detected_language: null, translated_text: null,
      pii_scrubbed_text: null, lat: null, lng: null, location_text: null, location_confidence: "low", geohash: null,
      resolved_region_id: null, state_id: null, issue_id: "iss_1", submitted_at: "2026-09-01T00:00:00Z",
      status: "processed", processing_error: null, submitter_ip_hash: null,
    } satisfies Submission);
    deps.tokens.set("t", { uid: "cit_a", claims: {} });

    const res = await buildApp(deps).inject({
      method: "GET", url: "/v1/my-reports/sub_1/status", headers: { authorization: "Bearer t" },
    });
    expect(res.json()).toMatchObject({ explanation: "[hi] 14 reports since Sep 10.", explanation_language: "hi" });
  });
});

describe("GET /map/markers", () => {
  it("returns issue markers decoded from geohash, scoped to the officer's jurisdiction", async () => {
    const deps = createFakeDeps();
    deps.store.issues.set("iss_m", {
      issue_id: "iss_m", country_code: "IN", state_id: "IN-DL", category: "roads", subcategory: "p",
      canonical_description: "x", embedding: null, embedding_model: null, geo_cluster_id: "g",
      admin_region_id: "dl-central-delhi", geohash: "ttnfv2", submission_ids: [], report_count: 4,
      distinct_reporter_count: 3, first_reported_at: "2026-09-01T00:00:00Z", last_reported_at: "2026-09-01T00:00:00Z",
      emergency_override: false, fraud_flags: [], status: "open", composite_score: 0.5, latest_score_id: null,
    } satisfies Issue);
    deps.tokens.set("o", { uid: "o1", claims: { role: "district_collector", region_id: "dl-central-delhi", country_code: "IN" } });
    const app = buildApp(deps);
    const headers = { authorization: "Bearer o" };

    const ok = await app.inject({ method: "GET", url: "/v1/map/markers?region=dl-central-delhi", headers });
    expect(ok.statusCode).toBe(200);
    const marker = ok.json().issues[0];
    expect(marker.issue_id).toBe("iss_m");
    expect(marker.lat).toBeGreaterThan(28);
    expect(marker.lat).toBeLessThan(29);

    expect((await app.inject({ method: "GET", url: "/v1/map/markers?region=mh-pune", headers })).statusCode).toBe(403);
    expect((await app.inject({ method: "GET", url: "/v1/map/markers?region=x" })).statusCode).toBe(401);
  });
});
