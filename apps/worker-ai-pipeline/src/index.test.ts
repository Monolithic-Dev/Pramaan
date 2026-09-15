import { describe, it, expect } from "vitest";
import { buildApp } from "./app.js";
import { createFakeDeps } from "./testUtils/fakeDeps.js";

function pushPayload(obj: unknown) {
  return { message: { data: Buffer.from(JSON.stringify(obj)).toString("base64") } };
}

describe("POST /pubsub-push", () => {
  it("acks with 204 when the payload has no submission_id", async () => {
    const app = buildApp(createFakeDeps());
    const response = await app.inject({
      method: "POST",
      url: "/pubsub-push",
      payload: { message: { data: "eyJ0ZXN0IjogdHJ1ZX0=" } },
    });

    expect(response.statusCode).toBe(204);
  });

  it("acks with 204 for a submission_id that doesn't exist (nothing to process)", async () => {
    const app = buildApp(createFakeDeps());
    const response = await app.inject({
      method: "POST",
      url: "/pubsub-push",
      payload: pushPayload({ submission_id: "sub_does_not_exist" }),
    });

    expect(response.statusCode).toBe(204);
  });

  it("acks with 204 on malformed base64/JSON instead of retrying forever", async () => {
    const app = buildApp(createFakeDeps());
    const response = await app.inject({
      method: "POST",
      url: "/pubsub-push",
      payload: { message: { data: "not-valid-base64-json!!" } },
    });

    expect(response.statusCode).toBe(204);
  });
});
