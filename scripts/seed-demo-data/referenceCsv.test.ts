import { describe, expect, it } from "vitest";
import { loadReferenceRows, parseCsvText } from "./referenceCsv.js";

describe("parseCsvText", () => {
  it("parses CRLF files with clean column names and values", () => {
    const rows = parseCsvText("a,b,last\r\n1,2,3\r\n4,5,6\r\n");
    expect(rows).toEqual([
      { a: "1", b: "2", last: "3" },
      { a: "4", b: "5", last: "6" },
    ]);
  });
});

describe("loadReferenceRows", () => {
  it("gives every AdminRegion real numeric coordinates and a population", () => {
    const { adminRegions } = loadReferenceRows();
    expect(adminRegions.length).toBeGreaterThanOrEqual(13);
    for (const r of adminRegions) {
      expect(Number.isFinite(r.centroid_lat)).toBe(true);
      expect(Number.isFinite(r.centroid_lng)).toBe(true);
      expect(r.population).toBeGreaterThan(0);
    }
  });

  it("keeps last-column fields intact (year, data_origin)", () => {
    const { infraIndex, investmentRecord } = loadReferenceRows();
    expect(infraIndex.every((r) => Number.isFinite(r.year as number))).toBe(true);
    expect(investmentRecord.every((r) => r.data_origin === "synthetic_demo")).toBe(true);
  });
});
