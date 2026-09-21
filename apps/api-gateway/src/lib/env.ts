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
  // Comma-separated fallback chains (see generateWithFallback). The agent needs reliable
  // function calling and answers within a demo-friendly time, so it starts with the fastest model that supports tools (measured 1.6s vs 3-17s) and falls back to slower ones.
  geminiAgentModel: process.env.GEMINI_AGENT_MODEL ?? "gemini-3.5-flash-lite,gemini-3-flash-preview,gemini-3.8-flash,gemini-3.5-flash",
  geminiTranslationModel: process.env.GEMINI_TRANSLATION_MODEL ?? "gemini-3.5-flash-lite,gemini-3.8-flash",
  mediaBucket: process.env.MEDIA_BUCKET ?? "",
  // Demo-day WiFi exemption (docs/phases/phase-8-fraud-impact-crossborder.md
  // §8.1) — a room of judges on one venue IP would otherwise rate-limit each
  // other. Comma-separated CIDRs, e.g. "203.0.113.0/24,198.51.100.7/32".
  rateLimitAllowlistCidrs: (process.env.RATE_LIMIT_ALLOWLIST_CIDRS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};
