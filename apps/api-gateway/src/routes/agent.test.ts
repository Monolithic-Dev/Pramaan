import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { createFakeDeps } from "../testUtils/fakeDeps.js";

function officerHeaders(deps: ReturnType<typeof createFakeDeps>, regionId = "LGD:ward-1") {
  deps.tokens.set("officer-token", {
    uid: "officer_1",
    claims: { role: "district_collector", region_id: regionId, country_code: "IN" },
  });
  return { authorization: "Bearer officer-token" };
}

describe("POST /agent/sessions", () => {
  it("pins the session to the requested scope when it's within the officer's jurisdiction", async () => {
    const deps = createFakeDeps();
    const app = buildApp(deps);
    const headers = officerHeaders(deps);

    const response = await app.inject({
      method: "POST",
      url: "/v1/agent/sessions",
      payload: { region_scope: "LGD:ward-1" },
      headers,
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().session_id).toMatch(/^sess_/);
  });

  it("rejects a session scope outside the officer's jurisdiction with JURISDICTION_MISMATCH", async () => {
    const deps = createFakeDeps();
    const app = buildApp(deps);
    const headers = officerHeaders(deps, "LGD:ward-1");

    const response = await app.inject({
      method: "POST",
      url: "/v1/agent/sessions",
      payload: { region_scope: "LGD:other-state" },
      headers,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("JURISDICTION_MISMATCH");
  });

  it("requires an officer token", async () => {
    const app = buildApp(createFakeDeps());
    const response = await app.inject({
      method: "POST",
      url: "/v1/agent/sessions",
      payload: { region_scope: "LGD:ward-1" },
    });
    expect(response.statusCode).toBe(401);
  });
});

describe("POST /agent/sessions/:sessionId/messages", () => {
  it("streams tool_call before token, and persists the turn", async () => {
    const deps = createFakeDeps();
    const app = buildApp(deps);
    const headers = officerHeaders(deps);

    const created = await app.inject({
      method: "POST",
      url: "/v1/agent/sessions",
      payload: { region_scope: "LGD:ward-1" },
      headers,
    });
    const { session_id } = created.json();

    deps.nextAgentResponses.push(
      { functionCalls: [{ name: "list_available_data", args: { region_id: "LGD:ward-1" } }], text: null },
      { functionCalls: [], text: "No demand data recorded here yet." },
    );

    const response = await app.inject({
      method: "POST",
      url: `/v1/agent/sessions/${session_id}/messages`,
      payload: { text: "What's happening in Ward 14?" },
      headers,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/event-stream");
    const toolCallIndex = response.payload.indexOf("event: tool_call");
    const tokenIndex = response.payload.indexOf("event: token");
    const doneIndex = response.payload.indexOf("event: done");
    expect(toolCallIndex).toBeGreaterThanOrEqual(0);
    expect(toolCallIndex).toBeLessThan(tokenIndex);
    expect(tokenIndex).toBeLessThan(doneIndex);

    const persisted = await deps.store.getAgentTurns(session_id);
    expect(persisted).toHaveLength(1);
  });

  it("returns 404 for a session that doesn't exist", async () => {
    const deps = createFakeDeps();
    const app = buildApp(deps);
    const headers = officerHeaders(deps);

    const response = await app.inject({
      method: "POST",
      url: "/v1/agent/sessions/does-not-exist/messages",
      payload: { text: "hi" },
      headers,
    });
    expect(response.statusCode).toBe(404);
  });
});

describe("GET /audit/agent-turns", () => {
  it("requires the state_admin role", async () => {
    const deps = createFakeDeps();
    const app = buildApp(deps);
    const headers = officerHeaders(deps); // role: "district_collector", not state_admin

    const response = await app.inject({ method: "GET", url: "/v1/audit/agent-turns", headers });
    expect(response.statusCode).toBe(401);
  });

  it("returns turns for a state_admin caller", async () => {
    const deps = createFakeDeps();
    deps.tokens.set("admin-token", {
      uid: "admin_1",
      claims: { role: "state_admin", region_id: "LGD:state-1", country_code: "IN" },
    });
    const app = buildApp(deps);

    const response = await app.inject({
      method: "GET",
      url: "/v1/audit/agent-turns",
      headers: { authorization: "Bearer admin-token" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().turns).toEqual([]);
  });
});
