import { describe, it, expect } from "vitest";
import { buildApp } from "../app.js";
import { createFakeDeps } from "../testUtils/fakeDeps.js";

const validPayload = {
  channel: "web" as const,
  text: "sadak me bahut bada gaddha hai",
  lat: 28.6139,
  lng: 77.209,
};

describe("POST /submissions", () => {
  it("with valid text returns 202 and a submission_id", async () => {
    const app = buildApp(createFakeDeps());
    const response = await app.inject({
      method: "POST",
      url: "/v1/submissions",
      payload: validPayload,
    });

    expect(response.statusCode).toBe(202);
    const body = response.json();
    expect(body.submission_id).toMatch(/^sub_/);
    expect(body.status).toBe("queued");
  });

  it("with no text/audio/photo returns 400 VALIDATION_ERROR", async () => {
    const app = buildApp(createFakeDeps());
    const response = await app.inject({
      method: "POST",
      url: "/v1/submissions",
      payload: { channel: "web", lat: 28.6139, lng: 77.209 },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("from a citizen over their hourly limit returns 429", async () => {
    const deps = createFakeDeps();
    const app = buildApp(deps);
    deps.tokens.set("citizen-token", { uid: "cit_test", claims: {} });
    const headers = { authorization: "Bearer citizen-token" };

    let lastResponse;
    for (let i = 0; i < 11; i++) {
      lastResponse = await app.inject({
        method: "POST",
        url: "/v1/submissions",
        payload: validPayload,
        headers,
      });
    }

    expect(lastResponse!.statusCode).toBe(429);
    expect(lastResponse!.json().error.code).toBe("RATE_LIMITED");
  });

  it("with out-of-bounds lat/lng is accepted with location_confidence low", async () => {
    const deps = createFakeDeps();
    const app = buildApp(deps);
    const response = await app.inject({
      method: "POST",
      url: "/v1/submissions",
      payload: { channel: "web", text: "test", lat: 51.5074, lng: -0.1278 },
    });

    expect(response.statusCode).toBe(202);
    const { submission_id } = response.json();
    const stored = await deps.store.getSubmission(submission_id);
    expect(stored?.location_confidence).toBe("low");
  });

  it("publishes a raw-submissions event on success", async () => {
    const deps = createFakeDeps();
    const app = buildApp(deps);
    await app.inject({ method: "POST", url: "/v1/submissions", payload: validPayload });

    expect(deps.publishedMessages).toHaveLength(1);
  });
});

describe("GET /submissions/:submissionId", () => {
  it("returns the submission to its owner", async () => {
    const deps = createFakeDeps();
    const app = buildApp(deps);
    deps.tokens.set("citizen-token", { uid: "cit_test", claims: {} });
    const headers = { authorization: "Bearer citizen-token" };

    const created = await app.inject({
      method: "POST",
      url: "/v1/submissions",
      payload: validPayload,
      headers,
    });
    const { submission_id } = created.json();

    const fetched = await app.inject({
      method: "GET",
      url: `/v1/submissions/${submission_id}`,
      headers,
    });

    expect(fetched.statusCode).toBe(200);
    expect(fetched.json().submission_id).toBe(submission_id);
  });

  it("rejects a non-owner, non-officer caller with 401", async () => {
    const deps = createFakeDeps();
    const app = buildApp(deps);
    deps.tokens.set("owner-token", { uid: "cit_owner", claims: {} });
    deps.tokens.set("other-token", { uid: "cit_other", claims: {} });

    const created = await app.inject({
      method: "POST",
      url: "/v1/submissions",
      payload: validPayload,
      headers: { authorization: "Bearer owner-token" },
    });
    const { submission_id } = created.json();

    const fetched = await app.inject({
      method: "GET",
      url: `/v1/submissions/${submission_id}`,
      headers: { authorization: "Bearer other-token" },
    });

    expect(fetched.statusCode).toBe(401);
  });

  it("returns 404 for a submission that doesn't exist", async () => {
    const app = buildApp(createFakeDeps());
    const response = await app.inject({ method: "GET", url: "/v1/submissions/does-not-exist" });
    expect(response.statusCode).toBe(404);
  });
});
