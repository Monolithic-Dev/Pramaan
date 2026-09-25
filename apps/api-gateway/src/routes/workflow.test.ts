import { describe, expect, it } from "vitest";
import { issue, setup, submission } from "../testUtils/fixtures.js";

const j = (r: { json: () => any }) => r.json();

describe("assignment and SLA", () => {
  it("lets a collector assign an officer whose jurisdiction covers the issue, sets a due date, audits, and notifies the assignee", async () => {
    const { app, deps, put, collector } = setup();
    const i = put(issue());
    const res = await app.inject({ method: "POST", url: `/v1/issues/${i.issue_id}/assign`, headers: collector, payload: { officer_uid: "u_field", due_in_days: 5 } });
    expect(res.statusCode).toBe(200);
    expect(j(res)).toMatchObject({ assigned_to_uid: "u_field", assigned_to_label: "field@gov.test" });
    expect(new Date(j(res).sla_due_at).getTime()).toBeGreaterThan(Date.now() + 4 * 86_400_000);
    expect(deps.store.auditLog.at(-1)).toMatchObject({ action: "issue_assigned", target_id: i.issue_id });

    const inbox = j(await app.inject({ method: "GET", url: "/v1/notifications", headers: { authorization: "Bearer field" } }));
    expect(inbox.unread).toBe(1);
    expect(inbox.notifications[0]).toMatchObject({ kind: "issue.assigned", link: `/console/issues/${i.issue_id}` });
  });

  it("refuses an assignee who cannot see the issue, a field officer assigning, and an issue in another jurisdiction", async () => {
    const { app, put, collector, field, pune } = setup();
    const i = put(issue());
    // Pune's collector's jurisdiction does not cover Central Delhi.
    expect((await app.inject({ method: "POST", url: `/v1/issues/${i.issue_id}/assign`, headers: collector, payload: { officer_uid: "u_pune" } })).statusCode).toBe(409);
    expect((await app.inject({ method: "POST", url: `/v1/issues/${i.issue_id}/assign`, headers: field, payload: { officer_uid: "u_field" } })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: `/v1/issues/${i.issue_id}/assign`, headers: pune, payload: { officer_uid: "u_pune" } })).statusCode).toBe(403);
  });

  it("can unassign, and filters the issue list by assignee and overdue", async () => {
    const { app, put, collector } = setup();
    const overdue = put(issue({ first_reported_at: "2025-01-01T00:00:00Z" }));
    const fresh = put(issue());
    await app.inject({ method: "POST", url: `/v1/issues/${fresh.issue_id}/assign`, headers: collector, payload: { officer_uid: "u_collector" } });

    const mine = j(await app.inject({ method: "GET", url: "/v1/issues?assigned=me", headers: collector }));
    expect(mine.issues.map((x: { issue_id: string }) => x.issue_id)).toEqual([fresh.issue_id]);
    const late = j(await app.inject({ method: "GET", url: "/v1/issues?overdue=true", headers: collector }));
    expect(late.issues.map((x: { issue_id: string }) => x.issue_id)).toEqual([overdue.issue_id]);
    expect(late.issues[0].sla.state).toBe("overdue");

    await app.inject({ method: "POST", url: `/v1/issues/${fresh.issue_id}/assign`, headers: collector, payload: { officer_uid: null } });
    const unassigned = j(await app.inject({ method: "GET", url: "/v1/issues?assigned=unassigned", headers: collector }));
    expect(unassigned.issues).toHaveLength(2);
  });

  it("lists only officers whose jurisdiction reaches into the caller's", async () => {
    const { app, field } = setup();
    const dir = j(await app.inject({ method: "GET", url: "/v1/officers/directory", headers: field }));
    const uids = dir.officers.map((o: { uid: string }) => o.uid);
    expect(uids).toContain("u_collector");
    expect(uids).not.toContain("u_pune");
  });
});

describe("internal notes", () => {
  it("lets officers in scope discuss an issue, and notifies the assignee (not the author)", async () => {
    const { app, put, collector, field, pune } = setup();
    const i = put(issue({ assigned_to_uid: "u_field", assigned_to_label: "field@gov.test" }));
    const posted = await app.inject({ method: "POST", url: `/v1/issues/${i.issue_id}/comments`, headers: collector, payload: { body: "  Site visit done, pipe is cracked.  " } });
    expect(posted.statusCode).toBe(201);
    expect(j(posted)).toMatchObject({ body: "Site visit done, pipe is cracked.", author_role: "district_collector" });

    const list = j(await app.inject({ method: "GET", url: `/v1/issues/${i.issue_id}/comments`, headers: field }));
    expect(list.comments).toHaveLength(1);
    const inbox = j(await app.inject({ method: "GET", url: "/v1/notifications", headers: { authorization: "Bearer field" } }));
    expect(inbox.notifications[0].kind).toBe("issue.comment");

    // Notes never cross a jurisdiction boundary, and empty notes are rejected.
    expect((await app.inject({ method: "GET", url: `/v1/issues/${i.issue_id}/comments`, headers: pune })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: `/v1/issues/${i.issue_id}/comments`, headers: collector, payload: { body: "   " } })).statusCode).toBe(400);
  });
});

