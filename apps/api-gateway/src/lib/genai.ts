import { GoogleGenAI } from "@google/genai";
import { env } from "./env.js";

// One place that decides how Gemini is reached: the public Gemini API when
// GEMINI_API_KEY is set (local dev), Vertex AI + ADC otherwise (Cloud Run).
export function buildGenAI(): GoogleGenAI {
  if (env.geminiApiKey) return new GoogleGenAI({ apiKey: env.geminiApiKey });
  return new GoogleGenAI({ vertexai: true, project: env.gcpProjectId, location: env.vertexLocation });
}
