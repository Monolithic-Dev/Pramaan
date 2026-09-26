import { describe, expect, it } from "vitest";
import { COOLDOWN_MS, ModelPool } from "./modelFallback.js";

const hang = (signal: AbortSignal) => new Promise<string>((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted"))));

describe("ModelPool", () => {
  it("cancels a hung model at its timeout and falls through to the next", async () => {
    const pool = new ModelPool();
    let aborted = false;
    const result = await pool.call(
      ["slow", "fast"],
      (model, signal) => {
        if (model === "slow") {
          signal.addEventListener("abort", () => (aborted = true));
          return hang(signal);
        }
        return Promise.resolve(`answer from ${model}`);
      },
      { timeoutMs: 20 },
    );
    expect(result).toBe("answer from fast");
    expect(aborted).toBe(true);
  });

  it("skips a model in cooldown and leads with the one that last worked", async () => {
    let t = 1_000_000;
    const pool = new ModelPool(() => t);
    const tried: string[] = [];
    const attempt = (model: string, signal: AbortSignal) => {
      tried.push(model);
      return model === "a" ? Promise.reject(new Error("503 high demand")) : model === "b" ? hang(signal) : Promise.resolve(model);
    };

    await pool.call(["a", "b", "c"], attempt, { timeoutMs: 20 });
    expect(tried).toEqual(["a", "b", "c"]);

    tried.length = 0;
    await pool.call(["a", "b", "c"], attempt, { timeoutMs: 20 });
    expect(tried).toEqual(["c"]);

    // After the busy cooldown "a" is tried again, but "c" (last good) still leads.
    t += COOLDOWN_MS.busy + 1;
    expect(pool.order(["a", "b", "c"])).toEqual(["c", "a", "b"]);
  });

  it("still tries cooling models as a last resort rather than failing outright", async () => {
    const pool = new ModelPool();
    await expect(pool.call(["x"], () => Promise.reject(new Error("503")), { timeoutMs: 20 })).rejects.toThrow("503");
    await expect(pool.call(["x"], () => Promise.resolve("ok"), { timeoutMs: 20 })).resolves.toBe("ok");
  });

  it("throws a non-retryable error immediately instead of trying every model", async () => {
    const pool = new ModelPool();
    const tried: string[] = [];
    await expect(
      pool.call(["a", "b"], (m) => { tried.push(m); return Promise.reject(new Error("400 invalid schema")); }, { timeoutMs: 20 }),
    ).rejects.toThrow("400");
    expect(tried).toEqual(["a"]);
  });

  it("stops at the overall deadline", async () => {
    const pool = new ModelPool();
    const tried: string[] = [];
    await expect(
      pool.call(["a", "b", "c"], (m, s) => { tried.push(m); return hang(s); }, { timeoutMs: 30, deadlineMs: 50 }),
    ).rejects.toThrow("timed out");
    expect(tried.length).toBeLessThan(3);
  });
});
