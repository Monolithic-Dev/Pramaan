import { describe, expect, it } from "vitest";
import { sweepThresholds } from "./tune-threshold.js";

describe("sweepThresholds", () => {
  it("scores perfect precision/recall at a threshold that exactly separates the classes", () => {
    const pairs = [
      { embeddingA: [1, 0], embeddingB: [1, 0], isDuplicate: true }, // cosine 1.0
      { embeddingA: [1, 0], embeddingB: [0, 1], isDuplicate: false }, // cosine 0.0
    ];
    const results = sweepThresholds(pairs, { from: 0.5, to: 0.5, step: 1 });
    expect(results[0]).toMatchObject({ precision: 1, recall: 1, f1: 1 });
  });

  it("recall drops when the threshold is set above every true duplicate's score", () => {
    const pairs = [{ embeddingA: [1, 0], embeddingB: [0.5, 0.5], isDuplicate: true }]; // cosine ≈ 0.71
    const results = sweepThresholds(pairs, { from: 0.99, to: 0.99, step: 1 });
    expect(results[0].recall).toBe(0);
  });
});
