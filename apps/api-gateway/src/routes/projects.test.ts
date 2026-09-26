import { describe, it, expect } from "vitest";
import type { Citizen, Issue, Project, Submission } from "@pramaan/shared-types";
import { buildApp } from "../app.js";
import { createFakeDeps } from "../testUtils/fakeDeps.js";

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
    admin_region_id: null,
    geohash: null,
    submission_ids: ["sub_1"],
    report_count: 1,
    distinct_reporter_count: 1,
    first_reported_at: "2026-09-10T08:00:00Z",
    last_reported_at: "2026-09-14T18:20:00Z",
    emergency_override: false,
    fraud_flags: [],
    status: "open",
    composite_score: 0.6,
    latest_score_id: null,
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    project_id: "proj_test",
    issue_id: "iss_test",
    country_code: "IN",
    state_id: "UNRESOLVED",
    generated_brief: "Test brief",
    brief_model_version: "template-v1",
    brief_citations: [],
    groundedness_check: { passed: true, unverified_claims: [] },
    composite_score: 0.6,
    status: "recommended",
    assigned_dept: "PWD",
    budget_estimate_inr: 500000,
    marked_complete_at: null,
    officer_signed_off_at: null,
    ...overrides,
  };
}

function makeSubmission(overrides: Partial<Submission> = {}): Submission {
  return {
    submission_id: "sub_1",
    idempotency_key: "idem_1",
    citizen_id: "cit_reporter",
    country_code: "IN",
    channel: "web",
    raw_text: "pothole",
    raw_audio_url: null,
    photo_url: null,
    detected_language: null,
    translated_text: null,
    pii_scrubbed_text: "pothole",
    lat: 28.6,
    lng: 77.2,
    location_text: null,
    location_confidence: "high",
    geohash: "ttnfv2",
    resolved_region_id: null,
    state_id: null,
    issue_id: "iss_test",
    submitted_at: "2026-09-10T08:00:00Z",
    status: "processed",
    processing_error: null,
    submitter_ip_hash: null,
    ...overrides,
  };
}

function makeCitizen(overrides: Partial<Citizen> = {}): Citizen {
  return {
    citizen_id: "cit_reporter",
    phone_hash: "sha256:...",
    preferred_language: "hi-IN",
    country_code: "IN",
    created_at: "2026-01-01T00:00:00Z",
    erasure_requested_at: null,
    ...overrides,
  };
}

// Matches makeIssue()/makeProject()'s default state_id — the jurisdiction check
// resolves to admin_region_id ?? state_id, and these fixtures don't set
// admin_region_id, so "UNRESOLVED" is what an in-jurisdiction officer needs.
function officerHeaders(deps: ReturnType<typeof createFakeDeps>, regionId = "UNRESOLVED", role = "district_collector") {
  deps.tokens.set(`officer-token-${regionId}-${role}`, {
    uid: "officer_1",
    claims: { role, region_id: regionId, country_code: "IN" },
  });
  return { authorization: `Bearer officer-token-${regionId}-${role}` };
}

function citizenHeaders(deps: ReturnType<typeof createFakeDeps>, uid = "cit_reporter") {
  deps.tokens.set(`${uid}-token`, { uid, claims: {} });
  return { authorization: `Bearer ${uid}-token` };
}

