import { env } from "./env.js";
import { buildGenAI, generateWithFallback, parseModelList } from "./genai.js";

export interface Translator {
  /** Translates `text` into `targetLanguage` (BCP-47 base, e.g. "hi"). Preserves numbers exactly. */
  translate(text: string, targetLanguage: string): Promise<string>;
}

export function createGeminiTranslator(): Translator {
  const ai = buildGenAI();
  return {
    async translate(text, targetLanguage) {
      // A page is waiting on this (the citizen status view falls back to the original text on failure).
      const response = await generateWithFallback(
        ai,
        parseModelList(env.geminiTranslationModel),
        {
          contents: [{ role: "user", parts: [{ text }] }],
          config: {
            systemInstruction: `Translate the user's text into the language with BCP-47 code "${targetLanguage}". Keep every number, date and proper noun exactly as written. Output only the translation, in plain, simple wording a resident with no technical background would understand.`,
          },
        },
        { timeoutMs: 10_000, deadlineMs: 20_000 },
      );
      const out = response.text?.trim();
      if (!out) throw new Error("translation returned no text");
      return out;
    },
  };
}
