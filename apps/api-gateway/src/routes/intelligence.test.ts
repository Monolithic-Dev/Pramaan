import { afterEach, describe, expect, it } from "vitest";
import type { ImpactRecord, Project } from "@pramaan/shared-types";
import { issue, setup, submission } from "../testUtils/fixtures.js";
import { statusQueryCode } from "../services/inboundMessage.js";
import { env } from "../lib/env.js";

const j = (r: { json: () => any }) => r.json();

/** Delhi's two districts: Central is well served (rich, invested); South is deprived with lots of people waiting. */
function seedNeed(ctx: ReturnType<typeof setup>) {
  const idx = (region_id: string, v: number) =>
    ["road_density", "water_access", "literacy_rate"].map((index_type) => ({ region_id, index_type, normalised_value: v }));
  ctx.deps.infraIndex.push(...idx("dl-central", 0.9), ...idx("dl-south", 0.1), ...idx("mh-pune", 0.5));
  ctx.deps.investments.push(
    { region_id: "dl-central", category: "roads", scheme_id: "PMGSY", scheme_name: "x", amount: 50_000_000, currency: "INR", fiscal_year: "2025-26", data_origin: "synthetic_demo" },
    { region_id: "mh-pune", category: "water", scheme_id: "JJM", scheme_name: "x", amount: 20_000_000, currency: "INR", fiscal_year: "2024-25", data_origin: "synthetic_demo" },
    // Too old to count: outside the four-fiscal-year window.
    { region_id: "dl-south", category: "roads", scheme_id: "PMGSY", scheme_name: "x", amount: 99_000_000, currency: "INR", fiscal_year: "2015-16", data_origin: "synthetic_demo" },
  );
  for (let n = 0; n < 6; n++) ctx.put(issue({ admin_region_id: "dl-south", distinct_reporter_count: 9, category: n % 2 ? "water" : "roads" }));
  ctx.put(issue({ admin_region_id: "dl-central", distinct_reporter_count: 1 }));
}

describe("need vs spend", () => {
  it("flags a deprived district with many people waiting and no recent investment as underserved", async () => {
    const ctx = setup();
    seedNeed(ctx);
    const res = j(await ctx.app.inject({ method: "GET", url: "/v1/analytics/need-vs-spend?region=IN-DL", headers: ctx.admin }));
    const south = res.districts.find((d: any) => d.region_id === "dl-south");
    const central = res.districts.find((d: any) => d.region_id === "dl-central");
    expect(south).toMatchObject({ quadrant: "underserved", investment: 0, waiting_reporters: 54, open_issues: 6 });
    expect(south.top_unmet_categories.map((c: any) => c.category).sort()).toEqual(["roads", "water"]);
    expect(central.quadrant).not.toBe("underserved");
    expect(central.investment).toBe(50_000_000);
    expect(res.districts[0].region_id).toBe("dl-south"); // biggest gap first
    expect(res.districts.map((d: any) => d.region_id)).not.toContain("mh-pune"); // outside Delhi's jurisdiction
    expect(res.quadrants.underserved).toBe(1);
  });

  it("refuses another jurisdiction, and the public view hides counts where there are only a few reports", async () => {
    const ctx = setup();
    seedNeed(ctx);
    expect((await ctx.app.inject({ method: "GET", url: "/v1/analytics/need-vs-spend?region=IN-DL", headers: ctx.pune })).statusCode).toBe(403);

    ctx.deps.regions.push({ regionId: "IN", name: "India", level: "country", parentRegionId: null, countryCode: "IN", population: 1, lat: 0, lng: 0 });
    for (const r of ctx.deps.regions) if (r.level === "state") r.parentRegionId = "IN";
    ctx.deps.regions.push({ regionId: "IN-MH", name: "Maharashtra", level: "state", parentRegionId: "IN", countryCode: "IN", population: 1, lat: 0, lng: 0 });
    const pub = j(await ctx.app.inject({ method: "GET", url: "/v1/public/need-vs-spend?country=IN" }));
    const central = pub.districts.find((d: any) => d.region_id === "dl-central");
    const south = pub.districts.find((d: any) => d.region_id === "dl-south");
    expect(central).toMatchObject({ open_issues: null, waiting_reporters: null }); // 1 issue: below the privacy floor
    expect(south.waiting_reporters).toBe(54);
    expect(pub.districts).toHaveLength(3);
  });
});