describe("POST /projects/:id/mark-complete", () => {
  it("requires an officer token", async () => {
    const deps = createFakeDeps();
    deps.store.projects.set("proj_test", makeProject());
    const app = buildApp(deps);
    const response = await app.inject({ method: "POST", url: "/v1/projects/proj_test/mark-complete" });
    expect(response.statusCode).toBe(401);
  });

  it("marks the project complete and creates an ImpactRecord", async () => {
    const deps = createFakeDeps();
    deps.store.projects.set("proj_test", makeProject());
    deps.store.issues.set("iss_test", makeIssue());
    await deps.store.putSubmission(makeSubmission());
    await deps.store.putCitizen(makeCitizen());

    const app = buildApp(deps);
    const response = await app.inject({
      method: "POST",
      url: "/v1/projects/proj_test/mark-complete",
      headers: officerHeaders(deps),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().notified).toBe(1);
    const project = await deps.store.getProject("proj_test");
    expect(project?.marked_complete_at).toBeTruthy();
    const impact = await deps.store.getImpactRecord("proj_test");
    // One identified reporter: requiring three distinct confirmations could never be met.
    expect(impact?.confirmations_required).toBe(1);
  });

  it("caps required confirmations at 3 when there are more identified reporters", async () => {
    const deps = createFakeDeps();
    deps.store.projects.set("proj_test", makeProject());
    deps.store.issues.set("iss_test", makeIssue());
    for (const [i, uid] of ["a", "b", "c", "d"].entries()) {
      await deps.store.putSubmission(makeSubmission({ submission_id: `sub_${i}`, citizen_id: `cit_${uid}` }));
    }
    const app = buildApp(deps);
    await app.inject({ method: "POST", url: "/v1/projects/proj_test/mark-complete", headers: officerHeaders(deps) });
    expect((await deps.store.getImpactRecord("proj_test"))?.confirmations_required).toBe(3);
  });

  it("returns 403 for a field officer (project actions need district_collector)", async () => {
    const deps = createFakeDeps();
    deps.store.projects.set("proj_test", makeProject());
    deps.store.issues.set("iss_test", makeIssue());
    const app = buildApp(deps);
    const response = await app.inject({
      method: "POST",
      url: "/v1/projects/proj_test/mark-complete",
      headers: officerHeaders(deps, "UNRESOLVED", "field_officer"),
    });
    expect(response.statusCode).toBe(403);
    expect((await deps.store.getProject("proj_test"))?.marked_complete_at).toBeNull();
  });

  it("returns 403 JURISDICTION_MISMATCH for an officer outside the project's region", async () => {
    const deps = createFakeDeps();
    deps.store.projects.set("proj_test", makeProject());
    deps.store.issues.set("iss_test", makeIssue({ admin_region_id: "LGD:ward-1" }));

    const app = buildApp(deps);
    const response = await app.inject({
      method: "POST",
      url: "/v1/projects/proj_test/mark-complete",
      headers: officerHeaders(deps, "LGD:ward-99"),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("JURISDICTION_MISMATCH");
    expect((await deps.store.getProject("proj_test"))?.marked_complete_at).toBeNull();
  });
});

describe("POST /projects/:id/officer-signoff", () => {
  it("returns 403 JURISDICTION_MISMATCH for an officer outside the project's region", async () => {
    const deps = createFakeDeps();
    deps.store.projects.set("proj_test", makeProject());
    deps.store.issues.set("iss_test", makeIssue({ admin_region_id: "LGD:ward-1" }));

    const app = buildApp(deps);
    const response = await app.inject({
      method: "POST",
      url: "/v1/projects/proj_test/officer-signoff",
      headers: officerHeaders(deps, "LGD:ward-99"),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("JURISDICTION_MISMATCH");
    expect((await deps.store.getProject("proj_test"))?.officer_signed_off_at).toBeNull();
  });
});

describe("POST /projects/:id/confirm-resolution", () => {
  async function setupMarkedCompleteProject(deps: ReturnType<typeof createFakeDeps>) {
    deps.store.projects.set("proj_test", makeProject());
    deps.store.issues.set("iss_test", makeIssue());
    await deps.store.putSubmission(makeSubmission());
    await deps.store.putCitizen(makeCitizen());
    const app = buildApp(deps);
    await app.inject({
      method: "POST",
      url: "/v1/projects/proj_test/mark-complete",
      headers: officerHeaders(deps),
    });
    return app;
  }

  it("rejects a citizen who never reported the underlying issue", async () => {
    const deps = createFakeDeps();
    const app = await setupMarkedCompleteProject(deps);

    const response = await app.inject({
      method: "POST",
      url: "/v1/projects/proj_test/confirm-resolution",
      payload: { confirmed: true },
      headers: citizenHeaders(deps, "cit_stranger"),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("NOT_AN_ORIGINAL_REPORTER");
  });

  it("rejects confirmation before the project has been marked complete", async () => {
    const deps = createFakeDeps();
    deps.store.projects.set("proj_test", makeProject());
    deps.store.issues.set("iss_test", makeIssue());
    await deps.store.putSubmission(makeSubmission());
    const app = buildApp(deps);

    const response = await app.inject({
      method: "POST",
      url: "/v1/projects/proj_test/confirm-resolution",
      payload: { confirmed: true },
      headers: citizenHeaders(deps),
    });

    expect(response.statusCode).toBe(409);
  });

  it("does not flip the project to completed with only 2 of 3 required confirmations", async () => {
    const deps = createFakeDeps();
    // Three original reporters so 2 confirmations is genuinely short of 3.
    await deps.store.putSubmission(makeSubmission({ submission_id: "sub_2", citizen_id: "cit_b" }));
    await deps.store.putSubmission(makeSubmission({ submission_id: "sub_3", citizen_id: "cit_c" }));
    deps.store.issues.set(
      "iss_test",
      makeIssue({ submission_ids: ["sub_1", "sub_2", "sub_3"], distinct_reporter_count: 3 }),
    );
    const app = await setupMarkedCompleteProject(deps);
    await deps.store.putCitizen(makeCitizen({ citizen_id: "cit_b" }));

    await app.inject({
      method: "POST",
      url: "/v1/projects/proj_test/confirm-resolution",
      payload: { confirmed: true },
      headers: citizenHeaders(deps, "cit_reporter"),
    });
    await app.inject({
      method: "POST",
      url: "/v1/projects/proj_test/confirm-resolution",
      payload: { confirmed: true },
      headers: citizenHeaders(deps, "cit_b"),
    });
    // Officer signs off too, so confirmation count is the only thing missing.
    await app.inject({
      method: "POST",
      url: "/v1/projects/proj_test/officer-signoff",
      headers: officerHeaders(deps),
    });

    const project = await deps.store.getProject("proj_test");
    expect(project?.status).not.toBe("completed");
  });

  it("counts each reporter once: repeat confirmations are rejected and do not add up", async () => {
    const deps = createFakeDeps();
    for (const [i, uid] of ["cit_b", "cit_c"].entries()) {
      await deps.store.putSubmission(makeSubmission({ submission_id: `sub_x${i}`, citizen_id: uid }));
    }
    const app = await setupMarkedCompleteProject(deps);

    const responses = [];
    for (let i = 0; i < 3; i++) {
      responses.push(
        await app.inject({
          method: "POST",
          url: "/v1/projects/proj_test/confirm-resolution",
          payload: { confirmed: true },
          headers: citizenHeaders(deps, "cit_reporter"),
        }),
      );
    }
    expect(responses.map((r) => r.statusCode)).toEqual([200, 409, 409]);
    expect((await deps.store.getImpactRecord("proj_test"))?.confirmations_received).toBe(1);

    await app.inject({ method: "POST", url: "/v1/projects/proj_test/officer-signoff", headers: officerHeaders(deps) });
    expect((await deps.store.getProject("proj_test"))?.status).not.toBe("completed");
  });

  it("rejects an officer token on the citizen confirmation endpoint", async () => {
    const deps = createFakeDeps();
    const app = await setupMarkedCompleteProject(deps);
    const response = await app.inject({
      method: "POST",
      url: "/v1/projects/proj_test/confirm-resolution",
      payload: { confirmed: true },
      headers: officerHeaders(deps),
    });
    expect(response.statusCode).toBe(403);
  });

  it("rejects a resolution photo that was not uploaded through /media", async () => {
    const deps = createFakeDeps();
    const app = await setupMarkedCompleteProject(deps);
    const response = await app.inject({
      method: "POST",
      url: "/v1/projects/proj_test/confirm-resolution",
      payload: { confirmed: true, photo_url: "gs://someone-elses-bucket/secret.jpg" },
      headers: citizenHeaders(deps),
    });
    expect(response.statusCode).toBe(400);
  });

  it("flips to completed once confirmations reach the threshold AND the officer has signed off", async () => {
    const deps = createFakeDeps();
    const reporters = ["cit_reporter", "cit_b", "cit_c"];
    for (const [i, uid] of reporters.slice(1).entries()) {
      await deps.store.putSubmission(makeSubmission({ submission_id: `sub_y${i}`, citizen_id: uid }));
    }
    const app = await setupMarkedCompleteProject(deps);

    for (const uid of reporters) {
      await app.inject({
        method: "POST",
        url: "/v1/projects/proj_test/confirm-resolution",
        payload: { confirmed: true },
        headers: citizenHeaders(deps, uid),
      });
    }
    expect((await deps.store.getProject("proj_test"))?.status).not.toBe("completed");

    await app.inject({
      method: "POST",
      url: "/v1/projects/proj_test/officer-signoff",
      headers: officerHeaders(deps),
    });

    const project = await deps.store.getProject("proj_test");
    expect(project?.status).toBe("completed");
    const impact = await deps.store.getImpactRecord("proj_test");
    expect(impact?.efficacy).toBe(1);
  });
});
