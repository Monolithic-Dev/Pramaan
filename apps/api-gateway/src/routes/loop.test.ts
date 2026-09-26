import { afterEach, describe, expect, it } from "vitest";
import type { Project } from "@pramaan/shared-types";
import { issue, setup, submission } from "../testUtils/fixtures.js";

type Ctx = ReturnType<typeof setup>;

function project(issueId: string, over: Partial<Project> = {}): Project {
  return {
    project_id: `p_${issueId}`, issue_id: issueId, country_code: "IN", state_id: "IN-DL", generated_brief: "b",
    brief_model_version: "v", brief_citations: [], groundedness_check: { passed: true, unverified_claims: [] },
    composite_score: 0.7, status: "in_progress", assigned_dept: "PWD", budget_estimate_inr: 500_000,
    marked_complete_at: null, officer_signed_off_at: null, ...over,
  };
}

/** An in-progress issue in Central Delhi with the given reports, and its project marked complete. */
async function markedComplete(ctx: Ctx, reports: Parameters<typeof submission>[], over: Partial<ReturnType<typeof issue>> = {}) {
  const i = ctx.put(issue({ status: "in_progress", ...over }));
  for (const [id, who, , extra] of reports) await ctx.deps.store.putSubmission(submission(id, who, i.issue_id, extra));
  ctx.deps.store.projects.set(`p_${i.issue_id}`, project(i.issue_id));
  const res = await ctx.app.inject({ method: "POST", url: `/v1/projects/p_${i.issue_id}/mark-complete`, headers: ctx.collector });
  expect(res.statusCode).toBe(200);
  return i;
}

const confirmByCode = (ctx: Ctx, code: string, confirmed: boolean) =>
  ctx.app.inject({ method: "POST", url: `/v1/public/track/${code}/confirm`, payload: { confirmed } });

describe("confirming a fix with a tracking code (reporters without an account)", () => {
  it("counts anonymous reporters toward the threshold and lets each answer once", async () => {
    const ctx = setup();
    const i = await markedComplete(ctx, [
      ["s1", "anonymous", null, { tracking_code: "JS-AAAA2222" }],
      ["s2", "anonymous", null, { tracking_code: "JS-BBBB3333" }],
    ]);
    expect((await ctx.deps.store.getImpactRecord(`p_${i.issue_id}`))?.confirmations_required).toBe(2);

    const track = (await ctx.app.inject({ method: "GET", url: "/v1/public/track/JS-AAAA2222" })).json();
    expect(track.awaiting_confirmation).toBe(true);

    expect((await confirmByCode(ctx, "js aaaa 2222", true)).statusCode).toBe(200);
    expect((await confirmByCode(ctx, "JS-AAAA2222", true)).statusCode).toBe(409);
    expect((await ctx.app.inject({ method: "GET", url: "/v1/public/track/JS-AAAA2222" })).json().awaiting_confirmation).toBe(false);

    await confirmByCode(ctx, "JS-BBBB3333", true);
    await ctx.app.inject({ method: "POST", url: `/v1/projects/p_${i.issue_id}/officer-signoff`, headers: ctx.collector });
    expect(ctx.deps.store.issues.get(i.issue_id)?.status).toBe("resolved");
  });

  it("gives a signed-in reporter one vote even if they also use their code", async () => {
    const ctx = setup();
    const i = await markedComplete(ctx, [["s1", "c_alice", null, { tracking_code: "JS-CCCC4444" }]]);
    const viaAccount = await ctx.app.inject({ method: "POST", url: `/v1/projects/p_${i.issue_id}/confirm-resolution`, headers: ctx.alice, payload: { confirmed: true } });
    expect(viaAccount.statusCode).toBe(200);
    expect((await confirmByCode(ctx, "JS-CCCC4444", false)).statusCode).toBe(409);
  });

  it("refuses unknown codes and projects not yet marked complete", async () => {
    const ctx = setup();
    expect((await confirmByCode(ctx, "JS-ZZZZ9999", true)).statusCode).toBe(404);
    const i = ctx.put(issue());
    await ctx.deps.store.putSubmission(submission("s9", "anonymous", i.issue_id, { tracking_code: "JS-DDDD5555" }));
    ctx.deps.store.projects.set(`p_${i.issue_id}`, project(i.issue_id));
    expect((await confirmByCode(ctx, "JS-DDDD5555", true)).statusCode).toBe(409);
  });
});

