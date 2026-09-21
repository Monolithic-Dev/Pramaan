import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { createFakeDeps } from "../testUtils/fakeDeps.js";

describe("client IP behind a reverse proxy", () => {
  it("uses the address the proxy appended, not a client-supplied X-Forwarded-For", async () => {
    const app = buildApp(createFakeDeps());
    app.get("/_ip", async (request) => ({ ip: request.ip }));
    const res = await app.inject({
      method: "GET",
      url: "/_ip",
      remoteAddress: "10.0.0.1", // the platform proxy
      headers: { "x-forwarded-for": "6.6.6.6, 203.0.113.9" }, // spoofed entry, then the real client
    });
    expect(res.json().ip).toBe("203.0.113.9");
  });
});

describe("idempotent replay across networks", () => {
  it("returns the original submission when the same request is retried from a different IP", async () => {
    const app = buildApp(createFakeDeps());
    const payload = { channel: "web", text: "pothole on main road", lat: 28.6, lng: 77.2, consent_version: "v1" };
    const send = (ip: string) =>
      app.inject({
        method: "POST",
        url: "/v1/submissions",
        remoteAddress: "10.0.0.1",
        headers: { "idempotency-key": "same-key-1", "x-forwarded-for": ip },
        payload,
      });
    const first = await send("203.0.113.1");
    const retry = await send("198.51.100.2"); // phone moved from Wi-Fi to mobile data
    expect(first.statusCode).toBe(202);
    expect(retry.statusCode).toBe(202);
    expect(retry.json().submission_id).toBe(first.json().submission_id);
  });
});
