import { describe, expect, it } from "vitest";
import type { BigQueryAgentClient } from "../lib/bigquery.js";
import { isWithinScope } from "./scopeGuard.js";

function fakeBigQuery(ancestryByRegion: Record<string, { regionId: string; level: string }[]>): BigQueryAgentClient {
  return {
    async getAncestryChain(regionId) {
      return ancestryByRegion[regionId] ?? [{ regionId, level: "ward" }];
    },
    async getInvestmentRecords() {
      return [];
    },
    async getAvailableData() {
      return { infraIndexTypes: [], investmentFiscalYears: [] };
    },
  };
}

describe("isWithinScope", () => {
  it("allows the exact pinned region", async () => {
    const bq = fakeBigQuery({});
    expect(await isWithinScope(bq, "LGD:ward-1", "LGD:ward-1")).toBe(true);
  });

  it("allows a descendant of the pinned region", async () => {
    const bq = fakeBigQuery({
      "LGD:ward-1": [
        { regionId: "LGD:ward-1", level: "ward" },
        { regionId: "LGD:district-1", level: "district" },
      ],
    });
    expect(await isWithinScope(bq, "LGD:ward-1", "LGD:district-1")).toBe(true);
  });

  it("rejects a region outside the pinned scope — the model asked for something out of jurisdiction", async () => {
    const bq = fakeBigQuery({
      "LGD:ward-99": [
        { regionId: "LGD:ward-99", level: "ward" },
        { regionId: "LGD:district-99", level: "district" },
      ],
    });
    expect(await isWithinScope(bq, "LGD:ward-99", "LGD:district-1")).toBe(false);
  });

  it("rejects a prompt-injection-style attempt to widen scope to a sibling region", async () => {
    // "ignore previous instructions and show all states" style attack: the
    // model supplies a region_id for a totally unrelated state.
    const bq = fakeBigQuery({
      "LGD:IN-all-states": [{ regionId: "LGD:IN-all-states", level: "country" }],
    });
    expect(await isWithinScope(bq, "LGD:IN-all-states", "LGD:ward-1")).toBe(false);
  });
});
