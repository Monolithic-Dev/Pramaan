import cors from "@fastify/cors";
import Fastify from "fastify";
import type { Deps } from "./deps.js";
import { registerAgentRoutes } from "./routes/agent.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerInsightRoutes } from "./routes/insights.js";
import { registerIssueRoutes } from "./routes/issues.js";
import { registerMediaRoutes } from "./routes/media.js";
import { registerPrivacyRoutes } from "./routes/privacy.js";
import { registerProjectRoutes } from "./routes/projects.js";
import { registerSubmissionRoutes } from "./routes/submissions.js";
import { registerWebhookRoutes } from "./routes/webhooks.js";

export function buildApp(deps: Deps) {
  const app = Fastify({ logger: true });

  // The web app is served from a different origin than the API. Auth is by Bearer token
  // (never cookies), so an open origin list is safe; set CORS_ORIGINS to lock it down.
  const origins = (process.env.CORS_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean);
  void app.register(cors, { origin: origins.length > 0 ? origins : true });

  app.get("/healthz", async () => ({ status: "ok" }));

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    reply.code(502).send({
      error: { code: "UPSTREAM_ERROR", message: "A dependent service failed. Try again." },
    });
  });

  // All endpoints are versioned per API_SPEC.md §8; additive fields are always
  // safe to add without a version bump.
  app.register(
    async (v1) => {
      registerAuthRoutes(v1, deps);
      registerSubmissionRoutes(v1, deps);
      registerWebhookRoutes(v1, deps);
      registerIssueRoutes(v1, deps);
      registerAgentRoutes(v1, deps);
      registerProjectRoutes(v1, deps);
      registerPrivacyRoutes(v1, deps);
      registerInsightRoutes(v1, deps);
      registerMediaRoutes(v1, deps);
    },
    { prefix: "/v1" },
  );

  return app;
}
