import { Storage } from "@google-cloud/storage";
import type { Firestore } from "firebase-admin/firestore";
import { env } from "./env.js";
import { buildGenAI, generateWithFallback, parseModelList } from "./genai.js";
import { readMedia } from "./media.js";

export interface Transcript {
  text: string;
  /** BCP-47 base language the speaker used, e.g. "hi". */
  language: string;
}

// Seam over speech-to-text so processSubmission is testable without audio or GCP.
export interface Transcriber {
  /** Returns null when the audio has no intelligible speech. */
  transcribe(audioUrl: string): Promise<Transcript | null>;
}

export function createGeminiTranscriber(db?: Firestore): Transcriber {
  const ai = buildGenAI();
  const storage = new Storage({ projectId: env.gcpProjectId || undefined });
  return {
    async transcribe(audioUrl) {
      const { data, mimeType } = await readMedia(audioUrl, storage, db);
      const response = await generateWithFallback(ai, parseModelList(env.geminiModel), {
          contents: [
            {
              role: "user",
              parts: [
                { inlineData: { mimeType, data: data.toString("base64") } },
                { text: "Transcribe this citizen spoken report verbatim in its original language. Do not translate or summarise." },
              ],
            },
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: { text: { type: "string" }, language: { type: "string" } },
              required: ["text", "language"],
            } as never,
          },
      });
      try {
        const parsed = JSON.parse(response.text ?? "") as Transcript;
        return parsed.text?.trim() ? { text: parsed.text.trim(), language: parsed.language } : null;
      } catch {
        return null;
      }
    },
  };
}
