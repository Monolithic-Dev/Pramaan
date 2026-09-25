import { describe, expect, it } from "vitest";
import { generateBrief } from "./tools.js";
import { issue, setup } from "../testUtils/fixtures.js";

describe("generateBrief", () => {
  it("passes its own groundedness check with real, full-precision scores", async () => {
    // The worker stores scores as raw floats; the brief prints them rounded. The verifier must be
    // checking the displayed values, or every real brief would be flagged as ungrounded.
    const { deps, put } = setup();
    const i = put(issue(), { composite_score: 0.7467427552814604, demand_score: 0.6689123456, vulnerability_score: 0.3949999, gap_score: 1 });
    const brief = await generateBrief(deps, i.issue_id);
    if (!("generated_brief" in brief)) throw new Error("expected a brief");
    expect(brief.generated_brief).toContain("0.747");
    expect(brief.generated_brief).toContain("demand 0.67");
    expect(brief.groundedness_check).toEqual({ passed: true, unverified_claims: [] });
  });

  it("still refuses to score-less issues rather than inventing numbers", async () => {
    const { deps, put } = setup();
    const i = put(issue(), null);
    const brief = await generateBrief(deps, i.issue_id);
    expect("generated_brief" in brief).toBe(false);
  });
});
