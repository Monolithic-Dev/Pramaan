import { createHash, randomUUID } from "node:crypto";
import type { AgentCitation, AgentSession, AgentToolCall, AgentTurn } from "@pramaan/shared-types";
import type { Deps } from "../deps.js";
import type { AgentContent } from "../lib/geminiAgent.js";
import { executeTool, extractScopeTarget, type ToolName } from "./tools.js";
import { isWithinScope } from "./scopeGuard.js";
import { extractNumerals, stripUngroundedSentences, verifyGrounded } from "./groundedness.js";

export const AGENT_PROMPT_VERSION = "agent-v2";
const MAX_TOOL_ROUNDS = 5;
// Longer than one model call's own deadline (lib/geminiAgent.ts), so a slow first call on a
// congested model does not by itself turn a good question into a refusal.
const TURN_BUDGET_MS = 55_000;

const SYSTEM_INSTRUCTION = `You answer questions from government officers about infrastructure
demand in their jurisdiction.

Rules:
- Every number you state must come from a tool result in this conversation.
  Never estimate, never recall, never interpolate.
- If tools return no_data, say what is missing and offer an alternative
  (a wider region, a different timeframe, or demand data without investment data).
- When data is marked data_origin=synthetic_demo, say so in your answer.
- When a score used a fallback data level, mention it.
- Prefer three sourced sentences over a paragraph of context.

How to answer well:
- For "top", "most urgent" or "what first" questions, call get_priority_scores once, with the
  category the officer named and only_unaddressed=true when they ask about unaddressed or
  pending work. Its rows already say whether each issue is funded; do not look issues up one by one.
- Name issues by their description and area (e.g. "the pothole on Main Market Road, Central
  Delhi"), not by internal ids or region codes. Put an issue id in brackets only if the officer
  asked for ids.
- Answer in the language the officer wrote in.`;

function hashResult(result: unknown): string {
  return createHash("sha256").update(JSON.stringify(result)).digest("hex").slice(0, 16);
}

function buildCitations(text: string, toolCalls: { tool: string; result: unknown }[]): AgentCitation[] {
  const citations: AgentCitation[] = [];
  for (const numeral of extractNumerals(text)) {
    const start = text.indexOf(numeral);
    if (start === -1) continue;
    const source = toolCalls.find((tc) => JSON.stringify(tc.result).includes(numeral));
    if (source) citations.push({ span: [start, start + numeral.length], source: `tool:${source.tool}` });
  }
  return citations;
}

function refusalMessage(reason: string): string {
  switch (reason) {
    case "turn_budget_exceeded":
      return "I'm taking too long to gather this data. Try a narrower question or a smaller region.";
    case "max_tool_rounds_exceeded":
      return "I couldn't find a confident answer within the allowed number of data lookups. Try narrowing the question.";
    case "ungrounded_claims_after_regeneration":
      return "I can't produce an answer I can fully back with the retrieved data. Try asking about a narrower region or timeframe.";
    default:
      return "I don't have enough verified data to answer that.";
  }
}

export type AgentEvent =
  | { event: "tool_call"; data: { tool: string; params: Record<string, unknown>; status: "running" } }
  | { event: "tool_result"; data: { tool: string; row_count?: number; latency_ms: number } }
  | { event: "token"; data: { text: string } }
  | { event: "citation"; data: AgentCitation }
  | { event: "done"; data: { turn_id: string; refused: boolean; total_latency_ms: number; refusal_reason?: string } };

