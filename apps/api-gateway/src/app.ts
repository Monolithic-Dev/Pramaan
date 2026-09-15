import Fastify from "fastify";
import type { Deps } from "./deps.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerIssueRoutes } from "./routes/issues.js";
import { registerSubmissionRoutes } from "./routes/submissions.js";
import { registerWebhookRoutes } from "./routes/webhooks.js";

export function buildApp(deps: Deps) {
  const app = Fastify({ logger: true });

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
    },
    { prefix: "/v1" },
  );

  return app;
}
