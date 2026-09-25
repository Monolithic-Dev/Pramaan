import { describe, expect, it } from "vitest";
import { issue, setup, submission } from "../testUtils/fixtures.js";

const j = (r: { json: () => any }) => r.json();
const post = (app: ReturnType<typeof setup>["app"], url: string, headers: Record<string, string>, payload?: Record<string, unknown>) => app.inject({ method: "POST", url: `/v1${url}`, headers, payload });

function seedPortfolio(s: ReturnType<typeof setup>) {
  // Three roads issues (cost ~5-10L each) with different reach and vulnerability.
  const a = s.put(issue({ category: "roads", report_count: 20 }), { composite_score: 0.5, vulnerability_score: 0.2, estimated_impact_population: 500 });
  const b = s.put(issue({ category: "water", report_count: 4 }), { composite_score: 0.8, vulnerability_score: 0.9, estimated_impact_population: 9000 });
  const c = s.put(issue({ category: "sanitation", report_count: 6 }), { composite_score: 0.7, vulnerability_score: 0.8, estimated_impact_population: 6000 });
  return { a, b, c };
}

describe("schemes", () => {
  it("lists the catalogue and matches an issue in scope, with the settlement basis explained and overridable", async () => {
    const s = setup();
    const i = s.put(issue({ category: "water", subcategory: "pipeline", canonical_description: "supply pipeline burst" }));
    expect(j(await s.app.inject({ method: "GET", url: "/v1/schemes", headers: s.field })).schemes.length).toBeGreaterThan(8);

    const m = j(await s.app.inject({ method: "GET", url: `/v1/issues/${i.issue_id}/schemes`, headers: s.field }));
    expect(m.settlement_basis).toBeTruthy();
    expect(m.matches[0]).toHaveProperty("funding.centre_inr");
    const rural = j(await s.app.inject({ method: "GET", url: `/v1/issues/${i.issue_id}/schemes?settlement=rural`, headers: s.field }));
    expect(rural.matches[0].scheme.id).toBe("jjm");
    expect(rural.settlement_basis).toBe("Set by you");

    expect((await s.app.inject({ method: "GET", url: `/v1/issues/${i.issue_id}/schemes`, headers: s.pune })).statusCode).toBe(403);
    expect((await s.app.inject({ method: "GET", url: "/v1/schemes" })).statusCode).toBe(401);
  });

  it("summarises how much central funding open work could draw, by scheme", async () => {
    const s = setup();
    seedPortfolio(s);
    const a = j(await s.app.inject({ method: "GET", url: "/v1/schemes/alignment", headers: s.collector }));
    expect(a.open_issues).toBe(3);
    expect(a.centre_inr).toBeGreaterThan(0);
    expect(a.by_scheme.length).toBeGreaterThan(0);
  });
});

