import { Storage } from "@google-cloud/storage";
import { withRetry } from "@jansetu/shared-utils";
import { env } from "./env.js";
import { buildGenAI } from "./genai.js";

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

const MIME_BY_EXT: Record<string, string> = {
  webm: "audio/webm", ogg: "audio/ogg", m4a: "audio/mp4", mp3: "audio/mpeg", wav: "audio/wav",
};

export function createGeminiTranscriber(): Transcriber {
  const ai = buildGenAI();
  const storage = new Storage({ projectId: env.gcpProjectId || undefined });
  return {
    async transcribe(audioUrl) {
      const match = /^gs:\/\/([^/]+)\/(.+)$/.exec(audioUrl);
      if (!match) throw new Error(`unsupported audio url: ${audioUrl}`);
      const [data] = await storage.bucket(match[1]).file(match[2]).download();
      const mimeType = MIME_BY_EXT[match[2].split(".").pop() ?? ""] ?? "audio/webm";

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: env.geminiModel,
          contents: [
            {
              role: "user",
              parts: [
                { inlineData: { mimeType, data: data.toString("base64") } },
                { text: "Transcribe this citizen's spoken report verbatim in its original language. Do not translate or summarise." },
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
        }),
      );
      try {
        const parsed = JSON.parse(response.text ?? "") as Transcript;
        return parsed.text?.trim() ? { text: parsed.text.trim(), language: parsed.language } : null;
      } catch {
        return null;
      }
    },
  };
}
