import { GoogleGenAI, type GenerateContentParameters } from "@google/genai";
import { env } from "./env.js";

// One place that decides how Gemini is reached: the public Gemini API when
// GEMINI_API_KEY is set (local dev / free hosting), Vertex AI + ADC otherwise (Cloud Run).
export function buildGenAI(): GoogleGenAI {
  if (env.geminiApiKey) return new GoogleGenAI({ apiKey: env.geminiApiKey });
  return new GoogleGenAI({ vertexai: true, project: env.gcpProjectId, location: env.vertexLocation });
}

/** "a, b ,c" -> ["a","b","c"] (model env vars accept a fallback chain). */
export function parseModelList(value: string): string[] {
  return value.split(",").map((m) => m.trim()).filter(Boolean);
}

const FALLBACK_SIGNS = /503|429|500|502|504|404|UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded|high demand|timed out|fetch failed|ECONNRESET|no longer available|not found/i;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Gemini call timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/**
 * Tries each model in order. New Gemini models are frequently overloaded (503) or
 * rate-limited (429) on free tiers, and a hung call would stall the whole pipeline, so
 * every attempt has a timeout and overload/quota/unknown-model errors fall through to the
 * next model. Real request errors (400: bad schema/prompt) are thrown immediately.
 */
export async function generateWithFallback(
  ai: GoogleGenAI,
  models: string[],
  params: Omit<GenerateContentParameters, "model">,
  timeoutMs = 25_000,
) {
  let lastError: unknown;
  for (const model of models) {
    try {
      return await withTimeout(ai.models.generateContent({ ...params, model }), timeoutMs);
    } catch (err) {
      lastError = err;
      if (!FALLBACK_SIGNS.test(String((err as Error)?.message ?? err))) throw err;
    }
  }
  throw lastError;
}
