import { describe, expect, it } from "vitest";
import { knapsack, optimizePlan, simulateWeights, type Candidate } from "./planner.js";
import { issue, score } from "../testUtils/fixtures.js";

let n = 0;
const cand = (over: Partial<Candidate> = {}): Candidate => {
  n += 1;
  return {
    issue_id: `c${n}`, category: "roads", region_id: "dl-central", cost_inr: 500_000, composite_score: 0.6, vulnerability_score: 0.3,
    beneficiaries: 1000, value: 0.6, scheme_id: null, reports: 5, has_project: false, ...over,
  };
};

describe("knapsack", () => {
  it("never exceeds the budget and prefers the higher-value set over the first-fit one", () => {
    // 3 items of cost 5L (value 1.0 each) vs 1 item of cost 10L (value 1.5): budget 10L -> two cheap ones (2.0) beat the big one.
    const items = [cand({ cost_inr: 500_000, value: 1 }), cand({ cost_inr: 500_000, value: 1 }), cand({ cost_inr: 1_000_000, value: 1.5 })];
    const chosen = knapsack(items, 1_000_000);
    expect(chosen.reduce((s, i) => s + i.cost_inr, 0)).toBeLessThanOrEqual(1_000_000);
    expect(chosen.reduce((s, i) => s + i.value, 0)).toBe(2);
  });

  it("returns nothing for an empty list or a zero budget", () => {
    expect(knapsack([], 1_000_000)).toEqual([]);
    expect(knapsack([cand()], 0)).toEqual([]);
  });

  it("stays within the budget even when the budget is huge (unit scaling)", () => {
    const items = Array.from({ length: 40 }, (_, i) => cand({ cost_inr: 3_000_000_000 + i * 1_000_000, value: 1 + i / 100 }));
    const budget = 50_000_000_000;
    expect(knapsack(items, budget).reduce((s, i) => s + i.cost_inr, 0)).toBeLessThanOrEqual(budget);
  });
});

describe("optimizePlan", () => {
  it("reserves the equity floor for high-vulnerability areas even when low-vulnerability issues score higher", () => {
    const rich = Array.from({ length: 4 }, () => cand({ value: 0.9, vulnerability_score: 0.2 }));
    const poor = Array.from({ length: 4 }, () => cand({ value: 0.5, vulnerability_score: 0.9 }));
    const r = optimizePlan([...rich, ...poor], { budget_inr: 2_000_000, min_vulnerable_share: 0.5 });
    expect(r.plan.cost_inr).toBeLessThanOrEqual(2_000_000);
    expect(r.plan.vulnerable_share).toBeGreaterThanOrEqual(0.5);
    expect(r.equity_floor_met).toBe(true);

    const noFloor = optimizePlan([...rich, ...poor], { budget_inr: 2_000_000, min_vulnerable_share: 0 });
    expect(noFloor.plan.vulnerable_share).toBe(0); // without the floor, the optimiser funds only the high-value, low-need issues
  });

  it("spends the reserve elsewhere when there are no high-vulnerability issues, and says the floor was not met", () => {
    const r = optimizePlan([cand({ vulnerability_score: 0.2 }), cand({ vulnerability_score: 0.1 })], { budget_inr: 1_000_000, min_vulnerable_share: 0.6 });
    expect(r.plan.items.length).toBe(2);
    expect(r.equity_floor_met).toBe(false);
  });

  it("beats funding by report volume on people reached, and explains what was left out", () => {
    const loud = cand({ reports: 40, beneficiaries: 100, value: 0.3, cost_inr: 900_000 });
    const worthy = [cand({ reports: 3, beneficiaries: 5000, value: 0.9, cost_inr: 450_000 }), cand({ reports: 2, beneficiaries: 4000, value: 0.8, cost_inr: 450_000 })];
    const r = optimizePlan([loud, ...worthy], { budget_inr: 900_000, min_vulnerable_share: 0 });
    expect(r.plan.beneficiaries).toBeGreaterThan(r.baseline.beneficiaries);
    expect(r.left_out[0].issue_id).toBe(loud.issue_id);
  });

  it("never leaves out something that still fits in the remaining budget", () => {
    const r = optimizePlan([cand({ cost_inr: 900_000, value: 1 }), cand({ cost_inr: 900_000, value: 0.9 }), cand({ cost_inr: 90_000, value: 0.1 })], { budget_inr: 1_000_000, min_vulnerable_share: 0 });
    expect(r.plan.items).toHaveLength(2); // the big best one plus the small one that fits alongside it
    for (const c of r.left_out) expect(c.cost_inr).toBeGreaterThan(r.remaining_inr);
  });
});

describe("simulateWeights", () => {
  it("re-ranks by the new weights and reports how far each issue moved", () => {
    const a = issue({ issue_id: "a" }); // high demand, low vulnerability
    const b = issue({ issue_id: "b" }); // low demand, high vulnerability
    const scores = new Map([
      ["a", score("a", { demand_score: 0.9, vulnerability_score: 0.1, gap_score: 0.5, composite_score: 0.55 })],
      ["b", score("b", { demand_score: 0.1, vulnerability_score: 0.9, gap_score: 0.5, composite_score: 0.45 })],
    ]);
    const byDemand = simulateWeights([a, b], scores, { demand: 1, vulnerability: 0, gap: 0 });
    expect(byDemand[0].issue_id).toBe("a");
    const byNeed = simulateWeights([a, b], scores, { demand: 0, vulnerability: 1, gap: 0 });
    expect(byNeed[0].issue_id).toBe("b");
    expect(byNeed[0].moved).toBe(1); // b was ranked 2nd by the stored score, now 1st
  });
});
