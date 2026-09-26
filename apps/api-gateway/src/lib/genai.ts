import { GoogleGenAI, type GenerateContentParameters } from "@google/genai";
import { ModelPool } from "@pramaan/shared-utils";
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

/** Process-wide model health: shared by every Gemini call in this service. */
const defaultPool = new ModelPool();

export interface FallbackOptions {
  /** Per-model attempt timeout; the request is cancelled when it passes. */
  timeoutMs?: number;
  /** Give up after this long overall. */
  deadlineMs?: number;
  pool?: ModelPool;
}

/**
 * Tries the model chain with health tracking (shared-utils ModelPool): a model that just hung or
 * reported overload is skipped for a cooldown, the one that last worked goes first, and each
 * attempt is aborted at its timeout. A real request error (400: bad schema/prompt) is thrown
 * immediately rather than retried on every model.
 */
export function generateWithFallback(
  ai: GoogleGenAI,
  models: string[],
  params: Omit<GenerateContentParameters, "model">,
  { timeoutMs = 25_000, deadlineMs, pool = defaultPool }: FallbackOptions = {},
) {
  return pool.call(
    models,
    (model, abortSignal) => ai.models.generateContent({ ...params, model, config: { ...params.config, abortSignal } }),
    { timeoutMs, deadlineMs },
  );
}
