import { describe, expect, it } from "vitest";
import { ModelPool } from "@pramaan/shared-utils";
import { generateWithFallback, parseModelList } from "./genai.js";

const fakeAi = (behaviour: Record<string, (signal?: AbortSignal) => Promise<unknown>>) =>
  ({ models: { generateContent: ({ model, config }: { model: string; config?: { abortSignal?: AbortSignal } }) => behaviour[model](config?.abortSignal) } }) as never;

// A fresh pool per test: model health is process-wide in production and must not leak between cases.
const fresh = (timeoutMs?: number) => ({ pool: new ModelPool(), timeoutMs });

describe("generateWithFallback", () => {
  it("falls through overloaded (503) models to one that works", async () => {
    const ai = fakeAi({
      a: async () => { throw new Error("got status: 503 UNAVAILABLE high demand"); },
      b: async () => ({ text: "ok-from-b" }),
    });
    const res = (await generateWithFallback(ai, ["a", "b"], { contents: [] }, fresh())) as { text: string };
    expect(res.text).toBe("ok-from-b");
  });

  it("cancels a model that hangs past the timeout and falls through", async () => {
    let cancelled = false;
    const ai = fakeAi({
      slow: (signal) => new Promise(() => signal?.addEventListener("abort", () => (cancelled = true))),
      fast: async () => ({ text: "fast" }),
    });
    const res = (await generateWithFallback(ai, ["slow", "fast"], { contents: [] }, fresh(50))) as { text: string };
    expect(res.text).toBe("fast");
    expect(cancelled).toBe(true);
  });

  it("does not mask a real request error (400) by trying other models", async () => {
    let bCalled = false;
    const ai = fakeAi({
      a: async () => { throw new Error("400 INVALID_ARGUMENT bad schema"); },
      b: async () => { bCalled = true; return {}; },
    });
    await expect(generateWithFallback(ai, ["a", "b"], { contents: [] }, fresh())).rejects.toThrow(/INVALID_ARGUMENT/);
    expect(bCalled).toBe(false);
  });

  it("throws the last error when every model is unavailable", async () => {
    const ai = fakeAi({
      a: async () => { throw new Error("503 UNAVAILABLE"); },
      b: async () => { throw new Error("429 RESOURCE_EXHAUSTED"); },
    });
    await expect(generateWithFallback(ai, ["a", "b"], { contents: [] }, fresh())).rejects.toThrow(/429/);
  });

  it("parses a comma-separated model list", () => {
    expect(parseModelList(" a, b ,,c ")).toEqual(["a", "b", "c"]);
  });
});
