import { describe, expect, it } from "vitest";
import type { Issue, PriorityScore } from "@pramaan/shared-types";
import { createFakeDeps } from "../testUtils/fakeDeps.js";
import { executeTool } from "./tools.js";

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    issue_id: "iss_1",
    country_code: "IN",
    state_id: "UNRESOLVED",
    category: "roads",
    subcategory: "pothole",
    canonical_description: "Large pothole",
    embedding: null,
    embedding_model: null,
    geo_cluster_id: "gc_1",
    admin_region_id: "LGD:ward-1",
    geohash: null,
    submission_ids: [],
    report_count: 14,
    distinct_reporter_count: 11,
    first_reported_at: "2026-09-10T08:00:00Z",
    last_reported_at: "2026-09-14T18:20:00Z",
    emergency_override: false,
    fraud_flags: [],
    status: "open",
    composite_score: 0.628,
    latest_score_id: "score_1",
    ...overrides,
  };
}

function makeScore(overrides: Partial<PriorityScore> = {}): PriorityScore {
  return {
    score_id: "score_1",
    issue_id: "iss_1",
    country_code: "IN",
    state_id: "UNRESOLVED",
    demand_score: 0.71,
    vulnerability_score: 0.55,
    gap_score: 0.63,
    duplication_penalty: 0.1,
    impact_efficacy: null,
    base_score: 0.638,
    composite_score: 0.628,
    weights: { demand: 0.4, vulnerability: 0.3, gap: 0.3 },
    data_fallbacks: [],
    model_version: "formula-v1",
    computed_at: "2026-09-15T02:00:00Z",
    is_canonical: true,
    estimated_impact_population: 3200,
    ...overrides,
  };
}

describe("query_fused_data", () => {
  it("returns a no_data envelope, not an empty array, when nothing matches", async () => {
    const deps = createFakeDeps();
    const result = await executeTool(deps, "query_fused_data", { region_id: "LGD:ward-1" });
    expect(result).toMatchObject({ status: "no_data" });
    expect((result as { available_instead: unknown[] }).available_instead).toBeDefined();
  });

  it("returns issue summaries when data exists", async () => {
    const deps = createFakeDeps();
    deps.store.issues.set("iss_1", makeIssue());
    const result = await executeTool(deps, "query_fused_data", { region_id: "LGD:ward-1" });
    expect(Array.isArray(result)).toBe(true);
    expect((result as unknown[])[0]).toMatchObject({ issue_id: "iss_1", report_count: 14 });
  });
});

describe("check_investment_status", () => {
  it("returns no_data with an alternative when no InvestmentRecord exists", async () => {
    const deps = createFakeDeps();
    const result = await executeTool(deps, "check_investment_status", {
      region_id: "LGD:ward-1",
      category: "roads",
    });
    expect(result).toMatchObject({ status: "no_data" });
  });

  it("surfaces data_origin so the agent can disclose synthetic data", async () => {
    const deps = createFakeDeps();
    deps.investmentByRegionCategory.set("LGD:ward-1|roads", [
      {
        investment_id: "inv_1",
        scheme_name: "Sample Road Scheme",
        amount: 500000,
        currency: "INR",
        fiscal_year: "2023-24",
        data_origin: "synthetic_demo",
      },
    ]);
    const result = await executeTool(deps, "check_investment_status", {
      region_id: "LGD:ward-1",
      category: "roads",
    });
    expect((result as { data_origin: string }[])[0].data_origin).toBe("synthetic_demo");
  });
});

describe("simulate_priority", () => {
  it("returns is_simulation: true and never writes a canonical score", async () => {
    const deps = createFakeDeps();
    deps.store.issues.set("iss_1", makeIssue());
    deps.store.priorityScores.set("score_1", makeScore());

    const result = await executeTool(deps, "simulate_priority", {
      region_id: "LGD:ward-1",
      weight_overrides: { demand: 0.6, vulnerability: 0.2, gap: 0.2 },
    });

    expect((result as { is_simulation: boolean }[])[0].is_simulation).toBe(true);
    // The stored canonical score must be untouched by the simulation.
    const stillCanonical = await deps.store.getCanonicalScore("iss_1");
    expect(stillCanonical?.score_id).toBe("score_1");
    expect(stillCanonical?.weights).toEqual({ demand: 0.4, vulnerability: 0.3, gap: 0.3 });
  });
});

describe("generate_brief", () => {
  it("produces a brief grounded entirely in real fetched numbers", async () => {
    const deps = createFakeDeps();
    deps.store.issues.set("iss_1", makeIssue());
    deps.store.priorityScores.set("score_1", makeScore());

    const result = (await executeTool(deps, "generate_brief", { issue_id: "iss_1" })) as {
      generated_brief: string;
      groundedness_check: { passed: boolean };
    };

    expect(result.groundedness_check.passed).toBe(true);
    expect(result.generated_brief).toContain("14 reports");
  });

  it("returns no_data for an issue that hasn't been scored yet", async () => {
    const deps = createFakeDeps();
    deps.store.issues.set("iss_1", makeIssue({ composite_score: null, latest_score_id: null }));
    const result = await executeTool(deps, "generate_brief", { issue_id: "iss_1" });
    expect(result).toMatchObject({ status: "no_data" });
  });
});

describe("list_available_data", () => {
  it("always returns data, never a no_data envelope", async () => {
    const deps = createFakeDeps();
    deps.availableDataByRegion.set("LGD:ward-1", {
      infraIndexTypes: ["road_density"],
      investmentFiscalYears: ["2023-24"],
    });
    const result = await executeTool(deps, "list_available_data", { region_id: "LGD:ward-1" });
    expect(result).toMatchObject({
      infra_index_types: ["road_density"],
      investment_fiscal_years: ["2023-24"],
    });
  });
});
