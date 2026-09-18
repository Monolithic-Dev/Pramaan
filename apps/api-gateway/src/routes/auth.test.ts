import { describe, it, expect } from "vitest";
import { buildApp } from "../app.js";
import { createFakeDeps } from "../testUtils/fakeDeps.js";

describe("POST /auth/otp/request", () => {
  it("with a valid E.164 phone returns 202 and a request_id", async () => {
    const app = buildApp(createFakeDeps());
    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/otp/request",
      payload: { phone: "+919812345678" },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json().request_id).toBeTruthy();
  });

  it("with a malformed phone returns 400 VALIDATION_ERROR", async () => {
    const app = buildApp(createFakeDeps());
    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/otp/request",
      payload: { phone: "9812345678" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /auth/otp/verify", () => {
  it("with a valid OTP returns a citizen_token and a Citizen doc with a hashed phone", async () => {
    const deps = createFakeDeps();
    const app = buildApp(deps);

    const requestResponse = await app.inject({
      method: "POST",
      url: "/v1/auth/otp/request",
      payload: { phone: "+919812345678" },
    });
    const { request_id } = requestResponse.json();

    const verifyResponse = await app.inject({
      method: "POST",
      url: "/v1/auth/otp/verify",
      payload: { request_id, otp: "111111" },
    });

    expect(verifyResponse.statusCode).toBe(200);
    const body = verifyResponse.json();
    expect(body.citizen_token).toBeTruthy();
    expect(body.citizen_id).toBeTruthy();

    const citizen = await deps.store.getCitizen(body.citizen_id);
    expect(citizen?.phone_hash).toMatch(/^sha256:/);
    expect(citizen?.phone_hash).not.toContain("+919812345678");
  });

  it("creates a Brazilian citizen with pt-BR preferred_language when country_code=BR is passed", async () => {
    const deps = createFakeDeps();
    const app = buildApp(deps);

    const requestResponse = await app.inject({
      method: "POST",
      url: "/v1/auth/otp/request",
      payload: { phone: "+5511987654321", country_code: "BR" },
    });
    const { request_id } = requestResponse.json();

    const verifyResponse = await app.inject({
      method: "POST",
      url: "/v1/auth/otp/verify",
      payload: { request_id, otp: "111111", country_code: "BR" },
    });

    expect(verifyResponse.statusCode).toBe(200);
    const citizen = await deps.store.getCitizen(verifyResponse.json().citizen_id);
    expect(citizen?.country_code).toBe("BR");
    expect(citizen?.preferred_language).toBe("pt-BR");
  });

  it("with an incorrect OTP returns 500-level failure, never leaking a token", async () => {
    const deps = createFakeDeps();
    const app = buildApp(deps);

    const requestResponse = await app.inject({
      method: "POST",
      url: "/v1/auth/otp/request",
      payload: { phone: "+919812345678" },
    });
    const { request_id } = requestResponse.json();

    const verifyResponse = await app.inject({
      method: "POST",
      url: "/v1/auth/otp/verify",
      payload: { request_id, otp: "000000" },
    });

    expect(verifyResponse.statusCode).toBeGreaterThanOrEqual(400);
    expect(verifyResponse.json().citizen_token).toBeUndefined();
  });
});
