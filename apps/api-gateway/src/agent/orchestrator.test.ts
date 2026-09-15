import { describe, expect, it, vi } from "vitest";
import type { AgentSession, Issue } from "@jansetu/shared-types";
import { createFakeDeps } from "../testUtils/fakeDeps.js";
import { runAgentTurn, type AgentEvent } from "./orchestrator.js";

function makeSession(overrides: Partial<AgentSession> = {}): AgentSession {
  return {
    session_id: "sess_1",
    officer_id: "officer_1",
    country_code: "IN",
    state_id: "UNRESOLVED",
    region_scope: "LGD:ward-1",
    started_at: "2026-09-15T00:00:00Z",
    turn_count: 0,
    ...overrides,
  };
}

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    issue_id: "iss_1",
    country_code: "IN",
    state_id: "UNRESOLVED",
    category: "roads",
    subcategory: "pothole",
    canonical_description: "Large pothole",
    embedding: null,
    embedding_model: null,
    geo_cluster_id: "gc_1",
    admin_region_id: "LGD:ward-1",
    geohash: null,
    submission_ids: [],
    report_count: 14,
    distinct_reporter_count: 11,
    first_reported_at: "2026-09-10T08:00:00Z",
    last_reported_at: "2026-09-14T18:20:00Z",
    emergency_override: false,
    fraud_flags: [],
    status: "open",
    composite_score: null,
    latest_score_id: null,
    ...overrides,
  };
}

describe("runAgentTurn", () => {
  it("answers with a grounded response after a tool call, and events arrive in the right order", async () => {
    const deps = createFakeDeps();
    deps.store.issues.set("iss_1", makeIssue());
    deps.nextAgentResponses.push(
      { functionCalls: [{ name: "query_fused_data", args: { region_id: "LGD:ward-1" } }], text: null },
      { functionCalls: [], text: "Ward 14 has 14 reports about roads." },
    );

    const events: AgentEvent["event"][] = [];
    const turn = await runAgentTurn(deps, makeSession(), "What roads issues are here?", (e) =>
      events.push(e.event),
    );

    expect(turn.refused).toBe(false);
    expect(turn.agent_response).toContain("14 reports");
    expect(turn.tool_calls).toHaveLength(1);
    expect(turn.tool_calls[0].tool).toBe("query_fused_data");
    // tool_call/tool_result must land before the token event.
    expect(events.indexOf("tool_call")).toBeLessThan(events.indexOf("token"));
    expect(events.indexOf("tool_result")).toBeLessThan(events.indexOf("token"));
    expect(events.at(-1)).toBe("done");
  });

  it("refuses a query for a region outside the session's pinned scope without ever querying it", async () => {
    const deps = createFakeDeps();
    // Data exists for the out-of-scope region — if scope enforcement failed,
    // this data would leak into the answer.
    deps.store.issues.set("iss_1", makeIssue({ admin_region_id: "LGD:other-state" }));
    const spy = vi.spyOn(deps.store, "getIssuesByRegion");

    deps.nextAgentResponses.push(
      {
        functionCalls: [{ name: "query_fused_data", args: { region_id: "LGD:other-state" } }],
        text: null,
      },
      { functionCalls: [], text: "I don't have access to that region." },
    );

    await runAgentTurn(deps, makeSession({ region_scope: "LGD:ward-1" }), "Show me all states");

    // The tool layer must refuse before the query ever runs.
    expect(spy).not.toHaveBeenCalled();
  });

  it("refuses after max tool rounds instead of looping forever", async () => {
    const deps = createFakeDeps();
    for (let i = 0; i < 6; i++) {
      deps.nextAgentResponses.push({
        functionCalls: [{ name: "list_available_data", args: { region_id: "LGD:ward-1" } }],
        text: null,
      });
    }

    const turn = await runAgentTurn(deps, makeSession(), "keep looking forever");

    expect(turn.refused).toBe(true);
    expect(turn.refusal_reason).toBe("max_tool_rounds_exceeded");
    expect(turn.tool_calls).toHaveLength(5); // MAX_TOOL_ROUNDS, not 6
  });

  it("forces a refusal rather than retrying a hallucinated number into a passing answer", async () => {
    const deps = createFakeDeps();
    deps.nextAgentResponses.push(
      { functionCalls: [], text: "There are 500 unresolved issues here." },
      { functionCalls: [], text: "There are actually 900 unresolved issues here." },
    );

    const turn = await runAgentTurn(deps, makeSession(), "how many issues");

    expect(turn.refused).toBe(true);
    expect(turn.refusal_reason).toBe("ungrounded_claims_after_regeneration");
  });

  it("accepts a regenerated answer once it drops the ungrounded number", async () => {
    const deps = createFakeDeps();
    deps.store.issues.set("iss_1", makeIssue());
    deps.nextAgentResponses.push(
      {
        functionCalls: [{ name: "query_fused_data", args: { region_id: "LGD:ward-1" } }],
        text: null,
      },
      { functionCalls: [], text: "There are 500 issues here." }, // hallucinated
      { functionCalls: [], text: "There are 14 reports here." }, // grounded, matches report_count
    );

    const turn = await runAgentTurn(deps, makeSession(), "how many issues");

    expect(turn.refused).toBe(false);
    expect(turn.agent_response).toContain("14");
  });

  it("writes a complete AgentTurn with a result_hash on every tool call", async () => {
    const deps = createFakeDeps();
    deps.store.issues.set("iss_1", makeIssue());
    deps.nextAgentResponses.push(
      { functionCalls: [{ name: "query_fused_data", args: { region_id: "LGD:ward-1" } }], text: null },
      { functionCalls: [], text: "There are 14 reports here." },
    );

    const turn = await runAgentTurn(deps, makeSession(), "how many issues");

    expect(turn.tool_calls[0].result_hash).toBeTruthy();
    const persisted = await deps.store.getAgentTurns("sess_1");
    expect(persisted).toHaveLength(1);
    expect(persisted[0].turn_id).toBe(turn.turn_id);
  });
});
