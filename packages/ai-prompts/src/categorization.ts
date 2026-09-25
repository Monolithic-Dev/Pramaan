// docs/AI_PIPELINE.md Stage 2. Versioned so a prompt change is one reviewable PR
// — every categorization result records this version (docs/AI_PIPELINE.md
// "Model/prompt versioning").
export const CATEGORIZATION_PROMPT_VERSION = "categorization-v2";

export const CATEGORIZATION_SYSTEM_PROMPT = `You are an information extraction system for a citizen infrastructure
complaint platform. Given the citizen's report, extract structured fields.
Do not infer facts not present in the report. If location is not stated,
leave extracted_location_text null rather than guessing.
Always write summary in English, whatever language the report is in. Also return language
(the ISO 639-1 code of the report's language). If the report is not in English, return
english_translation: a faithful English translation of the whole report; otherwise return an
empty string.`;

export const CATEGORIZATION_CATEGORIES = [
  "water",
  "roads",
  "electricity",
  "sanitation",
  "health_infra",
  "education_infra",
  "other",
] as const;

// Gemini SDK responseSchema (OpenAPI-subset format) — structured-output mode,
// not prompt-instructed JSON, per docs/AI_PIPELINE.md Stage 2: this eliminates
// the malformed-JSON failure class structurally rather than handling it after
// the fact.
export const CATEGORIZATION_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    category: { type: "string", enum: CATEGORIZATION_CATEGORIES },
    subcategory: { type: "string" },
    severity_estimate: { type: "string", enum: ["low", "medium", "high"] },
    extracted_location_text: { type: "string", nullable: true },
    summary: { type: "string" },
    language: { type: "string" },
    english_translation: { type: "string" },
    confidence: { type: "number" },
    contains_personal_emergency: { type: "boolean" },
  },
  required: [
    "category",
    "subcategory",
    "severity_estimate",
    "summary",
    "confidence",
    "contains_personal_emergency",
  ],
} as const;

export interface CategorizationResult {
  category: (typeof CATEGORIZATION_CATEGORIES)[number];
  subcategory: string;
  severity_estimate: "low" | "medium" | "high";
  extracted_location_text: string | null;
  /** ≤25 words — this is what Stage 3 embeds; keep it short and information-dense. */
  summary: string;
  /** ISO 639-1 code of the report's language. Absent on results from the raw-text fallback. */
  language?: string;
  /** Faithful English translation when the report is not in English, otherwise empty. */
  english_translation?: string;
  confidence: number;
  contains_personal_emergency: boolean;
}
