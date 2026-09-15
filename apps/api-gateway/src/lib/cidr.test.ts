import { describe, expect, it } from "vitest";
import { isIpAllowlisted, isIpInCidr } from "./cidr.js";

describe("isIpInCidr", () => {
  it("matches an IP within a /24 range", () => {
    expect(isIpInCidr("192.168.1.42", "192.168.1.0/24")).toBe(true);
  });

  it("rejects an IP outside the range", () => {
    expect(isIpInCidr("192.168.2.42", "192.168.1.0/24")).toBe(false);
  });

  it("matches an exact /32 host", () => {
    expect(isIpInCidr("10.0.0.5", "10.0.0.5/32")).toBe(true);
    expect(isIpInCidr("10.0.0.6", "10.0.0.5/32")).toBe(false);
  });

  it("treats a malformed IP as not matching", () => {
    expect(isIpInCidr("not-an-ip", "10.0.0.0/8")).toBe(false);
  });
});

describe("isIpAllowlisted", () => {
  it("returns true when any entry in the allowlist matches", () => {
    expect(isIpAllowlisted("203.0.113.7", ["10.0.0.0/8", "203.0.113.0/24"])).toBe(true);
  });

  it("returns false for an empty allowlist", () => {
    expect(isIpAllowlisted("203.0.113.7", [])).toBe(false);
  });
});