describe("scheme impact ledger", () => {
  const project = (issueId: string, over: Partial<Project> = {}): Project => ({
    project_id: `p_${issueId}`, issue_id: issueId, country_code: "IN", state_id: "IN-DL", generated_brief: "b", brief_model_version: "v",
    brief_citations: [], groundedness_check: { passed: true, unverified_claims: [] }, composite_score: 0.7, status: "completed",
    assigned_dept: "PWD", budget_estimate_inr: 1_000_000, marked_complete_at: "x", officer_signed_off_at: "x", ...over,
  });
  const impact = (issueId: string, yes: number, no: number, resolvedAt = "2026-06-11T00:00:00Z", reopened = 0): ImpactRecord => ({
    impact_id: `i_${issueId}`, project_id: `p_${issueId}`, issue_id: issueId, country_code: "IN", state_id: "IN-DL", category: "roads",
    region_id: "dl-central", confirmations_received: yes, confirmations_required: 3, confirmations_negative: no, resolution_photo_url: null,
    resolved_at: resolvedAt, verified_by: "x", efficacy: yes / Math.max(1, yes + no), reopened_count: reopened,
  });

  it("measures each scheme on money committed, delivery, speed, people reached and what citizens say", async () => {
    const ctx = setup();
    const a = ctx.put(issue({ status: "resolved", first_reported_at: "2026-06-01T00:00:00Z" }), { estimated_impact_population: 5000 });
    const b = ctx.put(issue({ status: "resolved", first_reported_at: "2026-06-01T00:00:00Z" }), { estimated_impact_population: 3000 });
    const c = ctx.put(issue({ status: "funded" }));
    for (const [i, s] of [[a, "completed"], [b, "completed"], [c, "funded"]] as const) {
      await ctx.deps.store.putProject(project(i.issue_id, { status: s, scheme_id: "pmgsy" }));
    }
    await ctx.deps.store.putImpactRecord(impact(a.issue_id, 3, 0));
    await ctx.deps.store.putImpactRecord(impact(b.issue_id, 3, 1, "2026-06-21T00:00:00Z", 1));

    const res = j(await ctx.app.inject({ method: "GET", url: "/v1/schemes/performance", headers: ctx.admin }));
    const pmgsy = res.schemes.find((s: any) => s.scheme_id === "pmgsy");
    expect(pmgsy).toMatchObject({
      projects: 3, completed: 2, committed_inr: 3_000_000, central_inr: 1_800_000, delivery_rate: 0.667,
      avg_days_to_fix: 15, people_benefited: 8000, cost_per_person_inr: 250, citizen_confirmation: 86, reopened: 1, signal: "delivering",
    });
    expect(res.totals).toMatchObject({ projects: 3, completed: 2 });
  });

  it("attributes projects with no recorded scheme to their best match, and lets a collector correct it", async () => {
    const ctx = setup();
    const i = ctx.put(issue({ category: "water", subcategory: "pipeline", canonical_description: "supply pipeline burst" }));
    await ctx.deps.store.putProject(project(i.issue_id, { status: "funded" }));
    const before = j(await ctx.app.inject({ method: "GET", url: "/v1/public/schemes/performance" }));
    expect(before.schemes[0].categories).toEqual(["water"]);

    const set = await ctx.app.inject({ method: "POST", url: `/v1/projects/p_${i.issue_id}/scheme`, headers: ctx.collector, payload: { scheme_id: "xvfc" } });
    expect(set.statusCode).toBe(200);
    expect(j(await ctx.app.inject({ method: "GET", url: "/v1/public/schemes/performance" })).schemes[0].scheme_id).toBe("xvfc");
    expect(ctx.deps.store.auditLog.at(-1)?.action).toBe("project_scheme_set");

    expect((await ctx.app.inject({ method: "POST", url: `/v1/projects/p_${i.issue_id}/scheme`, headers: ctx.field, payload: { scheme_id: "jjm" } })).statusCode).toBe(403);
    expect((await ctx.app.inject({ method: "POST", url: `/v1/projects/p_${i.issue_id}/scheme`, headers: ctx.pune, payload: { scheme_id: "jjm" } })).statusCode).toBe(403);
    expect((await ctx.app.inject({ method: "POST", url: `/v1/projects/p_${i.issue_id}/scheme`, headers: ctx.collector, payload: { scheme_id: "nope" } })).statusCode).toBe(400);
  });

  it("records the best-fit scheme when a project is recommended", async () => {
    const ctx = setup();
    const i = ctx.put(issue({ status: "verified", category: "health_infra", subcategory: "no doctor", canonical_description: "clinic with no doctor" }));
    const res = await ctx.app.inject({ method: "POST", url: `/v1/issues/${i.issue_id}/project`, headers: ctx.collector, payload: {} });
    expect(res.statusCode).toBe(201);
    expect(["nhm", "pmabhim"]).toContain(j(res).scheme_id);
  });
});

