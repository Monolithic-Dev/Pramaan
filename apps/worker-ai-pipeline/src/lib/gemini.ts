import { GoogleGenAI } from "@google/genai";
import {
  CATEGORIZATION_RESPONSE_SCHEMA,
  CATEGORIZATION_SYSTEM_PROMPT,
  type CategorizationResult,
} from "@pramaan/ai-prompts";
import { z } from "zod";
import { env } from "./env.js";
import { buildGenAI, generateWithFallback, parseModelList } from "./genai.js";

const categorizationResultSchema = z.object({
  category: z.enum(["water", "roads", "electricity", "sanitation", "health_infra", "education_infra", "other"]),
  subcategory: z.string(),
  severity_estimate: z.enum(["low", "medium", "high"]),
  extracted_location_text: z.string().nullable().default(null),
  summary: z.string(),
  language: z.string().optional(),
  english_translation: z.string().optional(),
  confidence: z.number(),
  contains_personal_emergency: z.boolean(),
});

export interface CategorizationClient {
  /**
   * docs/EDGE_CASES.md #9: schema validation + one retry with a stricter
   * prompt; if still malformed, returns null so the caller can fall back to
   * raw-text-only categorization — the submission is never silently dropped.
   */
  categorize(text: string): Promise<CategorizationResult | null>;
}

async function requestCategorization(
  ai: GoogleGenAI,
  text: string,
  strict: boolean,
): Promise<CategorizationResult | null> {
  const response = await generateWithFallback(ai, parseModelList(env.geminiModel), {
      contents: [{ role: "user", parts: [{ text }] }],
      config: {
        systemInstruction: strict
          ? `${CATEGORIZATION_SYSTEM_PROMPT}\n\nReturn ONLY valid JSON matching the schema exactly — no prose, no markdown fences.`
          : CATEGORIZATION_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: CATEGORIZATION_RESPONSE_SCHEMA,
      },
  });

  const raw = response.text;
  if (!raw) return null;
  try {
    const parsed = categorizationResultSchema.parse(JSON.parse(raw));
    return parsed;
  } catch {
    return null;
  }
}

export function createCategorizationClient(): CategorizationClient {
  const ai = buildGenAI();
  return {
    async categorize(text) {
      const first = await requestCategorization(ai, text, false);
      if (first) return first;
      return requestCategorization(ai, text, true);
    },
  };
}
