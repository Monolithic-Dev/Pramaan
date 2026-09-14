import { describe, it, expect } from "vitest";
import { buildApp } from "./app.js";

describe("POST /pubsub-push", () => {
  it("accepts a push payload and returns 204", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/pubsub-push",
      payload: { message: { data: "eyJ0ZXN0IjogdHJ1ZX0=" } },
    });

    expect(response.statusCode).toBe(204);
  });
});
