export const env = {
  gcpProjectId: process.env.GCP_PROJECT_ID ?? "",
  vertexLocation: process.env.VERTEX_LOCATION ?? "asia-south1",
  geminiModel: process.env.GEMINI_CATEGORIZATION_MODEL ?? "gemini-2.0-flash",
  embeddingModel: process.env.VERTEX_EMBEDDING_MODEL ?? "text-embedding-005",
  similarityThreshold: Number(process.env.DEDUP_SIMILARITY_THRESHOLD ?? "0.82"),
};
