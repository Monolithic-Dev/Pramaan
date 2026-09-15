import { describe, expect, it, vi } from "vitest";
import {
  cosine,
  densityClass,
  geohashEncode,
  geohashNeighbours,
  haversineMeters,
  isWithinIndiaBoundingBox,
  scrubPii,
  withRetry,
} from "./index.js";

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

describe("geohashEncode / geohashNeighbours", () => {
  it("encodes to precision 6 by default", () => {
    expect(geohashEncode(28.6139, 77.209)).toHaveLength(6);
  });

  it("returns the same hash for the same coordinates", () => {
    expect(geohashEncode(28.6139, 77.209)).toBe(geohashEncode(28.6139, 77.209));
  });

  it("returns 9 cells (self + 8 neighbours)", () => {
    const hash = geohashEncode(28.6139, 77.209);
    expect(geohashNeighbours(hash)).toHaveLength(9);
    expect(geohashNeighbours(hash)).toContain(hash);
  });
});

describe("haversineMeters", () => {
  it("returns 0 for the same point", () => {
    const p = { lat: 28.6139, lng: 77.209 };
    expect(haversineMeters(p, p)).toBe(0);
  });

  it("returns a plausible distance for two known Delhi points ~5km apart", () => {
    const indiaGate = { lat: 28.6129, lng: 77.2295 };
    const connaughtPlace = { lat: 28.6315, lng: 77.2167 };
    const d = haversineMeters(indiaGate, connaughtPlace);
    expect(d).toBeGreaterThan(2000);
    expect(d).toBeLessThan(4000);
  });
});

describe("cosine", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosine([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("returns -1 for opposite vectors", () => {
    expect(cosine([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it("throws on mismatched lengths", () => {
    expect(() => cosine([1, 2], [1, 2, 3])).toThrow();
  });
});

describe("densityClass", () => {
  it("classifies a large city as urban", () => {
    expect(densityClass(1_000_000)).toBe("urban");
  });

  it("classifies a small town as peri", () => {
    expect(densityClass(100_000)).toBe("peri");
  });

  it("classifies a village as rural", () => {
    expect(densityClass(5_000)).toBe("rural");
  });

  it("defaults to peri when population is unknown", () => {
    expect(densityClass(null)).toBe("peri");
  });
});
