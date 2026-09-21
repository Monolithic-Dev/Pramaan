import { describe, expect, it } from "vitest";
import { generateWithFallback, parseModelList } from "./genai.js";

const fakeAi = (behaviour: Record<string, () => Promise<unknown>>) =>
  ({ models: { generateContent: ({ model }: { model: string }) => behaviour[model]() } }) as never;

describe("generateWithFallback", () => {
  it("falls through overloaded (503) models to one that works", async () => {
    const ai = fakeAi({
      a: async () => { throw new Error("got status: 503 UNAVAILABLE high demand"); },
      b: async () => ({ text: "ok-from-b" }),
    });
    const res = (await generateWithFallback(ai, ["a", "b"], { contents: [] })) as { text: string };
    expect(res.text).toBe("ok-from-b");
  });

  it("falls through a model that hangs past the timeout", async () => {
    const ai = fakeAi({
      slow: () => new Promise(() => undefined),
      fast: async () => ({ text: "fast" }),
    });
    const res = (await generateWithFallback(ai, ["slow", "fast"], { contents: [] }, 50)) as { text: string };
    expect(res.text).toBe("fast");
  });

  it("does not mask a real request error (400) by trying other models", async () => {
    let bCalled = false;
    const ai = fakeAi({
      a: async () => { throw new Error("400 INVALID_ARGUMENT bad schema"); },
      b: async () => { bCalled = true; return {}; },
    });
    await expect(generateWithFallback(ai, ["a", "b"], { contents: [] })).rejects.toThrow(/INVALID_ARGUMENT/);
    expect(bCalled).toBe(false);
  });

  it("throws the last error when every model is unavailable", async () => {
    const ai = fakeAi({
      a: async () => { throw new Error("503 UNAVAILABLE"); },
      b: async () => { throw new Error("429 RESOURCE_EXHAUSTED"); },
    });
    await expect(generateWithFallback(ai, ["a", "b"], { contents: [] })).rejects.toThrow(/429/);
  });

  it("parses a comma-separated model list", () => {
    expect(parseModelList(" a, b ,,c ")).toEqual(["a", "b", "c"]);
  });
});