describe("citizens reopening work that was not really fixed", () => {
  it("sends the work back, withdraws the sign-off, starts a fresh round and alerts the assigned officer", async () => {
    const ctx = setup();
    const i = await markedComplete(
      ctx,
      [["s1", "c_alice", null, {}], ["s2", "c_bob", null, {}]],
      { assigned_to_uid: "u_collector" },
    );
    await ctx.app.inject({ method: "POST", url: `/v1/projects/p_${i.issue_id}/officer-signoff`, headers: ctx.collector });

    await ctx.app.inject({ method: "POST", url: `/v1/projects/p_${i.issue_id}/confirm-resolution`, headers: ctx.alice, payload: { confirmed: false } });
    const second = await ctx.app.inject({ method: "POST", url: `/v1/projects/p_${i.issue_id}/confirm-resolution`, headers: ctx.bob, payload: { confirmed: false } });
    expect(second.json()).toMatchObject({ reopened: true, completed: false });

    const p = await ctx.deps.store.getProject(`p_${i.issue_id}`);
    expect(p).toMatchObject({ status: "in_progress", marked_complete_at: null, officer_signed_off_at: null });
    expect(ctx.deps.store.issues.get(i.issue_id)?.status).toBe("in_progress");
    const impact = await ctx.deps.store.getImpactRecord(`p_${i.issue_id}`);
    expect(impact).toMatchObject({ reopened_count: 1, confirmations_negative: 0, confirmed_by: [] });
    expect((await ctx.deps.store.listNotifications("u_collector", 10)).map((n) => n.kind)).toContain("issue.reopened");
    expect(ctx.deps.store.auditLog.at(-1)?.action).toBe("reopened_by_citizens");
  });

  it("does not reopen while 'fixed' answers are ahead", async () => {
    const ctx = setup();
    const i = await markedComplete(ctx, [["s1", "c_alice", null, {}], ["s2", "c_bob", null, {}], ["s3", "c_carol", null, {}]]);
    ctx.deps.tokens.set("carol", { uid: "c_carol", claims: {} });
    const answer = (h: Record<string, string>, confirmed: boolean) =>
      ctx.app.inject({ method: "POST", url: `/v1/projects/p_${i.issue_id}/confirm-resolution`, headers: h, payload: { confirmed } });
    await answer(ctx.alice, true);
    await answer(ctx.bob, true);
    expect((await answer({ authorization: "Bearer carol" }, false)).json().reopened).toBe(false);
  });
});

describe("followers", () => {
  it("tells citizens who pressed 'I'm affected too' when the issue moves, not only reporters", async () => {
    const ctx = setup();
    const i = ctx.put(issue());
    await ctx.deps.store.putSubmission(submission("s1", "c_alice", i.issue_id));
    await ctx.app.inject({ method: "POST", url: `/v1/issues/${i.issue_id}/support`, headers: ctx.bob });
    await ctx.app.inject({ method: "POST", url: `/v1/issues/${i.issue_id}/status`, headers: ctx.collector, payload: { status: "verified", justification: "Checked on site" } });
    const bob = await ctx.deps.store.listNotifications("c_bob", 10);
    expect(bob).toHaveLength(1);
    expect(bob[0].link).toBe(`/community?issue=${i.issue_id}`);
    expect(await ctx.deps.store.listNotifications("c_alice", 10)).toHaveLength(1);
  });
});

