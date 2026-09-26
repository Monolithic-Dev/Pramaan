export const env = {
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID ?? "",
  firebaseWebApiKey: process.env.FIREBASE_WEB_API_KEY ?? "",
  pubsubRawSubmissionsTopic: process.env.PUBSUB_RAW_SUBMISSIONS_TOPIC ?? "raw-submissions",
  // Placeholder shared-secret check until a real Gupshup/Twilio account exists —
  // swap for their HMAC signature scheme then (docs/phases/phase-3-manual-checklist.md).
  webhookSharedSecret: process.env.WEBHOOK_SHARED_SECRET ?? "",
  gcpProjectId: process.env.GCP_PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID ?? "",
  vertexLocation: process.env.VERTEX_LOCATION ?? "asia-south1",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  // Comma-separated fallback chains (see generateWithFallback). Long on purpose: individual model
  // versions on the free tier hang or report overload for minutes at a time, and the ModelPool
  // skips sick ones and leads with whichever answered last, so extra entries only cost anything
  // when earlier ones are down.
  geminiAgentModel:
    process.env.GEMINI_AGENT_MODEL ??
    "gemini-3.6-flash,gemini-flash-latest,gemini-flash-lite-latest,gemini-3.1-flash-lite,gemini-3.5-flash-lite,gemini-3.8-flash,gemini-3.5-flash",
  geminiTranslationModel:
    process.env.GEMINI_TRANSLATION_MODEL ??
    "gemini-flash-lite-latest,gemini-3.1-flash-lite,gemini-3.6-flash,gemini-3.5-flash-lite,gemini-flash-latest",
  mediaBucket: process.env.MEDIA_BUCKET ?? "",
  // Demo-day WiFi exemption (docs/phases/phase-8-fraud-impact-crossborder.md
  // §8.1) — a room of judges on one venue IP would otherwise rate-limit each
  // other. Comma-separated CIDRs, e.g. "203.0.113.0/24,198.51.100.7/32".
  rateLimitAllowlistCidrs: (process.env.RATE_LIMIT_ALLOWLIST_CIDRS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};
