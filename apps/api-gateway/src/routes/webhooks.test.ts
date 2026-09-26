import { afterEach, beforeEach, describe, it, expect } from "vitest";
import { buildApp } from "../app.js";
import { env } from "../lib/env.js";
import { createFakeDeps } from "../testUtils/fakeDeps.js";

const SECRET = "test-webhook-secret";
const signed = { "x-webhook-secret": SECRET };

beforeEach(() => {
  env.webhookSharedSecret = SECRET;
});
afterEach(() => {
  env.webhookSharedSecret = "";
});

describe("webhook authentication", () => {
  it("is disabled (503) when no shared secret is configured", async () => {
    env.webhookSharedSecret = "";
    const app = buildApp(createFakeDeps());
    const response = await app.inject({
      method: "POST",
      url: "/v1/webhooks/whatsapp",
      payload: { from: "+919812345678", message_id: "wamid.open", text: "pothole" },
    });
    expect(response.statusCode).toBe(503);
  });

  it("rejects a missing or wrong secret with 401", async () => {
    const app = buildApp(createFakeDeps());
    const payload = { from: "+919812345678", message_id: "wamid.bad", text: "pothole" };
    const missing = await app.inject({ method: "POST", url: "/v1/webhooks/sms", payload });
    const wrong = await app.inject({ method: "POST", url: "/v1/webhooks/sms", payload, headers: { "x-webhook-secret": "nope" } });
    expect(missing.statusCode).toBe(401);
    expect(wrong.statusCode).toBe(401);
  });
});

describe("POST /webhooks/whatsapp", () => {
  it("maps a WhatsApp payload to a Submission and returns 202", async () => {
    const app = buildApp(createFakeDeps());
    const response = await app.inject({
      method: "POST",
      url: "/v1/webhooks/whatsapp",
      headers: signed,
      payload: { from: "+919812345678", message_id: "wamid.abc123", text: "pothole on my street" },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json().submission_id).toMatch(/^sub_/);
  });

  it("replaying the same message_id returns the original submission_id", async () => {
    const deps = createFakeDeps();
    const app = buildApp(deps);
    const payload = { from: "+919812345678", message_id: "wamid.dup1", text: "same report" };

    const first = await app.inject({ method: "POST", url: "/v1/webhooks/whatsapp", headers: signed, payload });
    const second = await app.inject({ method: "POST", url: "/v1/webhooks/whatsapp", headers: signed, payload });

    expect(second.json().submission_id).toBe(first.json().submission_id);
  });

  it("rejects a payload missing from/message_id with 400 VALIDATION_ERROR", async () => {
    const app = buildApp(createFakeDeps());
    const response = await app.inject({
      method: "POST",
      url: "/v1/webhooks/whatsapp",
      headers: signed,
      payload: { text: "no sender info" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /webhooks/sms", () => {
  it("maps an SMS payload to a Submission and returns 202", async () => {
    const app = buildApp(createFakeDeps());
    const response = await app.inject({
      method: "POST",
      url: "/v1/webhooks/sms",
      headers: signed,
      payload: { from: "+919812345678", message_id: "sms_1", text: "gaddha hai sadak par" },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json().submission_id).toMatch(/^sub_/);
  });
});
