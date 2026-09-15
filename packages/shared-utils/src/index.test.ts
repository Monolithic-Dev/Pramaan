import { describe, expect, it, vi } from "vitest";
import { isWithinIndiaBoundingBox, scrubPii, withRetry } from "./index.js";

describe("withRetry", () => {
  it("returns the result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(withRetry(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and eventually succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockResolvedValueOnce("ok");
    await expect(withRetry(fn, { baseDelayMs: 1 })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws the last error once attempts are exhausted", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fails"));
    await expect(withRetry(fn, { attempts: 2, baseDelayMs: 1 })).rejects.toThrow(
      "always fails",
    );
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("isWithinIndiaBoundingBox", () => {
  it("accepts a point inside India", () => {
    expect(isWithinIndiaBoundingBox(28.6139, 77.209)).toBe(true);
  });

  it("rejects a point far outside India", () => {
    expect(isWithinIndiaBoundingBox(51.5074, -0.1278)).toBe(false);
  });
});

describe("scrubPii", () => {
  it("redacts a phone number", () => {
    expect(scrubPii("call me on 9812345678 please")).toBe("call me on [redacted] please");
  });

  it("redacts an email address", () => {
    expect(scrubPii("contact me at ram@example.com")).toBe("contact me at [redacted]");
  });

  it("leaves unrelated text untouched", () => {
    expect(scrubPii("large pothole near the market")).toBe("large pothole near the market");
  });
});
