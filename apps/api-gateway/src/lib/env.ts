export const env = {
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID ?? "",
  firebaseWebApiKey: process.env.FIREBASE_WEB_API_KEY ?? "",
  pubsubRawSubmissionsTopic: process.env.PUBSUB_RAW_SUBMISSIONS_TOPIC ?? "raw-submissions",
  // Placeholder shared-secret check until a real Gupshup/Twilio account exists —
  // swap for their HMAC signature scheme then (docs/phases/phase-3-manual-checklist.md).
  webhookSharedSecret: process.env.WEBHOOK_SHARED_SECRET ?? "",
  gcpProjectId: process.env.GCP_PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID ?? "",
  vertexLocation: process.env.VERTEX_LOCATION ?? "asia-south1",
  geminiAgentModel: process.env.GEMINI_AGENT_MODEL ?? "gemini-2.0-flash",
  // Demo-day WiFi exemption (docs/phases/phase-8-fraud-impact-crossborder.md
  // §8.1) — a room of judges on one venue IP would otherwise rate-limit each
  // other. Comma-separated CIDRs, e.g. "203.0.113.0/24,198.51.100.7/32".
  rateLimitAllowlistCidrs: (process.env.RATE_LIMIT_ALLOWLIST_CIDRS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};
