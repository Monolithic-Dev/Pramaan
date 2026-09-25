import { describe, expect, it } from "vitest";
import { stripUngroundedSentences, verifyGrounded } from "./groundedness.js";

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

describe("stripUngroundedSentences", () => {
  it("keeps a sentence whose numeral appears in an individual tool result", () => {
    const text = "Ward 14 has 14 reports. There is no investment on record.";
    const stripped = stripUngroundedSentences(text, [{ report_count: 14 }, { investments: [] }]);
    expect(stripped).toContain("14 reports");
  });

  it("drops only the ungrounded sentence, salvaging the rest of a multi-sentence answer", () => {
    // verifyGrounded (layer 2) would refuse/regenerate this whole two-sentence
    // answer over the one bad number. Layer 3's actual value-add is not catching
    // a misattribution substring matching can't see (that number is real, it's
    // just describing the wrong thing) — it's not discarding the first, genuinely
    // grounded sentence along with the second, ungrounded one.
    const text = "Ward 14 has 14 reports about this issue. It received 999999 in emergency funding.";
    const stripped = stripUngroundedSentences(text, [{ report_count: 14 }]);
    expect(stripped).toContain("14 reports");
    expect(stripped).not.toContain("999999");
  });

  it("does not split a decimal number into two sentences", () => {
    const text = "The composite score is 0.628. It is above the funding threshold.";
    const stripped = stripUngroundedSentences(text, [{ composite_score: 0.628 }]);
    expect(stripped).toContain("0.628");
    expect(stripped).toContain("funding threshold");
  });

  it("keeps each sentence's full stop when it drops another", () => {
    const text = "Ward 14 has 14 reports. It received 999999 in funding. The score is 0.628. Officers should act.";
    const stripped = stripUngroundedSentences(text, [{ report_count: 14, composite_score: 0.628 }]);
    expect(stripped).toBe("Ward 14 has 14 reports. The score is 0.628. Officers should act.");
  });

  it("keeps sentences with no numerals regardless of tool results", () => {
    const text = "There is no investment on record for this ward.";
    const stripped = stripUngroundedSentences(text, []);
    expect(stripped).toBe(text);
  });
});
