import { describe, it, expect } from "vitest";
import { buildApp } from "./app.js";
import { createFakeDeps } from "./testUtils/fakeDeps.js";

describe("GET /healthz", () => {
  it("returns 200 and {status: 'ok'}", async () => {
    const app = buildApp(createFakeDeps());
    const response = await app.inject({ method: "GET", url: "/healthz" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });
});
