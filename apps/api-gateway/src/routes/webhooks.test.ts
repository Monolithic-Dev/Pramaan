import { describe, it, expect } from "vitest";
import { buildApp } from "../app.js";
import { createFakeDeps } from "../testUtils/fakeDeps.js";

// WEBHOOK_SHARED_SECRET is unset in the test environment, so signature
// verification is a no-op here (see lib/env.ts) — that branch is exercised
// manually once a real provider account exists (phase-3-manual-checklist.md).

describe("POST /webhooks/whatsapp", () => {
  it("maps a WhatsApp payload to a Submission and returns 202", async () => {
    const app = buildApp(createFakeDeps());
    const response = await app.inject({
      method: "POST",
      url: "/v1/webhooks/whatsapp",
      payload: { from: "+919812345678", message_id: "wamid.abc123", text: "pothole on my street" },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json().submission_id).toMatch(/^sub_/);
  });

  it("replaying the same message_id returns the original submission_id", async () => {
    const deps = createFakeDeps();
    const app = buildApp(deps);
    const payload = { from: "+919812345678", message_id: "wamid.dup1", text: "same report" };

    const first = await app.inject({ method: "POST", url: "/v1/webhooks/whatsapp", payload });
    const second = await app.inject({ method: "POST", url: "/v1/webhooks/whatsapp", payload });

    expect(second.json().submission_id).toBe(first.json().submission_id);
  });

  it("rejects a payload missing from/message_id with 400 VALIDATION_ERROR", async () => {
    const app = buildApp(createFakeDeps());
    const response = await app.inject({
      method: "POST",
      url: "/v1/webhooks/whatsapp",
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
      payload: { from: "+919812345678", message_id: "sms_1", text: "gaddha hai sadak par" },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json().submission_id).toMatch(/^sub_/);
  });
});
