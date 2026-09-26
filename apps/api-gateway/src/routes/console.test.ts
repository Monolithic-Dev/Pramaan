import { describe, expect, it } from "vitest";
import type { Issue, PriorityScore, Submission } from "@jansetu/shared-types";
import { buildApp } from "../app.js";
import { createFakeDeps } from "../testUtils/fakeDeps.js";

type Deps = ReturnType<typeof createFakeDeps>;

let n = 0;
function issue(over: Partial<Issue> = {}): Issue {
  n += 1;
  return {
    issue_id: `iss_c${n}`, country_code: "IN", state_id: "IN-DL", category: "roads", subcategory: "pothole",
    canonical_description: "Large pothole near the market", embedding: [0.1], embedding_model: "m", geo_cluster_id: "g",
    admin_region_id: "dl-central", geohash: "ttnfvr", centroid_lat: 28.65, centroid_lng: 77.23, submission_ids: ["s1"],
    report_count: 6, distinct_reporter_count: 4, first_reported_at: new Date().toISOString(),
    last_reported_at: new Date().toISOString(), emergency_override: false, fraud_flags: [], status: "open",
    composite_score: 0.7, latest_score_id: "sc", ...over,
  };
}

function score(issueId: string): PriorityScore {
  return {
    score_id: `sc_${issueId}`, issue_id: issueId, country_code: "IN", state_id: "IN-DL", demand_score: 0.8,
    vulnerability_score: 0.5, gap_score: 0.6, duplication_penalty: 0, impact_efficacy: null, base_score: 0.7,
    composite_score: 0.7, weights: { demand: 0.4, vulnerability: 0.3, gap: 0.3 }, data_fallbacks: [],
    model_version: "formula-v2", computed_at: "2026-09-01T00:00:00Z", is_canonical: true, estimated_impact_population: 1000,
  };
}

function setup() {
  const deps = createFakeDeps();
  deps.regions.push(
    { regionId: "IN-DL", name: "Delhi", level: "state", parentRegionId: null, countryCode: "IN", population: 1, lat: 28.7, lng: 77.1 },
    { regionId: "dl-central", name: "Central Delhi", level: "district", parentRegionId: "IN-DL", countryCode: "IN", population: 1, lat: 28.65, lng: 77.23 },
    { regionId: "mh-pune", name: "Pune", level: "district", parentRegionId: "IN-MH", countryCode: "IN", population: 1, lat: 18.5, lng: 73.8 },
  );
  deps.ancestryByRegion.set("IN-DL", [{ regionId: "IN-DL", level: "state" }]);
  deps.ancestryByRegion.set("dl-central", [{ regionId: "dl-central", level: "district" }, { regionId: "IN-DL", level: "state" }]);
  deps.ancestryByRegion.set("mh-pune", [{ regionId: "mh-pune", level: "district" }, { regionId: "IN-MH", level: "state" }]);
  const tok = (name: string, role: string, region: string) => {
    deps.tokens.set(name, { uid: `u_${name}`, claims: { role, region_id: region, country_code: "IN" } });
    return { authorization: `Bearer ${name}` };
  };
  return {
    deps,
    app: buildApp(deps),
    admin: tok("admin", "state_admin", "IN-DL"),
    collector: tok("collector", "district_collector", "dl-central"),
    field: tok("field", "field_officer", "dl-central"),
    pune: tok("pune", "district_collector", "mh-pune"),
  };
}

const put = (deps: Deps, i: Issue) => {
  deps.store.issues.set(i.issue_id, i);
  deps.store.priorityScores.set(`sc_${i.issue_id}`, score(i.issue_id));
  return i;
};

describe("GET /me", () => {
  it("returns the resolved permission set for each role (the UI builds its menu from this)", async () => {
    const { app, admin, field, deps } = setup();
    const a = (await app.inject({ method: "GET", url: "/v1/me", headers: admin })).json();
    expect(a.permissions).toMatchObject({ view_console: true, update_issue_status: true, manage_officers: true, view_equity: true });
    const f = (await app.inject({ method: "GET", url: "/v1/me", headers: field })).json();
    expect(f.permissions).toMatchObject({ view_console: true, update_issue_status: false, manage_officers: false, view_equity: false });

    deps.tokens.set("cit", { uid: "cit_1", claims: {} });
    const c = (await app.inject({ method: "GET", url: "/v1/me", headers: { authorization: "Bearer cit" } })).json();
    expect(c.kind).toBe("citizen");
    expect(Object.values(c.permissions).every((v) => v === false)).toBe(true);
  });
});

