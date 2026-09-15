import { describe, expect, it } from "vitest";
import { verifyGrounded } from "./groundedness.js";

describe("verifyGrounded", () => {
  it("passes when every numeral in the text appears in the tool results", () => {
    const result = verifyGrounded("Ward 14 has 14 reports from 11 citizens.", [
      { report_count: 14, distinct_reporter_count: 11 },
    ]);
    expect(result.passed).toBe(true);
    expect(result.unverifiedClaims).toEqual([]);
  });

  it("fails when a numeral does not appear anywhere in the tool results", () => {
    const result = verifyGrounded("This ward has 42 unresolved issues.", [
      { report_count: 14 },
    ]);
    expect(result.passed).toBe(false);
    expect(result.unverifiedClaims).toContain("42");
  });

  it("ignores text with no numerals", () => {
    const result = verifyGrounded("There is no data for this region.", []);
    expect(result.passed).toBe(true);
  });
});