describe("notifications", () => {
  it("tells reporters when their issue moves, links each to their own report, and supports mark-as-read", async () => {
    const { app, deps, put, collector, alice, bob } = setup();
    const i = put(issue());
    deps.store.putSubmission(submission("sub_a", "c_alice", i.issue_id));
    deps.store.putSubmission(submission("sub_a2", "c_alice", i.issue_id)); // a second report must not double-notify
    deps.store.putSubmission(submission("sub_b", "c_bob", i.issue_id));
    deps.store.putSubmission(submission("sub_x", "anonymous", i.issue_id));

    const changed = await app.inject({ method: "POST", url: `/v1/issues/${i.issue_id}/status`, headers: collector, payload: { status: "verified", justification: "Confirmed on site" } });
    expect(changed.statusCode).toBe(200);

    const a = j(await app.inject({ method: "GET", url: "/v1/notifications", headers: alice }));
    expect(a.notifications).toHaveLength(1);
    expect(a.notifications[0]).toMatchObject({ kind: "issue.status_changed", params: { status: "verified", category: "roads" }, link: "/my/sub_a" });
    expect(j(await app.inject({ method: "GET", url: "/v1/notifications", headers: bob })).notifications[0].link).toBe("/my/sub_b");

    expect(j(await app.inject({ method: "POST", url: "/v1/notifications/read", headers: alice, payload: {} })).marked).toBe(1);
    expect(j(await app.inject({ method: "GET", url: "/v1/notifications", headers: alice })).unread).toBe(0);
    // Reading your own inbox never touches someone else's.
    expect(j(await app.inject({ method: "GET", url: "/v1/notifications", headers: bob })).unread).toBe(1);
  });

  it("requires a login", async () => {
    const { app } = setup();
    expect((await app.inject({ method: "GET", url: "/v1/notifications" })).statusCode).toBe(401);
  });
});

describe("closed loop", () => {
  it("resolves the issue and tells reporters only when confirmations AND officer sign-off are both in", async () => {
    const { app, deps, put, collector, alice } = setup();
    const i = put(issue({ status: "in_progress" }));
    deps.store.putSubmission(submission("sub_a", "c_alice", i.issue_id));
    for (const c of ["c_bob", "c_carol"]) deps.store.putSubmission(submission(`sub_${c}`, c, i.issue_id));
    deps.tokens.set("bob", { uid: "c_bob", claims: {} });
    deps.tokens.set("carol", { uid: "c_carol", claims: {} });
    await deps.store.putProject({
      project_id: "proj_1", issue_id: i.issue_id, country_code: "IN", state_id: "IN-DL", generated_brief: "b", brief_model_version: "v",
      brief_citations: [], groundedness_check: { passed: true, unverified_claims: [] }, composite_score: 0.7, status: "in_progress",
      assigned_dept: "PWD", budget_estimate_inr: 500_000, marked_complete_at: null, officer_signed_off_at: null,
    });

    await app.inject({ method: "POST", url: "/v1/projects/proj_1/mark-complete", headers: collector });
    // Reporters are asked to confirm.
    expect(j(await app.inject({ method: "GET", url: "/v1/notifications", headers: alice })).notifications[0].kind).toBe("issue.confirm_resolution");

    for (const who of ["alice", "bob", "carol"]) {
      await app.inject({ method: "POST", url: "/v1/projects/proj_1/confirm-resolution", headers: { authorization: `Bearer ${who}` }, payload: { confirmed: true } });
    }
    // Enough confirmations, but no sign-off yet: still not resolved.
    expect((await deps.store.getIssue(i.issue_id))!.status).toBe("in_progress");

    await app.inject({ method: "POST", url: "/v1/projects/proj_1/officer-signoff", headers: collector });
    expect((await deps.store.getIssue(i.issue_id))!.status).toBe("resolved");
    expect((await deps.store.getProject("proj_1"))!.status).toBe("completed");
    const kinds = j(await app.inject({ method: "GET", url: "/v1/notifications", headers: alice })).notifications.map((n: { kind: string; params: { status?: string } }) => `${n.kind}:${n.params.status ?? ""}`);
    expect(kinds).toContain("issue.status_changed:resolved");
  });
});

describe("activity feed", () => {
  it("merges new reports and officer actions in scope, newest first, and refuses other jurisdictions", async () => {
    const { app, put, collector, pune } = setup();
    const i = put(issue());
    await app.inject({ method: "POST", url: `/v1/issues/${i.issue_id}/status`, headers: collector, payload: { status: "verified", justification: "checked" } });
    const feed = j(await app.inject({ method: "GET", url: "/v1/activity", headers: collector }));
    expect(feed.events.length).toBeGreaterThanOrEqual(2);
    expect(feed.events.some((e: { kind: string; action: string | null }) => e.kind === "action" && e.action === "issue_status_change")).toBe(true);
    expect((await app.inject({ method: "GET", url: "/v1/activity?region=dl-central", headers: pune })).statusCode).toBe(403);
  });
});
