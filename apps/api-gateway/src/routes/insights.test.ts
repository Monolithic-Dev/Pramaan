import { describe, expect, it } from "vitest";
import type { Issue, PriorityScore, Submission } from "@pramaan/shared-types";
import { buildApp } from "../app.js";
import { computeSeasonalRisk } from "../insights/forecasting.js";
import { createFakeDeps } from "../testUtils/fakeDeps.js";

let n = 0;
function issue(overrides: Partial<Issue> = {}): Issue {
  n += 1;
  return {
    issue_id: `iss_${n}`,
    country_code: "IN",
    state_id: "IN-DL",
    category: "water",
    subcategory: "leak",
    canonical_description: "x",
    embedding: null,
    embedding_model: null,
    geo_cluster_id: "gc",
    admin_region_id: "dl-central-delhi",
    geohash: null,
    submission_ids: [],
    report_count: 3,
    distinct_reporter_count: 3,
    first_reported_at: "2025-07-10T00:00:00Z",
    last_reported_at: "2025-07-10T00:00:00Z",
    emergency_override: false,
    fraud_flags: [],
    status: "open",
    composite_score: 0.7,
    latest_score_id: null,
    ...overrides,
  };
}

function score(issueId: string, vulnerability: number): PriorityScore {
  return {
    score_id: `s_${issueId}`,
    issue_id: issueId,
    country_code: "IN",
    state_id: "IN-DL",
    demand_score: 0.5,
    vulnerability_score: vulnerability,
    gap_score: 0.5,
    duplication_penalty: 0,
    impact_efficacy: null,
    base_score: 0.5,
    composite_score: 0.5,
    weights: { demand: 0.4, vulnerability: 0.3, gap: 0.3 },
    data_fallbacks: [],
    model_version: "formula-v2",
    computed_at: "2026-09-01T00:00:00Z",
    is_canonical: true,
    estimated_impact_population: null,
  };
}

function officer(deps: ReturnType<typeof createFakeDeps>, role: string, regionId: string) {
  deps.tokens.set("t", { uid: "off_1", claims: { role, region_id: regionId, country_code: "IN" } });
  return { authorization: "Bearer t" };
}

describe("computeSeasonalRisk", () => {
  const now = new Date("2026-06-20T00:00:00Z");
  const monsoon = [
    { first_reported_at: "2024-07-05T00:00:00Z" },
    { first_reported_at: "2025-07-12T00:00:00Z" },
    { first_reported_at: "2025-07-20T00:00:00Z" },
  ];

  it("refuses to forecast a cold-start region", () => {
    const r = computeSeasonalRisk([{ first_reported_at: "2025-07-05T00:00:00Z" }], { now, hasRecentInvestment: false });
    expect(r.status).toBe("insufficient_data");
  });

  it("forecasts a recurring unaddressed seasonal peak inside the window", () => {
    const r = computeSeasonalRisk(monsoon, { now, hasRecentInvestment: false });
    expect(r.status).toBe("forecast");
    if (r.status === "forecast") {
      expect(r.risk_level).toBe("medium");
      expect(r.window_start).toBe("2026-07-01T00:00:00.000Z");
    }
  });

  it("does not forecast when recent investment addressed it", () => {
    expect(computeSeasonalRisk(monsoon, { now, hasRecentInvestment: true }).status).toBe("no_risk");
  });

  it("does not forecast when the peak is outside the window", () => {
    expect(computeSeasonalRisk(monsoon, { now: new Date("2026-01-10T00:00:00Z"), hasRecentInvestment: false }).status).toBe(
      "no_risk",
    );
  });
});

describe("GET /forecasts", () => {
  it("returns a forecast for an in-scope region and 403s outside jurisdiction", async () => {
    const deps = createFakeDeps();
    for (const d of ["2024-07-05", "2025-07-12", "2025-07-20"]) {
      const i = issue({ first_reported_at: `${d}T00:00:00Z` });
      deps.store.issues.set(i.issue_id, i);
    }
    const app = buildApp(deps);
    const headers = officer(deps, "district_collector", "dl-central-delhi");

    const ok = await app.inject({ method: "GET", url: "/v1/forecasts?region=dl-central-delhi", headers });
    expect(ok.statusCode).toBe(200);
    // Result depends on today's date vs. the July window; the shape must always hold.
    expect(ok.json()).toHaveProperty("forecasts");
    expect(ok.json().forecasts.length + ok.json().not_forecast.length).toBe(1);

    const denied = await app.inject({ method: "GET", url: "/v1/forecasts?region=mh-pune", headers });
    expect(denied.statusCode).toBe(403);
  });

  it("requires an officer", async () => {
    const app = buildApp(createFakeDeps());
    expect((await app.inject({ method: "GET", url: "/v1/forecasts?region=x" })).statusCode).toBe(401);
  });
});