export async function runAgentTurn(
  deps: Deps,
  session: AgentSession,
  queryText: string,
  onEvent: (e: AgentEvent) => void = () => {},
): Promise<AgentTurn> {
  const start = Date.now();
  const toolCallLog: AgentToolCall[] = [];
  const toolResultsForVerification: unknown[] = [];
  const toolCallsForCitations: { tool: string; result: unknown }[] = [];
  // The model cannot see the session, so tell it the pinned scope: without this, "what data do
  // we have here?" makes it ask which region instead of using the officer's own.
  const systemInstruction =
    `${SYSTEM_INSTRUCTION}

This session is scoped to region_id "${session.region_scope}". ` +
    `When the officer says "here", "this region", "my area" or names no region, use region_id "${session.region_scope}".`;
  const contents: AgentContent[] = [{ role: "user", parts: [{ text: queryText }] }];

  let finalText: string | null = null;
  let refused = false;
  let refusalReason: string | null = null;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    if (Date.now() - start > TURN_BUDGET_MS) {
      refused = true;
      refusalReason = "turn_budget_exceeded";
      break;
    }

    const result = await deps.geminiAgent.generateTurn(systemInstruction, contents);
    if (result.functionCalls.length === 0) {
      finalText = result.text;
      break;
    }

    // Echo the model's own parts back verbatim (Gemini 3 attaches thought signatures to
    // function calls and rejects a follow-up that drops them).
    contents.push({
      role: "model",
      parts: result.rawParts ?? result.functionCalls.map((fc) => ({ functionCall: fc })),
    });

    const functionResponseParts: unknown[] = [];
    for (const call of result.functionCalls) {
      onEvent({ event: "tool_call", data: { tool: call.name, params: call.args, status: "running" } });
      const callStart = Date.now();
      const scopeTarget = await extractScopeTarget(deps, call.name as ToolName, call.args);
      let toolResult: unknown;

      if (!scopeTarget || !(await isWithinScope(deps.bigqueryAgent, scopeTarget, session.region_scope))) {
        // Refused at the tool layer — the query never executes (docs/phases/phase-6-agent-rag.md
        // acceptance criteria). A model-hallucinated or out-of-jurisdiction region_id lands here.
        toolResult = {
          status: "no_data",
          reason: `region is outside this session's jurisdiction (${session.region_scope})`,
          available_instead: [`data within ${session.region_scope}`],
        };
      } else {
        toolResult = await executeTool(deps, call.name as ToolName, call.args);
      }

      const latencyMs = Date.now() - callStart;
      const rowCount = Array.isArray(toolResult) ? toolResult.length : undefined;
      toolResultsForVerification.push(toolResult);
      toolCallsForCitations.push({ tool: call.name, result: toolResult });
      toolCallLog.push({
        tool: call.name,
        params: call.args,
        result_hash: hashResult(toolResult),
        latency_ms: latencyMs,
        row_count: rowCount,
      });
      onEvent({ event: "tool_result", data: { tool: call.name, row_count: rowCount, latency_ms: latencyMs } });
      // Gemini requires functionResponse.response to be a JSON *object*; a tool that returns
      // a list (or a scalar) is wrapped, otherwise the API rejects the whole turn with a 400.
      const responseObject =
        toolResult !== null && typeof toolResult === "object" && !Array.isArray(toolResult)
          ? toolResult
          : { result: toolResult };
      functionResponseParts.push({ functionResponse: { name: call.name, response: responseObject } });
    }
    // The Gemini API takes tool results as a "user" turn; the legacy "function" role is rejected.
    contents.push({ role: "user", parts: functionResponseParts });
  }

  if (!refused && finalText === null) {
    refused = true;
    refusalReason = "max_tool_rounds_exceeded";
  }

  let unverifiedClaims: string[] = [];
  if (!refused && finalText) {
    const verification = verifyGrounded(finalText, toolResultsForVerification);
    if (!verification.passed) {
      unverifiedClaims = verification.unverifiedClaims;
      const retryInstruction = `${systemInstruction}\n\nYour previous answer contained numbers that don't appear in the tool results: ${verification.unverifiedClaims.join(", ")}. Regenerate using ONLY numbers present in the tool results above, or say you don't have enough data.`;
      const retry = await deps.geminiAgent.generateTurn(retryInstruction, contents);
      const reverified = retry.text ? verifyGrounded(retry.text, toolResultsForVerification) : null;
      // Never retry a refusal into an answer (docs/phases/phase-6-agent-rag.md "Traps") —
      // exactly one regeneration attempt, then forced refusal if it still doesn't verify.
      if (retry.functionCalls.length === 0 && reverified?.passed) {
        finalText = retry.text;
      } else {
        unverifiedClaims = [...new Set([...unverifiedClaims, ...(reverified?.unverifiedClaims ?? [])])];
        refused = true;
        refusalReason = "ungrounded_claims_after_regeneration";
        finalText = null;
      }
    }
  }

  if (!refused && finalText) {
    // Layer 3: a numeral passing layer 2 only proves it appears *somewhere* in
    // the tool output, not that it's attached to the right claim — strip any
    // sentence whose numeral doesn't appear in an individual tool result.
    const stripped = stripUngroundedSentences(finalText, toolResultsForVerification);
    if (!stripped.trim()) {
      refused = true;
      refusalReason = "ungrounded_claims_after_regeneration";
      finalText = null;
    } else {
      finalText = stripped;
    }
  }

  const agentResponse = refused ? refusalMessage(refusalReason ?? "unknown") : (finalText ?? "");
  const citations = refused || !finalText ? [] : buildCitations(finalText, toolCallsForCitations);

  onEvent({ event: "token", data: { text: agentResponse } });
  for (const citation of citations) onEvent({ event: "citation", data: citation });

  const turn: AgentTurn = {
    turn_id: `turn_${randomUUID().slice(0, 8)}`,
    session_id: session.session_id,
    query_text: queryText,
    tool_calls: toolCallLog,
    agent_response: agentResponse,
    citations,
    refused,
    refusal_reason: refused ? refusalReason : null,
    ...(unverifiedClaims.length ? { unverified_claims: unverifiedClaims } : {}),
    prompt_version: AGENT_PROMPT_VERSION,
    total_latency_ms: Date.now() - start,
    timestamp: new Date().toISOString(),
  };

  onEvent({
    event: "done",
    data: {
      turn_id: turn.turn_id,
      refused,
      total_latency_ms: turn.total_latency_ms,
      ...(refusalReason ? { refusal_reason: refusalReason } : {}),
    },
  });

  await deps.store.putAgentTurn(turn);
  return turn;
}
