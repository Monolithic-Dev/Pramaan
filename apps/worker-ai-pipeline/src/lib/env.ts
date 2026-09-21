export const env = {
  gcpProjectId: process.env.GCP_PROJECT_ID ?? "",
  vertexLocation: process.env.VERTEX_LOCATION ?? "asia-south1",
  // When set, Gemini is called via the public Gemini API instead of Vertex AI
  // (local dev / no-ADC environments). Unset on Cloud Run -> Vertex + ADC.
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  // Comma-separated fallback chain, fastest/cheapest first (see generateWithFallback).
  geminiModel: process.env.GEMINI_CATEGORIZATION_MODEL ?? "gemini-3.5-flash-lite,gemini-3.8-flash,gemini-3.6-flash",
  embeddingModel:
    process.env.VERTEX_EMBEDDING_MODEL ??
    (process.env.GEMINI_API_KEY ? "gemini-embedding-001" : "text-embedding-005"),
  mediaBucket: process.env.MEDIA_BUCKET ?? "",
  // Cosine threshold for "same problem". Depends on the embedding model: measured on real
  // reports, gemini-embedding-001 puts true duplicates (incl. Hindi vs English) at 0.75-0.85
  // and different problems at 0.57-0.67, so 0.72 separates them; text-embedding-005 was
  // tuned to 0.82 (docs/DEDUP-TUNING.md). Override with DEDUP_SIMILARITY_THRESHOLD.
  similarityThreshold: Number(
    process.env.DEDUP_SIMILARITY_THRESHOLD ?? (process.env.GEMINI_API_KEY ? "0.72" : "0.82"),
  ),
};
