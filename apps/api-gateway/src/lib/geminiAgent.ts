import { env } from "./env.js";
import { buildGenAI, generateWithFallback, parseModelList } from "./genai.js";
import { TOOL_DECLARATIONS } from "../agent/tools.js";

export interface FunctionCall {
  name: string;
  args: Record<string, unknown>;
}

export interface AgentTurnResponse {
  functionCalls: FunctionCall[];
  /** null when the model made function calls instead of finishing with text. */
  text: string | null;
  /** The model's raw response parts (incl. thought signatures), to be echoed back on the next round. */
  rawParts?: unknown[];
}

// A minimal Gemini "content" shape — role + parts — good enough for the
// function-calling loop in agent/orchestrator.ts without depending on
// @google/genai's exact SDK types at the seam boundary.
export type AgentContent = { role: "user" | "model"; parts: unknown[] };

export interface GeminiAgentClient {
  generateTurn(systemInstruction: string, contents: AgentContent[]): Promise<AgentTurnResponse>;
}

export function createGeminiAgentClient(): GeminiAgentClient {
  const ai = buildGenAI();

  return {
    async generateTurn(systemInstruction, contents) {
      // An officer is waiting on the other end: fail over fast rather than sit on a hung model.
      const response = await generateWithFallback(
        ai,
        parseModelList(env.geminiAgentModel),
        {
          contents: contents as never,
          config: {
            systemInstruction,
            tools: [{ functionDeclarations: TOOL_DECLARATIONS as never }],
          },
        },
        { timeoutMs: 12_000, deadlineMs: 40_000 },
      );

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      const functionCalls: FunctionCall[] = parts
        .filter((p): p is { functionCall: { name: string; args?: Record<string, unknown> } } =>
          Boolean((p as { functionCall?: unknown }).functionCall),
        )
        .map((p) => ({ name: p.functionCall.name, args: p.functionCall.args ?? {} }));

      if (functionCalls.length > 0) return { functionCalls, text: null, rawParts: parts as unknown[] };

      const text = parts
        .filter((p): p is { text: string } => typeof (p as { text?: unknown }).text === "string")
        .map((p) => p.text)
        .join("");
      return { functionCalls: [], text: text || null };
    },
  };
}
