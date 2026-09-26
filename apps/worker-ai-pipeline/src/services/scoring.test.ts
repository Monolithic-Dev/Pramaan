import { describe, expect, it } from "vitest";
import pino from "pino";
import type { Issue } from "@pramaan/shared-types";
import { createFakeDeps } from "../testUtils/fakeDeps.js";
import { runScoringBatch } from "./scoring.js";

const log = pino({ level: "silent" });

let counter = 0;
function makeIssue(overrides: Partial<Issue> = {}): Issue {
  counter += 1;
  return {
    issue_id: `iss_test_${counter}`,
    country_code: "IN",
    state_id: "UNRESOLVED",
    category: "roads",
    subcategory: "pothole",
    canonical_description: "Large pothole causing traffic hazard",
    embedding: null,
    embedding_model: null,
    geo_cluster_id: `gc_test_${counter}`,
    admin_region_id: null,
    geohash: "ttnfv2",
    submission_ids: [`sub_${counter}`],
    report_count: 14,
    distinct_reporter_count: 11,
    first_reported_at: "2026-09-10T08:00:00Z",
    last_reported_at: "2026-09-14T18:20:00Z",
    emergency_override: false,
    fraud_flags: [],
    status: "open",
    composite_score: null,
    latest_score_id: null,
    ...overrides,
  };
}