describe("budget optimiser", () => {
  it("returns a portfolio within budget that meets the equity floor and reports the comparison with the naive approach", async () => {
    const s = setup();
    const { b, c } = seedPortfolio(s);
    const res = await post(s.app, "/planner/optimize", s.collector, { budget_inr: 1_600_000, min_vulnerable_share: 0.5 });
    expect(res.statusCode).toBe(200);
    const r = j(res);
    expect(r.plan.cost_inr).toBeLessThanOrEqual(1_600_000);
    expect(r.equity_floor_met).toBe(true);
    expect(r.plan.items.map((x: { issue_id: string }) => x.issue_id)).toEqual(expect.arrayContaining([b.issue_id, c.issue_id]));
    expect(r.plan.beneficiaries).toBeGreaterThanOrEqual(r.baseline.beneficiaries);
    expect(r.plan.items[0]).toHaveProperty("region_name", "Central Delhi");
  });

  it("is for collectors and above, within jurisdiction, with validated input", async () => {
    const s = setup();
    seedPortfolio(s);
    expect((await post(s.app, "/planner/optimize", s.field, { budget_inr: 1_000_000 })).statusCode).toBe(403);
    expect((await post(s.app, "/planner/optimize", s.pune, { budget_inr: 1_000_000, region: "dl-central" })).statusCode).toBe(403);
    expect((await post(s.app, "/planner/optimize", s.collector, { budget_inr: 5 })).statusCode).toBe(400);
    expect((await post(s.app, "/planner/optimize", s.collector, { budget_inr: 1_000_000, min_vulnerable_share: 2 })).statusCode).toBe(400);
  });

  it("does not plan issues that are already funded, disputed, resolved or unscored", async () => {
    const s = setup();
    s.put(issue({ status: "funded" }));
    s.put(issue({ status: "disputed" }));
    s.put(issue({ status: "resolved" }));
    s.put(issue(), null); // no score
    const r = j(await post(s.app, "/planner/optimize", s.collector, { budget_inr: 5_000_000 }));
    expect(r.candidates).toBe(0);
    expect(r.plan.items).toEqual([]);
  });

  it("saves a plan recomputed on the server, and approving it funds every issue, creates projects, and tells the reporters", async () => {
    const s = setup();
    const { b, c } = seedPortfolio(s);
    await s.deps.store.putSubmission(submission("sub_alice", "c_alice", b.issue_id));

    const saved = await post(s.app, "/planner/plans", s.collector, { name: "Q3 water and sanitation", budget_inr: 1_600_000, min_vulnerable_share: 0.5 });
    expect(saved.statusCode).toBe(201);
    const plan = j(saved);
    expect(plan.status).toBe("draft");
    expect(plan.items.map((x: { issue_id: string }) => x.issue_id)).toEqual(expect.arrayContaining([b.issue_id, c.issue_id]));
    expect(j(await s.app.inject({ method: "GET", url: "/v1/planner/plans", headers: s.field })).plans).toHaveLength(1);
    expect(j(await s.app.inject({ method: "GET", url: "/v1/planner/plans", headers: s.pune })).plans).toHaveLength(0);

    const approved = await post(s.app, `/planner/plans/${plan.plan_id}/approve`, s.collector);
    expect(approved.statusCode).toBe(200);
    expect(j(approved).funded).toBe(plan.items.length);
    for (const id of [b.issue_id, c.issue_id]) {
      expect((await s.deps.store.getIssue(id))!.status).toBe("funded");
      expect((await s.deps.store.getProjectByIssue(id))!.status).toBe("funded");
    }
    expect(j(await s.app.inject({ method: "GET", url: "/v1/notifications", headers: s.alice })).notifications[0].kind).toBe("issue.funded");
    expect(s.deps.store.auditLog.map((a) => a.action)).toEqual(expect.arrayContaining(["plan_saved", "plan_approved"]));
    // Approving twice is refused: money is not committed twice.
    expect((await post(s.app, `/planner/plans/${plan.plan_id}/approve`, s.collector)).statusCode).toBe(409);
    expect((await post(s.app, `/planner/plans/${plan.plan_id}/approve`, s.pune)).statusCode).toBe(403);
  });
});

describe("weights lab", () => {
  it("re-ranks under new weights without changing anything stored, and normalises the sliders", async () => {
    const s = setup();
    const hi = s.put(issue(), { demand_score: 0.9, vulnerability_score: 0.1, gap_score: 0.5, composite_score: 0.6 });
    const lo = s.put(issue(), { demand_score: 0.1, vulnerability_score: 0.9, gap_score: 0.5, composite_score: 0.5 });
    const need = j(await post(s.app, "/planner/simulate-weights", s.field, { demand: 0, vulnerability: 5, gap: 0 }));
    expect(need.weights.vulnerability).toBe(1);
    expect(need.ranking[0]).toMatchObject({ issue_id: lo.issue_id, previous_rank: 2, moved: 1 });
    expect((await s.deps.store.getIssue(hi.issue_id))!.composite_score).toBe(0.7); // nothing persisted
    expect((await post(s.app, "/planner/simulate-weights", s.field, { demand: 0, vulnerability: 0, gap: 0 })).statusCode).toBe(400);
  });
});