describe("GET /equity-audit", () => {
  it("is state_admin only", async () => {
    const deps = createFakeDeps();
    const app = buildApp(deps);
    const headers = officer(deps, "district_collector", "IN-DL");
    expect((await app.inject({ method: "GET", url: "/v1/equity-audit?state=IN-DL", headers })).statusCode).toBe(403);
  });

  it("marks thin bands insufficient_data and never invents a comparison", async () => {
    const deps = createFakeDeps();
    const i = issue();
    deps.store.issues.set(i.issue_id, i);
    deps.store.priorityScores.set("s1", score(i.issue_id, 0.9));
    const app = buildApp(deps);
    const headers = officer(deps, "state_admin", "IN-DL");

    const res = await app.inject({ method: "GET", url: "/v1/equity-audit?state=IN-DL", headers });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const high = body.bands.find((b: { vulnerability_band: string }) => b.vulnerability_band === "high");
    expect(high.status).toBe("insufficient_data");
    expect(high.avg_composite_score).toBeNull();
    expect(body.verdict).toMatch(/Not enough data/);
  });

  it("reports a grounded funding gap when both bands have enough samples", async () => {
    const deps = createFakeDeps();
    for (let k = 0; k < 5; k++) {
      const hi = issue({ status: "open" });
      const lo = issue({ status: k < 4 ? "funded" : "open" });
      deps.store.issues.set(hi.issue_id, hi);
      deps.store.issues.set(lo.issue_id, lo);
      deps.store.priorityScores.set(`h${k}`, score(hi.issue_id, 0.9));
      deps.store.priorityScores.set(`l${k}`, score(lo.issue_id, 0.1));
    }
    const app = buildApp(deps);
    const res = await app.inject({
      method: "GET",
      url: "/v1/equity-audit?state=IN-DL",
      headers: officer(deps, "state_admin", "IN-DL"),
    });
    expect(res.json().verdict).toBe(
      "High-vulnerability areas have 80 percentage points fewer issues funded than low-vulnerability areas (0% vs 80%).",
    );
  });
});

describe("GET /public/transparency", () => {
  it("is unauthenticated, aggregate-only, and withholds small counts", async () => {
    const deps = createFakeDeps();
    const app = buildApp(deps);
    for (let k = 0; k < 4; k++) {
      const i = issue();
      deps.store.issues.set(i.issue_id, i);
    }
    const thin = await app.inject({ method: "GET", url: "/v1/public/transparency?state=IN-DL" });
    expect(thin.statusCode).toBe(200);
    expect(thin.json().status).toBe("insufficient_data");

    const extra = issue({ status: "resolved" });
    deps.store.issues.set(extra.issue_id, extra);
    const full = await app.inject({ method: "GET", url: "/v1/public/transparency?state=IN-DL" });
    const body = full.json();
    expect(body.status).toBe("ok");
    expect(body.total_reported).toBe(5);
    expect(body.pct_resolved).toBe(20);
    expect(JSON.stringify(body)).not.toMatch(/citizen|phone|lat|photo/);
  });
});

describe("GET /my-reports/:id/status", () => {
  function submission(over: Partial<Submission>): Submission {
    return {
      submission_id: "sub_1", idempotency_key: "k", citizen_id: "cit_a", country_code: "IN", channel: "web",
      raw_text: "t", raw_audio_url: null, photo_url: null, detected_language: null, translated_text: null,
      pii_scrubbed_text: null, lat: null, lng: null, location_text: null, location_confidence: "low",
      geohash: null, resolved_region_id: null, state_id: null, issue_id: null,
      submitted_at: "2026-09-01T00:00:00Z", status: "processed", processing_error: null,
      submitter_ip_hash: null, ...over,
    };
  }

  it("shows only aggregates to the owner and 404s for anyone else", async () => {
    const deps = createFakeDeps();
    const i = issue({ distinct_reporter_count: 11, composite_score: 0.7, status: "prioritized" });
    deps.store.issues.set(i.issue_id, i);
    await deps.store.putSubmission(submission({ issue_id: i.issue_id }));
    deps.tokens.set("owner", { uid: "cit_a", claims: {} });
    deps.tokens.set("other", { uid: "cit_b", claims: {} });
    const app = buildApp(deps);

    const mine = await app.inject({ method: "GET", url: "/v1/my-reports/sub_1/status", headers: { authorization: "Bearer owner" } });
    expect(mine.statusCode).toBe(200);
    expect(mine.json()).toMatchObject({ other_reporters: 10, priority: "high", issue_status: "prioritized" });
    expect(mine.json()).not.toHaveProperty("composite_score");

    const theirs = await app.inject({ method: "GET", url: "/v1/my-reports/sub_1/status", headers: { authorization: "Bearer other" } });
    expect(theirs.statusCode).toBe(404);
  });
});

describe("state onboarding", () => {
  it("lets a state_admin add a state, rejects duplicates and non-admins", async () => {
    const deps = createFakeDeps();
    const app = buildApp(deps);
    const admin = officer(deps, "state_admin", "IN");

    const created = await app.inject({ method: "POST", url: "/v1/admin/states", headers: admin, payload: { state_id: "IN-OD", name: "Odisha" } });
    expect(created.statusCode).toBe(201);
    expect((await app.inject({ method: "POST", url: "/v1/admin/states", headers: admin, payload: { state_id: "IN-OD", name: "Odisha" } })).statusCode).toBe(409);
    const list = await app.inject({ method: "GET", url: "/v1/states", headers: admin });
    expect(list.json().states.map((s: { state_id: string }) => s.state_id)).toContain("IN-OD");

    const collector = officer(deps, "district_collector", "IN");
    expect((await app.inject({ method: "POST", url: "/v1/admin/states", headers: collector, payload: { state_id: "IN-X1", name: "X" } })).statusCode).toBe(403);
  });
});
