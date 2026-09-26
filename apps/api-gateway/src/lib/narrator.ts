import { env } from "./env.js";
import { buildGenAI, generateWithFallback, parseModelList } from "./genai.js";

export interface Narrator {
  /** Turns a facts object into a short briefing in `language` (a name like "Hindi"). Throws if the model is unavailable. */
  narrate(facts: unknown, language: string): Promise<string>;
}

export function createGeminiNarrator(): Narrator {
  const ai = buildGenAI();
  return {
    async narrate(facts, language) {
      const response = await generateWithFallback(ai, parseModelList(env.geminiTranslationModel), {
        contents: [{ role: "user", parts: [{ text: JSON.stringify(facts) }] }],
        config: {
          systemInstruction: [
            "You write the opening summary of a weekly briefing for a senior government officer.",
            `Write it in ${language}, in 3 short paragraphs (about 140 words in total): what changed, what needs attention, what to do first.`,
            "Use ONLY the facts in the JSON. Copy every number, percentage and money amount exactly as it appears there; never round, convert or invent a figure.",
            "Do not mention data you were not given. Plain sentences, no headings, no bullet points, no markdown.",
          ].join(" "),
        },
      }, { timeoutMs: 12_000, deadlineMs: 25_000 }); // the briefing page falls back to a template on failure
      const out = response.text?.trim();
      if (!out) throw new Error("narration returned no text");
      return out;
    },
  };
}