describe("GET /public/nearby", () => {
  it("lists open issues around a point, nearest first, with a coarse distance", async () => {
    const ctx = setup();
    ctx.put(issue({ issue_id: "near", centroid_lat: 28.6502, centroid_lng: 77.2302 }));
    ctx.put(issue({ issue_id: "further", centroid_lat: 28.653, centroid_lng: 77.2302 }));
    ctx.put(issue({ issue_id: "far", centroid_lat: 28.7, centroid_lng: 77.3 }));
    ctx.put(issue({ issue_id: "done", status: "resolved", centroid_lat: 28.65, centroid_lng: 77.23 }));
    ctx.put(issue({ issue_id: "flagged", fraud_flags: ["burst"], centroid_lat: 28.65, centroid_lng: 77.23 }));
    const res = await ctx.app.inject({ method: "GET", url: "/v1/public/nearby?lat=28.65&lng=77.23" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.issues.map((x: { issue_id: string }) => x.issue_id)).toEqual(["near", "further"]);
    expect(body.issues[0].distance_m % 50).toBe(0);
    expect(JSON.stringify(body)).not.toMatch(/description|lat|lng/);
    expect((await ctx.app.inject({ method: "GET", url: "/v1/public/nearby?lat=abc&lng=1" })).statusCode).toBe(400);
  });
});

describe("GET /media/* is scoped like the issue it belongs to", () => {
  it("serves an officer in jurisdiction, refuses one outside it, and hides unknown media", async () => {
    const ctx = setup();
    const i = ctx.put(issue());
    await ctx.deps.store.putSubmission(submission("s1", "c_alice", i.issue_id, { photo_url: "gs://test-bucket/photos/1" }));
    const url = `/v1/media/${encodeURIComponent("gs://test-bucket/photos/1")}`;
    expect((await ctx.app.inject({ method: "GET", url, headers: ctx.collector })).statusCode).toBe(200);
    expect((await ctx.app.inject({ method: "GET", url, headers: ctx.pune })).statusCode).toBe(403);
    const orphan = `/v1/media/${encodeURIComponent("gs://test-bucket/photos/404")}`;
    expect((await ctx.app.inject({ method: "GET", url: orphan, headers: ctx.collector })).statusCode).toBe(404);
  });
});

describe("API hardening", () => {
  it("answers client mistakes with 4xx, unknown routes with JSON 404, and sets security headers and a request id", async () => {
    const ctx = setup();
    const bad = await ctx.app.inject({ method: "POST", url: "/v1/submissions", headers: { "content-type": "application/json", "idempotency-key": "k1" }, payload: "{not json" });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.code).toBe("VALIDATION_ERROR");

    const missing = await ctx.app.inject({ method: "GET", url: "/v1/nope" });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe("NOT_FOUND");

    const ok = await ctx.app.inject({ method: "GET", url: "/healthz", headers: { "x-request-id": "trace-12345678" } });
    expect(ok.headers["x-request-id"]).toBe("trace-12345678");
    expect(ok.headers["x-content-type-options"]).toBe("nosniff");
    expect(ok.headers["x-frame-options"]).toBe("DENY");
    const minted = await ctx.app.inject({ method: "GET", url: "/healthz", headers: { "x-request-id": "bad id\nwith newline" } });
    expect(minted.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("POST /jobs/escalations", () => {
  afterEach(() => {
    delete process.env.WORKER_SHARED_SECRET;
  });
  const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

  it("escalates missed deadlines up the chain, once per level, and refuses callers without the secret", async () => {
    const ctx = setup();
    process.env.WORKER_SHARED_SECRET = "s3cret";
    const run = () => ctx.app.inject({ method: "POST", url: "/v1/jobs/escalations", headers: { "x-worker-secret": "s3cret" } });
    expect((await ctx.app.inject({ method: "POST", url: "/v1/jobs/escalations", headers: { "x-worker-secret": "wrong" } })).statusCode).toBe(401);

    // High priority: 7-day window. 10 days old = 3 days late (level 1); 20 days old = 13 days late (level 2).
    ctx.put(issue({ issue_id: "late", composite_score: 0.8, first_reported_at: daysAgo(10) }));
    ctx.put(issue({ issue_id: "very_late", composite_score: 0.8, first_reported_at: daysAgo(20) }));
    ctx.put(issue({ issue_id: "on_time", composite_score: 0.8, first_reported_at: daysAgo(1) }));

    expect((await run()).json()).toMatchObject({ escalated: 2 });
    const collectorKinds = (await ctx.deps.store.listNotifications("u_collector", 10)).map((n) => n.params.issue_id);
    const adminKinds = (await ctx.deps.store.listNotifications("u_admin", 10)).map((n) => n.params.issue_id);
    expect(collectorKinds).toEqual(["late"]);
    expect(adminKinds).toEqual(["very_late"]);
    expect((await run()).json()).toMatchObject({ escalated: 0 });
  });
});
