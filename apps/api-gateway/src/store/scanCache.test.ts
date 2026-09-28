import { describe, expect, it } from "vitest";
import { issue } from "../testUtils/fixtures.js";
import { withScanCache } from "./firestoreStore.js";
import { createInMemoryStore } from "./inMemoryStore.js";

describe("withScanCache", () => {
  it("reuses a scan, refreshes it after a gateway write, and hands each caller its own array", async () => {
    const raw = createInMemoryStore();
    const store = withScanCache(raw, 60_000);
    const a = issue({ issue_id: "a" });
    raw.issues.set("a", a);
    expect(await store.listIssues()).toHaveLength(1);

    // A write the gateway did not make (the worker's) is not seen until the TTL passes...
    raw.issues.set("b", issue({ issue_id: "b" }));
    const cached = await store.listIssues();
    expect(cached).toHaveLength(1);

    // ...and sorting one caller's result does not reorder anyone else's.
    cached.reverse();
    cached.pop();
    expect(await store.listIssues()).toHaveLength(1);

    // A write through the store drops the cache.
    await store.updateIssue("a", { status: "verified" });
    const fresh = await store.listIssues();
    expect(fresh).toHaveLength(2);
    expect(fresh.find((i) => i.issue_id === "a")?.status).toBe("verified");
  });

  it("is off with a zero TTL", async () => {
    const raw = createInMemoryStore();
    expect(withScanCache(raw, 0)).toBe(raw);
  });
});
