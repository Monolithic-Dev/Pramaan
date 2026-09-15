import { describe, expect, it, vi } from "vitest";
import {
  computeCompositeScore,
  cosine,
  demandScore,
  densityClass,
  gapScore,
  geohashEncode,
  geohashNeighbours,
  haversineMeters,
  isWithinIndiaBoundingBox,
  percentile,
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

describe("computeCompositeScore", () => {
  const weights = { demand: 0.4, vulnerability: 0.3, gap: 0.3 };

  it("reproduces the worked example from docs/AI_PIPELINE.md Stage 6", () => {
    const result = computeCompositeScore(
      { demand: 0.71, vulnerability: 0.55, gap: 0.63, duplicationPenalty: 0.1, impactEfficacy: null },
      weights,
    );
    expect(result.base).toBeCloseTo(0.638, 3);
    expect(result.composite).toBeCloseTo(0.628, 3);
  });

  it("uses effFactor exactly 1.0 when impactEfficacy is null — no history is not a penalty", () => {
    const result = computeCompositeScore(
      { demand: 0.5, vulnerability: 0.5, gap: 0.5, duplicationPenalty: 0, impactEfficacy: null },
      weights,
    );
    expect(result.effFactor).toBe(1.0);
  });

  it("clamps composite to 1 even when effFactor pushes the product above 1", () => {
    const result = computeCompositeScore(
      { demand: 1, vulnerability: 1, gap: 1, duplicationPenalty: 0, impactEfficacy: 1 },
      weights,
    );
    expect(result.effFactor).toBeCloseTo(1.15, 5);
    expect(result.composite).toBe(1);
  });

  it("never produces a composite outside [0, 1]", () => {
    const result = computeCompositeScore(
      { demand: 0, vulnerability: 0, gap: 0, duplicationPenalty: 1, impactEfficacy: -1 },
      weights,
    );
    expect(result.composite).toBeGreaterThanOrEqual(0);
    expect(result.composite).toBeLessThanOrEqual(1);
  });
});

describe("demandScore", () => {
  it("returns 1 when distinct reporters meet or exceed the country P95", () => {
    expect(demandScore(50, 50)).toBeCloseTo(1, 5);
  });

  it("returns 0 for zero reporters", () => {
    expect(demandScore(0, 50)).toBe(0);
  });

  it("does not divide by zero when P95 is 0", () => {
    expect(demandScore(0, 0)).toBe(0);
    expect(demandScore(5, 0)).toBe(1);
  });
});

describe("gapScore", () => {
  it("returns 1.0 (full gap) when there is no investment record at all", () => {
    expect(gapScore(null)).toBe(1.0);
  });

  it("scales linearly up to the 5-year cap", () => {
    expect(gapScore(2.5)).toBeCloseTo(0.5, 5);
  });

  it("clamps at 1 beyond 5 years", () => {
    expect(gapScore(10)).toBe(1);
  });
});

describe("percentile", () => {
  it("returns 0 for an empty array", () => {
    expect(percentile([], 95)).toBe(0);
  });

  it("returns the max for p100", () => {
    expect(percentile([1, 5, 3, 9, 2], 100)).toBe(9);
  });

  it("returns the min for p0", () => {
    expect(percentile([1, 5, 3, 9, 2], 0)).toBe(1);
  });
});