describe("runScoringBatch", () => {
  it("reproduces the worked example from docs/AI_PIPELINE.md Stage 6 end-to-end", async () => {
    const deps = createFakeDeps();
    const issue = makeIssue({ admin_region_id: "LGD:ward", distinct_reporter_count: 11 });
    await deps.store.createIssue(issue);
    // 10 other issues with distinct_reporter_count spanning 1-10 so P95 lands
    // where distinct_reporter_count=11 (this issue) maps demand to ~0.71.
    for (let i = 1; i <= 19; i++) {
      await deps.store.createIssue(makeIssue({ distinct_reporter_count: i }));
    }
    deps.ancestryByRegion.set("LGD:ward", [{ regionId: "LGD:ward", level: "ward" }]);
    deps.infraIndexByRegion.set("LGD:ward", {
      normalisedValuesByType: { road_density: 1 - 0.55 }, // inverted -> vulnerability 0.55
    });
    deps.latestInvestmentByRegionCategory.set("LGD:ward|roads", {
      fiscalYear: `${new Date().getFullYear() - 10}-${String(new Date().getFullYear() - 9).slice(-2)}`,
    });

    await runScoringBatch(deps, log);

    const scored = await deps.store.getIssue(issue.issue_id);
    expect(scored?.composite_score).not.toBeNull();
    expect(scored!.composite_score!).toBeGreaterThan(0);
    expect(scored!.composite_score!).toBeLessThanOrEqual(1);
  });

  it("excludes issues with distinct_reporter_count < 3 unless emergency_override is set", async () => {
    const deps = createFakeDeps();
    const belowThreshold = makeIssue({ distinct_reporter_count: 1, emergency_override: false });
    const overridden = makeIssue({ distinct_reporter_count: 1, emergency_override: true });
    await deps.store.createIssue(belowThreshold);
    await deps.store.createIssue(overridden);

    const summary = await runScoringBatch(deps, log);

    expect(summary.issuesScored).toBe(1);
    const notScored = await deps.store.getIssue(belowThreshold.issue_id);
    const wasScored = await deps.store.getIssue(overridden.issue_id);
    expect(notScored?.composite_score).toBeNull();
    expect(wasScored?.composite_score).not.toBeNull();
  });

  it("falls back to a district-level InfraIndex when ward-level data is missing, and discloses it", async () => {
    const deps = createFakeDeps();
    const issue = makeIssue({ admin_region_id: "LGD:ward", distinct_reporter_count: 5 });
    await deps.store.createIssue(issue);
    deps.ancestryByRegion.set("LGD:ward", [
      { regionId: "LGD:ward", level: "ward" },
      { regionId: "LGD:district", level: "district" },
    ]);
    // No infra index at ward level (absent from the map -> null); district has one.
    deps.infraIndexByRegion.set("LGD:district", {
      normalisedValuesByType: { poverty_index: 0.4 },
    });

    await runScoringBatch(deps, log);

    const scored = await deps.store.getIssue(issue.issue_id);
    const score = await deps.store.getCanonicalScore(issue.issue_id);
    expect(score?.vulnerability_score).toBeCloseTo(0.4, 5);
    expect(score?.data_fallbacks).toContainEqual(
      expect.objectContaining({ component: "vulnerability_score", used_level: "district" }),
    );
    expect(scored?.composite_score).not.toBeNull();
  });

  it("sets duplication_penalty to 0 with an unverified flag when no InvestmentRecord exists", async () => {
    const deps = createFakeDeps();
    const issue = makeIssue({ admin_region_id: "LGD:ward", distinct_reporter_count: 5 });
    await deps.store.createIssue(issue);
    deps.infraIndexByRegion.set("LGD:ward", { normalisedValuesByType: { poverty_index: 0.3 } });
    // No investment record configured -> getLatestInvestment returns null.

    await runScoringBatch(deps, log);

    const score = await deps.store.getCanonicalScore(issue.issue_id);
    expect(score?.duplication_penalty).toBe(0);
    expect(score?.data_fallbacks).toContainEqual(
      expect.objectContaining({ component: "duplication_penalty", used_level: "unverified" }),
    );
  });

  it("keeps effFactor at exactly 1.0 (no penalty) when there is no impact history", async () => {
    const deps = createFakeDeps();
    const issue = makeIssue({ admin_region_id: "LGD:ward", distinct_reporter_count: 5 });
    await deps.store.createIssue(issue);
    deps.infraIndexByRegion.set("LGD:ward", { normalisedValuesByType: { poverty_index: 0.3 } });

    await runScoringBatch(deps, log);

    const score = await deps.store.getCanonicalScore(issue.issue_id);
    expect(score?.impact_efficacy).toBeNull();
    // base * 1 * dupFactor should equal composite exactly when effFactor is 1
    expect(score!.composite_score).toBeCloseTo(score!.base_score * (1 - 0.15 * score!.duplication_penalty), 5);
  });

  it("always writes is_canonical: true from the batch runner", async () => {
    const deps = createFakeDeps();
    const issue = makeIssue({ distinct_reporter_count: 5 });
    await deps.store.createIssue(issue);

    await runScoringBatch(deps, log);

    const score = await deps.store.getCanonicalScore(issue.issue_id);
    expect(score?.is_canonical).toBe(true);
  });

  it("is reproducible: two consecutive runs on unchanged data produce identical composite scores", async () => {
    const deps = createFakeDeps();
    const issue = makeIssue({ admin_region_id: "LGD:ward", distinct_reporter_count: 5 });
    await deps.store.createIssue(issue);
    deps.infraIndexByRegion.set("LGD:ward", { normalisedValuesByType: { poverty_index: 0.3 } });

    await runScoringBatch(deps, log);
    const first = await deps.store.getIssue(issue.issue_id);

    await runScoringBatch(deps, log);
    const second = await deps.store.getIssue(issue.issue_id);

    expect(second?.composite_score).toBe(first?.composite_score);
  });

  it("computes estimated_impact_population from the resolved region's population and category coverage", async () => {
    const deps = createFakeDeps();
    const issue = makeIssue({
      admin_region_id: "LGD:ward",
      category: "health_infra",
      distinct_reporter_count: 5,
    });
    await deps.store.createIssue(issue);
    deps.infraIndexByRegion.set("LGD:ward", { normalisedValuesByType: { poverty_index: 0.3 } });
    deps.regionCentroids.push({
      regionId: "LGD:ward",
      level: "ward",
      parentRegionId: null,
      lat: 28.6,
      lng: 77.2,
      population: 32000,
    });

    await runScoringBatch(deps, log);

    const score = await deps.store.getCanonicalScore(issue.issue_id);
    // health_infra coverage fraction is 0.1 -> 32000 * 0.1 = 3200
    expect(score?.estimated_impact_population).toBe(3200);
  });

  it("leaves estimated_impact_population null when the issue has no resolved region", async () => {
    const deps = createFakeDeps();
    const issue = makeIssue({ admin_region_id: null, distinct_reporter_count: 5 });
    await deps.store.createIssue(issue);

    await runScoringBatch(deps, log);

    const score = await deps.store.getCanonicalScore(issue.issue_id);
    expect(score?.estimated_impact_population).toBeNull();
  });
});