describe("citizen session and my reports", () => {
  it("creates a citizen record on first sign-in and lists only their own reports", async () => {
    const { app, deps } = setup();
    deps.tokens.set("cit", { uid: "cit_1", claims: {} });
    const headers = { authorization: "Bearer cit" };
    const made = await app.inject({ method: "POST", url: "/v1/auth/session", headers, payload: { country_code: "BR" } });
    expect(made.json().citizen).toMatchObject({ citizen_id: "cit_1", country_code: "BR", preferred_language: "pt-BR" });

    const i = put(deps, issue({ status: "prioritized" }));
    const mine = (id: string, who: string): Submission => ({
      submission_id: id, idempotency_key: id, citizen_id: who, country_code: "IN", channel: "web", raw_text: `text ${id}`,
      raw_audio_url: null, photo_url: null, detected_language: null, translated_text: null, pii_scrubbed_text: null,
      lat: null, lng: null, location_text: null, location_confidence: "high", geohash: null, resolved_region_id: null,
      state_id: null, issue_id: i.issue_id, submitted_at: "2026-09-01T00:00:00Z", status: "processed",
      processing_error: null, submitter_ip_hash: null,
    });
    await deps.store.putSubmission(mine("s_mine", "cit_1"));
    await deps.store.putSubmission(mine("s_other", "cit_2"));

    const res = (await app.inject({ method: "GET", url: "/v1/my-reports", headers })).json();
    expect(res.reports.map((r: { submission_id: string }) => r.submission_id)).toEqual(["s_mine"]);
    expect(res.reports[0]).toMatchObject({ issue_status: "prioritized", priority: "high", other_reporters: 3 });
    expect(await app.inject({ method: "GET", url: "/v1/my-reports" })).toHaveProperty("statusCode", 401);
  });
});

describe("issue list and detail", () => {
  it("scopes by jurisdiction, filters, sorts, and never leaks embeddings or reporter identity", async () => {
    const { app, deps, admin, collector, pune } = setup();
    put(deps, issue({ issue_id: "iss_a", composite_score: 0.9, category: "water" }));
    put(deps, issue({ issue_id: "iss_b", composite_score: 0.4, category: "roads" }));
    put(deps, issue({ issue_id: "iss_far", state_id: "IN-MH", admin_region_id: "mh-pune" }));

    const list = (await app.inject({ method: "GET", url: "/v1/issues", headers: admin })).json();
    expect(list.issues.map((i: { issue_id: string }) => i.issue_id)).toEqual(["iss_a", "iss_b"]);
    expect(list.issues[0]).toMatchObject({ region_name: "Central Delhi", priority: "high" });
    expect(JSON.stringify(list)).not.toContain("embedding");

    const water = (await app.inject({ method: "GET", url: "/v1/issues?category=water", headers: collector })).json();
    expect(water.issues).toHaveLength(1);
    expect((await app.inject({ method: "GET", url: "/v1/issues?region=mh-pune", headers: collector })).statusCode).toBe(403);
    expect((await app.inject({ method: "GET", url: "/v1/issues", headers: pune })).json().issues).toHaveLength(1);

    const detail = await app.inject({ method: "GET", url: "/v1/issues/iss_a", headers: collector });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().score.composite_score).toBe(0.7);
    expect(JSON.stringify(detail.json())).not.toMatch(/"embedding"|citizen_id/);
    expect((await app.inject({ method: "GET", url: "/v1/issues/iss_far", headers: collector })).statusCode).toBe(403);
  });
});

describe("issue workflow RBAC", () => {
  it("lets a collector change status (audit-logged) but not a field officer, and never across jurisdictions", async () => {
    const { app, deps, collector, field, pune } = setup();
    put(deps, issue({ issue_id: "iss_w" }));
    const url = "/v1/issues/iss_w/status";
    const payload = { status: "verified", justification: "Verified on site visit" };

    expect((await app.inject({ method: "POST", url, headers: field, payload })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url, headers: pune, payload })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url, headers: collector, payload: { status: "verified" } })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url, headers: collector, payload: { status: "resolved", justification: "trying to skip the loop" } })).statusCode).toBe(400);

    const ok = await app.inject({ method: "POST", url, headers: collector, payload });
    expect(ok.statusCode).toBe(200);
    expect(deps.store.issues.get("iss_w")?.status).toBe("verified");
    expect(deps.store.auditLog.at(-1)).toMatchObject({ action: "issue_status_change", target_id: "iss_w", justification: "Verified on site visit" });
  });

  it("recommends a project once, only for a scored issue, and lets a collector fund it", async () => {
    const { app, deps, collector, field } = setup();
    put(deps, issue({ issue_id: "iss_p", category: "water" }));
    deps.store.issues.set("iss_unscored", issue({ issue_id: "iss_unscored" }));

    expect((await app.inject({ method: "POST", url: "/v1/issues/iss_p/project", headers: field })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: "/v1/issues/iss_unscored/project", headers: collector })).statusCode).toBe(409);

    const made = await app.inject({ method: "POST", url: "/v1/issues/iss_p/project", headers: collector });
    expect(made.statusCode).toBe(201);
    const project = made.json();
    expect(project).toMatchObject({ status: "recommended", assigned_dept: "Water Supply & Sewerage Board" });
    expect(project.groundedness_check.passed).toBe(true);
    expect(deps.store.issues.get("iss_p")?.status).toBe("prioritized");
    expect((await app.inject({ method: "POST", url: "/v1/issues/iss_p/project", headers: collector })).statusCode).toBe(409);

    const funded = await app.inject({ method: "POST", url: `/v1/projects/${project.project_id}/status`, headers: collector, payload: { status: "funded" } });
    expect(funded.statusCode).toBe(200);
    expect(deps.store.issues.get("iss_p")?.status).toBe("funded");
    const list = (await app.inject({ method: "GET", url: "/v1/projects", headers: collector })).json();
    expect(list.projects[0]).toMatchObject({ project_id: project.project_id, status: "funded" });
  });
});

