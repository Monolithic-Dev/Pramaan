import { describe, it, expect } from "vitest";
import type { Issue, PriorityScore } from "@pramaan/shared-types";
import { buildApp } from "../app.js";
import { createFakeDeps } from "../testUtils/fakeDeps.js";

const IN_JURISDICTION_REGION = "LGD:ward-1";
const OUT_OF_JURISDICTION_REGION = "LGD:ward-99";

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    issue_id: "iss_test",
    country_code: "IN",
    state_id: "UNRESOLVED",
    category: "roads",
    subcategory: "pothole",
    canonical_description: "Large pothole",
    embedding: null,
    embedding_model: null,
    geo_cluster_id: "gc_test",
    admin_region_id: IN_JURISDICTION_REGION,
    geohash: null,
    submission_ids: [],
    report_count: 14,
    distinct_reporter_count: 11,
    first_reported_at: "2026-09-10T08:00:00Z",
    last_reported_at: "2026-09-14T18:20:00Z",
    emergency_override: false,
    fraud_flags: [],
    status: "open",
    composite_score: 0.628,
    latest_score_id: "score_1",
    ...overrides,
  };
}

function makeScore(overrides: Partial<PriorityScore> = {}): PriorityScore {
  return {
    score_id: "score_1",
    issue_id: "iss_test",
    country_code: "IN",
    state_id: "UNRESOLVED",
    demand_score: 0.71,
    vulnerability_score: 0.55,
    gap_score: 0.63,
    duplication_penalty: 0.1,
    impact_efficacy: null,
    base_score: 0.638,
    composite_score: 0.628,
    weights: { demand: 0.4, vulnerability: 0.3, gap: 0.3 },
    data_fallbacks: [],
    model_version: "formula-v1",
    computed_at: "2026-09-15T02:00:00Z",
    is_canonical: true,
    estimated_impact_population: 3200,
    ...overrides,
  };
}

function officerHeaders(
  deps: ReturnType<typeof createFakeDeps>,
  role: string,
  regionId: string,
  token = "officer-token",
) {
  deps.tokens.set(token, { uid: "officer_1", claims: { role, region_id: regionId, country_code: "IN" } });
  return { authorization: `Bearer ${token}` };
}

