import { describe, expect, it } from "vitest";
import en from "./en.json";
import hi from "./hi.json";
import ta from "./ta.json";

// localization-voice-ux skill: "a string only in en.json is a bug, not a
// follow-up task" — this is the guardrail against silent drift.
describe("i18n completeness", () => {
  const enKeys = Object.keys(en).sort();

  it("hi.json has every key en.json has", () => {
    expect(Object.keys(hi).sort()).toEqual(enKeys);
  });

  it("ta.json has every key en.json has", () => {
    expect(Object.keys(ta).sort()).toEqual(enKeys);
  });
});
