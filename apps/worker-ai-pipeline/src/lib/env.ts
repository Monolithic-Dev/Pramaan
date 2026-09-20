export const env = {
  gcpProjectId: process.env.GCP_PROJECT_ID ?? "",
  vertexLocation: process.env.VERTEX_LOCATION ?? "asia-south1",
  // When set, Gemini is called via the public Gemini API instead of Vertex AI
  // (local dev / no-ADC environments). Unset on Cloud Run -> Vertex + ADC.
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_CATEGORIZATION_MODEL ?? "gemini-3.6-flash",
  embeddingModel:
    process.env.VERTEX_EMBEDDING_MODEL ??
    (process.env.GEMINI_API_KEY ? "gemini-embedding-001" : "text-embedding-005"),
  mediaBucket: process.env.MEDIA_BUCKET ?? "",
  similarityThreshold: Number(process.env.DEDUP_SIMILARITY_THRESHOLD ?? "0.82"),
};