describe("analytics", () => {
  it("aggregates the same issues the list shows", async () => {
    const { app, deps, admin } = setup();
    put(deps, issue({ category: "roads", status: "open" }));
    put(deps, issue({ category: "roads", status: "resolved", composite_score: 0.3 }));
    put(deps, issue({ category: "water", status: "funded", is_synthetic: true }));
    const o = (await app.inject({ method: "GET", url: "/v1/analytics/overview", headers: admin })).json();
    expect(o.totals).toMatchObject({ issues: 3, resolved: 1, resolution_rate: 33, sample_data: true });
    expect(o.by_category[0]).toMatchObject({ category: "roads", issues: 2 });
    expect(o.by_status.find((s: { status: string }) => s.status === "funded").count).toBe(1);
    expect(o.trend_daily).toHaveLength(30);
    expect(o.top_regions[0].name).toBe("Central Delhi");
  });
});

describe("officer accounts (state_admin only)", () => {
  it("creates, lists and disables officers within jurisdiction; refuses others", async () => {
    const { app, deps, admin, collector } = setup();
    const payload = { email: "new@gov.in", password: "long-enough-pass", role: "field_officer", region_id: "dl-central" };

    expect((await app.inject({ method: "POST", url: "/v1/admin/officers", headers: collector, payload })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: "/v1/admin/officers", headers: admin, payload: { ...payload, password: "short" } })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: "/v1/admin/officers", headers: admin, payload: { ...payload, region_id: "mh-pune" } })).statusCode).toBe(403);

    const made = await app.inject({ method: "POST", url: "/v1/admin/officers", headers: admin, payload });
    expect(made.statusCode).toBe(201);
    expect((await app.inject({ method: "POST", url: "/v1/admin/officers", headers: admin, payload })).statusCode).toBe(409);
    expect((await app.inject({ method: "GET", url: "/v1/admin/officers", headers: admin })).json().officers).toHaveLength(1);

    const off = await app.inject({ method: "POST", url: `/v1/admin/officers/${made.json().uid}/disabled`, headers: admin, payload: { disabled: true } });
    expect(off.json().disabled).toBe(true);
    expect(deps.store.auditLog.map((a) => a.action)).toEqual(expect.arrayContaining(["officer_created", "officer_disabled"]));
    expect((await app.inject({ method: "GET", url: "/v1/admin/audit", headers: collector })).statusCode).toBe(403);
    expect((await app.inject({ method: "GET", url: "/v1/admin/audit", headers: admin })).json().entries.length).toBeGreaterThan(0);
  });

  it("shows a state admin only the audit trail for their own jurisdiction", async () => {
    const { app, deps, admin } = setup();
    put(deps, issue({ issue_id: "iss_home" }));
    put(deps, issue({ issue_id: "iss_away", state_id: "IN-MH", admin_region_id: "mh-pune" }));
    const entry = (target: string, actor: string) => ({
      audit_id: `a_${target}`, actor_id: actor, action: "issue_status_change", target_id: target,
      before: null, after: null, justification: null, timestamp: "2026-09-01T00:00:00Z",
    });
    await deps.store.putAuditLogEntry(entry("iss_home", "u_someone"));
    await deps.store.putAuditLogEntry(entry("iss_away", "u_pune_officer"));

    const targets = (await app.inject({ method: "GET", url: "/v1/admin/audit", headers: admin }))
      .json()
      .entries.map((e: { target_id: string }) => e.target_id);
    expect(targets).toContain("iss_home");
    expect(targets).not.toContain("iss_away");
  });
});

describe("public endpoints", () => {
  it("withholds aggregate numbers until there are enough issues, and lists regions without login", async () => {
    const { app, deps } = setup();
    for (let i = 0; i < 4; i++) put(deps, issue());
    expect((await app.inject({ method: "GET", url: "/v1/public/overview" })).json().status).toBe("insufficient_data");
    put(deps, issue());
    const ok = (await app.inject({ method: "GET", url: "/v1/public/overview" })).json();
    expect(ok.status).toBe("ok");
    expect(JSON.stringify(ok)).not.toMatch(/citizen|lat|lng|description/);
    const states = (await app.inject({ method: "GET", url: "/v1/public/regions?level=state" })).json();
    expect(states.regions.map((r: { regionId: string }) => r.regionId)).toEqual(["IN-DL"]);
  });
});
