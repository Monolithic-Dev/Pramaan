import { describe, expect, it } from "vitest";
import type { ImpactRecord } from "@pramaan/shared-types";
import { issue, setup } from "../testUtils/fixtures.js";

const j = (r: { json: () => any }) => r.json();

describe("weekly briefing", () => {
  it("computes every figure itself and uses the model's text only when its numbers are grounded", async () => {
    const s = setup();
    s.put(issue({ first_reported_at: "2025-01-01T00:00:00Z" })); // overdue
    s.put(issue({ emergency_override: true, composite_score: 0.9 }));
    s.put(issue({ status: "resolved" }));

    // A faithful narration is kept...
    s.deps.narrator.narrate = async (facts: any) => `Delhi has ${facts.totals.issues} issues. There are ${facts.overdue.count} overdue.`;
    const ok = j(await s.app.inject({ method: "GET", url: "/v1/reports/briefing", headers: s.collector }));
    expect(ok.facts.totals.issues).toBe(3);
    expect(ok.facts.overdue.count).toBe(1);
    expect(ok.facts.recommended_actions.join(" ")).toContain("overdue");
    expect(ok.narrative).toMatchObject({ source: "gemini" });
    expect(ok.narrative.text).toContain("3 issues");

    // ...but a sentence with an invented number is dropped, and if nothing usable remains the template takes over.
    s.deps.narrator.narrate = async () => "Delhi has 7777 issues. Things are bad.";
    const bad = j(await s.app.inject({ method: "GET", url: "/v1/reports/briefing", headers: s.collector }));
    expect(bad.narrative.source).toBe("template");
    expect(bad.narrative.text).not.toContain("7777");

    // ...and a model outage never breaks the briefing.
    s.deps.narrator.narrate = async () => {
      throw new Error("503");
    };
    const down = j(await s.app.inject({ method: "GET", url: "/v1/reports/briefing", headers: s.collector }));
    expect(down.narrative.source).toBe("template");
    expect(down.narrative.text).toContain("3 distinct issues");
  });

  it("asks the model for the requested language and stays inside the officer's jurisdiction", async () => {
    const s = setup();
    s.put(issue());
    let asked = "";
    s.deps.narrator.narrate = async (_f: unknown, language: string) => {
      asked = language;
      return "Ok. Delhi is fine and needs no action right now at all.";
    };
    await s.app.inject({ method: "GET", url: "/v1/reports/briefing?lang=hi", headers: s.collector });
    expect(asked).toBe("Hindi");
    expect((await s.app.inject({ method: "GET", url: "/v1/reports/briefing?region=dl-central", headers: s.pune })).statusCode).toBe(403);
    expect((await s.app.inject({ method: "GET", url: "/v1/reports/briefing" })).statusCode).toBe(401);
  });
});

describe("impact analytics", () => {
  it("reports people benefited, cost per beneficiary and citizen confirmation from the closed loop", async () => {
    const s = setup();
    const done = s.put(issue({ status: "resolved", first_reported_at: "2026-05-01T00:00:00Z" }), { estimated_impact_population: 4000 });
    s.put(issue({ status: "open" }));
    await s.deps.store.putProject({
      project_id: "p1", issue_id: done.issue_id, country_code: "IN", state_id: "IN-DL", generated_brief: "b", brief_model_version: "v",
      brief_citations: [], groundedness_check: { passed: true, unverified_claims: [] }, composite_score: 0.7, status: "completed",
      assigned_dept: "PWD", budget_estimate_inr: 800_000, marked_complete_at: "x", officer_signed_off_at: "x",
    });
    const impact: ImpactRecord = {
      impact_id: "i1", project_id: "p1", issue_id: done.issue_id, country_code: "IN", state_id: "IN-DL", category: "roads", region_id: "dl-central",
      confirmations_received: 3, confirmations_required: 3, confirmations_negative: 1, resolution_photo_url: null, resolved_at: "2026-05-21T00:00:00Z", verified_by: "x", efficacy: 0.75,
    };
    await s.deps.store.putImpactRecord(impact);

    const r = j(await s.app.inject({ method: "GET", url: "/v1/analytics/impact", headers: s.field }));
    expect(r).toMatchObject({
      issues: 2, resolved: 1, resolution_rate: 50, avg_days_to_resolve: 20, people_benefited: 4000,
      funds_completed_inr: 800_000, cost_per_beneficiary_inr: 200, citizen_confirmations: 3, confirmation_rate: 75,
    });
    expect(r.by_category[0]).toMatchObject({ category: "roads", resolved: 1, avg_days: 20 });
    expect((await s.app.inject({ method: "GET", url: "/v1/analytics/impact?region=dl-central", headers: s.pune })).statusCode).toBe(403);
  });
});

describe("officer CSV export", () => {
  it("exports in-scope issues without reporter identity, and defuses spreadsheet formulas", async () => {
    const s = setup();
    s.put(issue({ canonical_description: '=HYPERLINK("http://evil","click")' }));
    s.put(issue({ admin_region_id: "mh-pune", state_id: "IN-MH" })); // out of scope for Delhi
    const res = await s.app.inject({ method: "GET", url: "/v1/export/issues.csv", headers: s.admin });
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toContain("attachment");
    const lines = res.body.trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("issue_id,category");
    expect(lines[1]).toContain("\"'=HYPERLINK(");
    expect(res.body).not.toMatch(/citizen_id|phone/i);
    expect((await s.app.inject({ method: "GET", url: "/v1/export/issues.csv?region=mh-pune", headers: s.admin })).statusCode).toBe(403);
  });
});
