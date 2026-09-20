import { Storage } from "@google-cloud/storage";
import type { Firestore } from "firebase-admin/firestore";
import { withRetry } from "@jansetu/shared-utils";
import { env } from "./env.js";
import { buildGenAI } from "./genai.js";
import { readMedia } from "./media.js";

export interface PhotoAnalysis {
  /** Does the photo plausibly show a public infrastructure problem (road, water, power, sanitation...)? */
  shows_infrastructure_issue: boolean;
  /** One-sentence factual description of what is visible, in English. */
  description: string;
}

// Seam over Gemini multimodal (computer vision) so processSubmission is testable offline.
export interface PhotoAnalyzer {
  analyze(photoUrl: string): Promise<PhotoAnalysis | null>;
}

const PROMPT =
  "A citizen attached this photo to a public-infrastructure complaint. Say whether it plausibly shows a public infrastructure problem (damaged road, water leak, broken streetlight, garbage or sewage, damaged public building, etc.) and describe what is visible in one factual sentence. Do not identify people.";

export function createGeminiPhotoAnalyzer(db?: Firestore): PhotoAnalyzer {
  const ai = buildGenAI();
  const storage = new Storage({ projectId: env.gcpProjectId || undefined });
  return {
    async analyze(photoUrl) {
      const { data, mimeType } = await readMedia(photoUrl, storage, db);
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: env.geminiModel,
          contents: [
            {
              role: "user",
              parts: [{ inlineData: { mimeType, data: data.toString("base64") } }, { text: PROMPT }],
            },
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                shows_infrastructure_issue: { type: "boolean" },
                description: { type: "string" },
              },
              required: ["shows_infrastructure_issue", "description"],
            } as never,
          },
        }),
      );
      try {
        return JSON.parse(response.text ?? "") as PhotoAnalysis;
      } catch {
        return null;
      }
    },
  };
}
