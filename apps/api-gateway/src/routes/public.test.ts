import { describe, expect, it } from "vitest";
import type { ImpactRecord } from "@pramaan/shared-types";
import { issue, setup, submission } from "../testUtils/fixtures.js";

const j = (r: { json: () => any }) => r.json();

describe("submission tracking codes", () => {
  it("issues a code on submit and lets anyone follow the report with it, without exposing what was written", async () => {
    const { app, deps, put } = setup();
    const res = await app.inject({
      method: "POST", url: "/v1/submissions", headers: { "idempotency-key": "11111111-1111-4111-8111-111111111111" },
      payload: { channel: "web", text: "Broken streetlight near my house, call 9876543210", consent_version: "v1", lat: 28.65, lng: 77.23 },
    });
    expect(res.statusCode).toBe(202);
    const code = j(res).tracking_code as string;
    expect(code).toMatch(/^PR-/);

    // Replaying the same request returns the same code.
    const replay = await app.inject({
      method: "POST", url: "/v1/submissions", headers: { "idempotency-key": "11111111-1111-4111-8111-111111111111" },
      payload: { channel: "web", text: "Broken streetlight near my house, call 9876543210", consent_version: "v1", lat: 28.65, lng: 77.23 },
    });
    expect(j(replay).tracking_code).toBe(code);

    // Before the AI has processed it: received, nothing else known.
    const early = j(await app.inject({ method: "GET", url: `/v1/public/track/${code.toLowerCase()}` }));
    expect(early).toMatchObject({ stage: "received", category: null, priority: "pending" });

    // After processing it is linked to an issue: the tracker shows progress, still no text or identity.
    const i = put(issue({ status: "funded", distinct_reporter_count: 5 }));
    const subId = j(res).submission_id as string;
    const sub = (await deps.store.getSubmission(subId))!;
    await deps.store.putSubmission({ ...sub, issue_id: i.issue_id });
    const later = j(await app.inject({ method: "GET", url: `/v1/public/track/${code}` }));
    expect(later).toMatchObject({ stage: "funded", category: "roads", other_reporters: 4 });
    expect(JSON.stringify(later)).not.toContain("streetlight");
    expect(JSON.stringify(later)).not.toContain("9876543210");
    expect(later).not.toHaveProperty("citizen_id");
  });

  it("404s for unknown or malformed codes, and rate-limits guessing", async () => {
    const { app } = setup();
    expect((await app.inject({ method: "GET", url: "/v1/public/track/PR-ABCDEFGH" })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/v1/public/track/nonsense" })).statusCode).toBe(404);
    let last = 0;
    for (let n = 0; n < 25; n++) last = (await app.inject({ method: "GET", url: "/v1/public/track/PR-ABCDEFGH" })).statusCode;
    expect(last).toBe(429);
  });
});

describe("public scorecards", () => {
  const impact = (issueId: string, resolvedAt: string): ImpactRecord => ({
    impact_id: `imp_${issueId}`, project_id: `p_${issueId}`, issue_id: issueId, country_code: "IN", state_id: "IN-DL", category: "roads",
    region_id: "dl-central", confirmations_received: 3, confirmations_required: 3, confirmations_negative: 0, resolution_photo_url: null,
    resolved_at: resolvedAt, verified_by: "x", efficacy: 1,
  });

  it("grades districts on outcomes, withholds those below the privacy floor, and exposes the formula", async () => {
    const { app, deps, put } = setup();
    // Central Delhi: 6 issues, 4 resolved quickly.  South Delhi: only 2 issues -> withheld.
    for (let n = 0; n < 6; n++) {
      const i = put(issue({ status: n < 4 ? "resolved" : "verified", first_reported_at: "2026-06-01T00:00:00Z" }));
      if (n < 4) await deps.store.putImpactRecord(impact(i.issue_id, "2026-06-11T00:00:00Z"));
    }
    put(issue({ admin_region_id: "dl-south" }));
    put(issue({ admin_region_id: "dl-south" }));

    const res = j(await app.inject({ method: "GET", url: "/v1/public/scorecards?group=district" }));
    const central = res.scorecards.find((c: { region_id: string }) => c.region_id === "dl-central");
    expect(central).toMatchObject({ status: "ok", issues: 6, resolved: 4, resolution_rate: 67, avg_days_to_resolve: 10 });
    expect("ABCDE").toContain(central.grade);
    expect(res.scorecards.find((c: { region_id: string }) => c.region_id === "dl-south")).toMatchObject({ status: "insufficient_data" });
    expect(res.formula.resolution).toBeGreaterThan(0);
    // Withheld cards carry no numbers at all.
    expect(Object.keys(res.scorecards.find((c: { region_id: string }) => c.region_id === "dl-south"))).not.toContain("issues");
  });
});

describe("community map and endorsements", () => {
  it("shows only coarse location, category and counts publicly, and hides flagged or disputed issues", async () => {
    const { app, put } = setup();
    put(issue({ canonical_description: "Sensitive text about Mr Sharma at 12 Gali No 4", centroid_lat: 28.651234, centroid_lng: 77.231234, embedding: [0.1] }));
    put(issue({ fraud_flags: ["burst_detected"] }));
    put(issue({ status: "disputed" }));
    const res = j(await app.inject({ method: "GET", url: "/v1/public/issues" }));
    expect(res.issues).toHaveLength(1);
    expect(res.issues[0]).toMatchObject({ lat: 28.65, lng: 77.23, category: "roads", region_name: "Central Delhi" });
    const raw = JSON.stringify(res);
    expect(raw).not.toContain("Sharma");
    expect(raw).not.toContain("28.651234");
    expect(raw).not.toContain("embedding");
    expect(res.issues[0]).not.toHaveProperty("description");
  });

  it("counts each citizen's 'I'm affected too' once, never feeds demand, and is for citizens only", async () => {
    const { app, deps, put, alice, bob, collector } = setup();
    const i = put(issue({ distinct_reporter_count: 4 }));
    const first = j(await app.inject({ method: "POST", url: `/v1/issues/${i.issue_id}/support`, headers: alice }));
    expect(first).toMatchObject({ support_count: 1, already_supported: false });
    expect(j(await app.inject({ method: "POST", url: `/v1/issues/${i.issue_id}/support`, headers: alice }))).toMatchObject({ support_count: 1, already_supported: true });
    expect(j(await app.inject({ method: "POST", url: `/v1/issues/${i.issue_id}/support`, headers: bob })).support_count).toBe(2);

    const stored = (await deps.store.getIssue(i.issue_id))!;
    expect(stored.support_count).toBe(2);
    expect(stored.distinct_reporter_count).toBe(4); // endorsements never inflate demand
    expect((await app.inject({ method: "POST", url: `/v1/issues/${i.issue_id}/support`, headers: collector })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: `/v1/issues/${i.issue_id}/support` })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/v1/issues/nope/support", headers: alice })).statusCode).toBe(404);
  });
});

describe("public impact and open data", () => {
  it("withholds the impact ledger until there is enough data, then publishes aggregates only", async () => {
    const { app, put } = setup();
    expect(j(await app.inject({ method: "GET", url: "/v1/public/impact" })).status).toBe("insufficient_data");
    for (let n = 0; n < 6; n++) put(issue({ status: n < 2 ? "resolved" : "open" }));
    const res = j(await app.inject({ method: "GET", url: "/v1/public/impact" }));
    expect(res).toMatchObject({ status: "ok", issues: 6, resolved: 2, people_benefited: 2000 });
  });

  it("publishes open-data CSV with small cells suppressed and no free text", async () => {
    const { app, put } = setup();
    for (let n = 0; n < 4; n++) put(issue({ canonical_description: "Secret detail", first_reported_at: "2026-08-15T00:00:00Z" }));
    put(issue({ category: "water", first_reported_at: "2026-08-15T00:00:00Z" })); // a cell of one: suppressed
    const res = await app.inject({ method: "GET", url: "/v1/public/opendata/issues.csv" });
    expect(res.headers["content-type"]).toContain("text/csv");
    const lines = res.body.trim().split("\r\n");
    expect(lines[0]).toBe("state,district,category,status,month,issues,citizen_reports");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe("Delhi,Central Delhi,roads,open,2026-08,4,24");
    expect(res.body).not.toContain("Secret");
  });
});