describe("AI photo assistant", () => {
  it("describes a photo the app stored, in the citizen's language", async () => {
    const ctx = setup();
    const res = await ctx.app.inject({ method: "POST", url: "/v1/assist/photo", payload: { photo_url: "gs://test-bucket/photos/1", language: "hi-IN" } });
    expect(res.statusCode).toBe(200);
    expect(j(res)).toMatchObject({ shows_issue: true, category: "roads", language: "hi" });
    expect(ctx.deps.assistant.lastLanguage).toBe("Hindi");
  });

  it("refuses photos the app did not issue, and degrades gracefully when the model cannot answer", async () => {
    const ctx = setup();
    expect((await ctx.app.inject({ method: "POST", url: "/v1/assist/photo", payload: { photo_url: "https://evil.example/x.jpg" } })).statusCode).toBe(400);
    ctx.deps.assistant.next = null;
    const res = await ctx.app.inject({ method: "POST", url: "/v1/assist/photo", payload: { photo_url: "gs://test-bucket/photos/1" } });
    expect(res.statusCode).toBe(502);
    expect(j(res).error.code).toBe("ASSIST_UNAVAILABLE");
  });
});

describe("SMS / WhatsApp: status by text, and the live simulator", () => {
  afterEach(() => {
    delete process.env.DEMO_CHANNEL_SIMULATOR;
    env.webhookSharedSecret = "";
  });

  it("recognises status queries in several languages, and a bare code", () => {
    expect(statusQueryCode("STATUS PR-K7M3P9QD")).toBe("PR-K7M3P9QD");
    expect(statusQueryCode("track pr k7m3 p9qd")).toBe("PR-K7M3P9QD");
    expect(statusQueryCode("track js k7m3 p9qd")).toBe("JS-K7M3P9QD"); // an old code, looked up under both prefixes
    expect(statusQueryCode("स्थिति PR-K7M3P9QD")).toBe("PR-K7M3P9QD");
    expect(statusQueryCode("K7M3P9QD")).toBe("PR-K7M3P9QD");
    expect(statusQueryCode("There is a big pothole near the market")).toBeNull();
  });

  it("is off unless enabled, and when on files a report or answers a status query without filing anything", async () => {
    const ctx = setup();
    expect((await ctx.app.inject({ method: "POST", url: "/v1/public/demo/message", payload: { channel: "sms", text: "Broken streetlight" } })).statusCode).toBe(404);

    process.env.DEMO_CHANNEL_SIMULATOR = "true";
    const filed = await ctx.app.inject({ method: "POST", url: "/v1/public/demo/message", payload: { channel: "sms", text: "Streetlight broken near the school", location_text: "Karol Bagh" } });
    expect(filed.statusCode).toBe(202);
    const code = j(filed).tracking_code as string;
    expect(j(filed).reply).toContain(code);

    const i = ctx.put(issue({ status: "funded", distinct_reporter_count: 4, category: "electricity" }));
    const sub = (await ctx.deps.store.getSubmissionByTrackingCode(code))!;
    await ctx.deps.store.putSubmission({ ...sub, issue_id: i.issue_id });
    const before = ctx.deps.publishedMessages.length;
    const status = await ctx.app.inject({ method: "POST", url: "/v1/public/demo/message", payload: { channel: "sms", text: `STATUS ${code}` } });
    expect(status.statusCode).toBe(200);
    expect(j(status)).toMatchObject({ kind: "status", stage: "funded", other_reporters: 3 });
    expect(j(status).reply).toMatch(/funded/);
    expect(ctx.deps.publishedMessages.length).toBe(before); // nothing new was filed
    expect(j(await ctx.app.inject({ method: "POST", url: "/v1/public/demo/message", payload: { channel: "sms", text: "STATUS PR-ZZZZ9999" } })).kind).toBe("status_not_found");
  });

  it("answers status queries on the real WhatsApp webhook too, with a reply for the provider to send", async () => {
    env.webhookSharedSecret = "s3cret";
    const ctx = setup();
    await ctx.deps.store.putSubmission(submission("sub_w", "anonymous", null, { tracking_code: "PR-WWWW2222" }));
    const res = await ctx.app.inject({
      method: "POST", url: "/v1/webhooks/whatsapp", headers: { "x-webhook-secret": "s3cret" },
      payload: { from: "+919800000001", message_id: "wamid.1", text: "status PR-WWWW2222" },
    });
    expect(res.statusCode).toBe(200);
    expect(j(res)).toMatchObject({ kind: "status", stage: "received" });
    const filed = await ctx.app.inject({
      method: "POST", url: "/v1/webhooks/whatsapp", headers: { "x-webhook-secret": "s3cret" },
      payload: { from: "+919800000001", message_id: "wamid.2", text: "No water for three days", location_text: "Karol Bagh" },
    });
    expect(filed.statusCode).toBe(202);
    expect(j(filed).reply).toContain(j(filed).tracking_code);
  });
});
