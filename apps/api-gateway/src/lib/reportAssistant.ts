import { env } from "./env.js";
import { buildGenAI, generateWithFallback, parseModelList } from "./genai.js";

export const ASSIST_CATEGORIES = ["roads", "water", "electricity", "sanitation", "health_infra", "education_infra", "other"] as const;

export interface PhotoSuggestion {
  /** False when the photo does not show a public-infrastructure problem (a selfie, a document...). */
  shows_issue: boolean;
  category: (typeof ASSIST_CATEGORIES)[number];
  subcategory: string;
  /** Two or three sentences a citizen could send as their report, written in their language. */
  description: string;
  severity: "low" | "medium" | "high";
  /** A visible hazard to people (exposed wires, open manhole, collapsing structure). */
  safety_hazard: boolean;
}

// Seam over Gemini vision so the route is testable offline. The suggestion only pre-fills the form:
// the citizen reads it, edits it and decides to send it; nothing is submitted on their behalf.
export interface ReportAssistant {
  describePhoto(image: { data: Buffer; mimeType: string }, languageName: string): Promise<PhotoSuggestion | null>;
}

export function createGeminiReportAssistant(): ReportAssistant {
  const ai = buildGenAI();
  return {
    async describePhoto(image, languageName) {
      const response = await generateWithFallback(
        ai,
        parseModelList(env.geminiAgentModel),
        {
          contents: [
            {
              role: "user",
              parts: [
                { inlineData: { mimeType: image.mimeType, data: image.data.toString("base64") } },
                {
                  text: [
                    "A resident took this photo to report a local public-infrastructure problem to their government.",
                    "Decide whether it shows such a problem (damaged road or footpath, water leak or waterlogging, broken streetlight or exposed wires, garbage or sewage, a damaged school or clinic, etc.).",
                    `Then write, in ${languageName}, a short first-person report of 2-3 plain sentences describing only what is visible and why it matters.`,
                    "Never identify people, read out number plates, or guess an address. If it does not show a public problem, set shows_issue to false.",
                  ].join(" "),
                },
              ],
            },
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                shows_issue: { type: "boolean" },
                category: { type: "string", enum: [...ASSIST_CATEGORIES] },
                subcategory: { type: "string" },
                description: { type: "string" },
                severity: { type: "string", enum: ["low", "medium", "high"] },
                safety_hazard: { type: "boolean" },
              },
              required: ["shows_issue", "category", "subcategory", "description", "severity", "safety_hazard"],
            } as never,
          },
        },
        { timeoutMs: 15_000, deadlineMs: 30_000 },
      );
      try {
        const parsed = JSON.parse(response.text ?? "") as PhotoSuggestion;
        return ASSIST_CATEGORIES.includes(parsed.category) ? parsed : { ...parsed, category: "other" };
      } catch {
        return null;
      }
    },
  };
}