describe("GET /issues/:issueId/score", () => {
  it("requires an officer token", async () => {
    const deps = createFakeDeps();
    deps.store.issues.set("iss_test", makeIssue());
    deps.store.priorityScores.set("score_1", makeScore());

    const app = buildApp(deps);
    const response = await app.inject({ method: "GET", url: "/v1/issues/iss_test/score" });

    expect(response.statusCode).toBe(401);
  });

  it("returns every component and the weights used, for an officer in jurisdiction", async () => {
    const deps = createFakeDeps();
    deps.store.issues.set("iss_test", makeIssue());
    deps.store.priorityScores.set("score_1", makeScore());

    const app = buildApp(deps);
    const response = await app.inject({
      method: "GET",
      url: "/v1/issues/iss_test/score",
      headers: officerHeaders(deps, "field_officer", IN_JURISDICTION_REGION),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.weights).toEqual({ demand: 0.4, vulnerability: 0.3, gap: 0.3 });
    expect(body.composite_score).toBeCloseTo(0.628, 3);
  });

  it("returns 403 JURISDICTION_MISMATCH for an officer outside the issue's region", async () => {
    const deps = createFakeDeps();
    deps.store.issues.set("iss_test", makeIssue());
    deps.store.priorityScores.set("score_1", makeScore());

    const app = buildApp(deps);
    const response = await app.inject({
      method: "GET",
      url: "/v1/issues/iss_test/score",
      headers: officerHeaders(deps, "field_officer", OUT_OF_JURISDICTION_REGION),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("JURISDICTION_MISMATCH");
  });

  it("returns 404 for an issue that hasn't been scored yet", async () => {
    const deps = createFakeDeps();
    deps.store.issues.set("never-scored", makeIssue({ issue_id: "never-scored" }));
    const app = buildApp(deps);
    const response = await app.inject({
      method: "GET",
      url: "/v1/issues/never-scored/score",
      headers: officerHeaders(deps, "field_officer", IN_JURISDICTION_REGION),
    });
    expect(response.statusCode).toBe(404);
  });

  it("returns 404 for an issue that doesn't exist", async () => {
    const deps = createFakeDeps();
    const app = buildApp(deps);
    const response = await app.inject({
      method: "GET",
      url: "/v1/issues/does-not-exist/score",
      headers: officerHeaders(deps, "field_officer", IN_JURISDICTION_REGION),
    });
    expect(response.statusCode).toBe(404);
  });

  it("never returns a non-canonical (simulated) score", async () => {
    const deps = createFakeDeps();
    deps.store.issues.set("iss_test", makeIssue());
    deps.store.priorityScores.set("sim_1", makeScore({ score_id: "sim_1", is_canonical: false }));

    const app = buildApp(deps);
    const response = await app.inject({
      method: "GET",
      url: "/v1/issues/iss_test/score",
      headers: officerHeaders(deps, "field_officer", IN_JURISDICTION_REGION),
    });

    expect(response.statusCode).toBe(404);
  });
});

describe("POST /issues/:issueId/emergency-override", () => {
  it("requires an officer token", async () => {
    const deps = createFakeDeps();
    deps.store.issues.set("iss_test", makeIssue());

    const app = buildApp(deps);
    const response = await app.inject({
      method: "POST",
      url: "/v1/issues/iss_test/emergency-override",
      payload: { enabled: true, justification: "Bridge collapse reported" },
    });

    expect(response.statusCode).toBe(401);
  });

  it("returns 403 for a field_officer (below the required role >= district_collector)", async () => {
    const deps = createFakeDeps();
    deps.store.issues.set("iss_test", makeIssue());

    const app = buildApp(deps);
    const response = await app.inject({
      method: "POST",
      url: "/v1/issues/iss_test/emergency-override",
      payload: { enabled: true, justification: "Bridge collapse reported" },
      headers: officerHeaders(deps, "field_officer", IN_JURISDICTION_REGION),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("FORBIDDEN");
  });

  it("returns 403 JURISDICTION_MISMATCH for a district_collector outside the issue's region", async () => {
    const deps = createFakeDeps();
    deps.store.issues.set("iss_test", makeIssue());

    const app = buildApp(deps);
    const response = await app.inject({
      method: "POST",
      url: "/v1/issues/iss_test/emergency-override",
      payload: { enabled: true, justification: "Bridge collapse reported" },
      headers: officerHeaders(deps, "district_collector", OUT_OF_JURISDICTION_REGION),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("JURISDICTION_MISMATCH");
  });

  it("sets emergency_override and writes an audit log entry", async () => {
    const deps = createFakeDeps();
    deps.store.issues.set("iss_test", makeIssue({ emergency_override: false }));

    const app = buildApp(deps);
    const response = await app.inject({
      method: "POST",
      url: "/v1/issues/iss_test/emergency-override",
      payload: { enabled: true, justification: "Bridge collapse reported, 40+ submissions in 20 min" },
      headers: officerHeaders(deps, "district_collector", IN_JURISDICTION_REGION),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().emergency_override).toBe(true);
    expect(deps.store.issues.get("iss_test")?.emergency_override).toBe(true);
    expect(deps.store.auditLog).toHaveLength(1);
    expect(deps.store.auditLog[0]).toMatchObject({
      action: "emergency_override",
      actor_id: "officer_1",
      justification: "Bridge collapse reported, 40+ submissions in 20 min",
    });
  });

  it("returns 400 without a justification", async () => {
    const deps = createFakeDeps();
    deps.store.issues.set("iss_test", makeIssue());

    const app = buildApp(deps);
    const response = await app.inject({
      method: "POST",
      url: "/v1/issues/iss_test/emergency-override",
      payload: { enabled: true },
      headers: officerHeaders(deps, "district_collector", IN_JURISDICTION_REGION),
    });

    expect(response.statusCode).toBe(400);
  });
});
