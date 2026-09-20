import { withRetry } from "@jansetu/shared-utils";
import { env } from "./env.js";
import { buildGenAI } from "./genai.js";
import { TOOL_DECLARATIONS } from "../agent/tools.js";

export interface FunctionCall {
  name: string;
  args: Record<string, unknown>;
}

export interface AgentTurnResponse {
  functionCalls: FunctionCall[];
  /** null when the model made function calls instead of finishing with text. */
  text: string | null;
}

// A minimal Gemini "content" shape — role + parts — good enough for the
// function-calling loop in agent/orchestrator.ts without depending on
// @google/genai's exact SDK types at the seam boundary.
export type AgentContent = { role: "user" | "model" | "function"; parts: unknown[] };

export interface GeminiAgentClient {
  generateTurn(systemInstruction: string, contents: AgentContent[]): Promise<AgentTurnResponse>;
}

export function createGeminiAgentClient(): GeminiAgentClient {
  const ai = buildGenAI();

  return {
    async generateTurn(systemInstruction, contents) {
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: env.geminiAgentModel,
          contents: contents as never,
          config: {
            systemInstruction,
            tools: [{ functionDeclarations: TOOL_DECLARATIONS as never }],
          },
        }),
      );

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      const functionCalls: FunctionCall[] = parts
        .filter((p): p is { functionCall: { name: string; args?: Record<string, unknown> } } =>
          Boolean((p as { functionCall?: unknown }).functionCall),
        )
        .map((p) => ({ name: p.functionCall.name, args: p.functionCall.args ?? {} }));

      if (functionCalls.length > 0) return { functionCalls, text: null };

      const text = parts
        .filter((p): p is { text: string } => typeof (p as { text?: unknown }).text === "string")
        .map((p) => p.text)
        .join("");
      return { functionCalls: [], text: text || null };
    },
  };
}
