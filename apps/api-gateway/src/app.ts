import { randomUUID } from "node:crypto";
import cors from "@fastify/cors";
import Fastify from "fastify";
import type { Deps } from "./deps.js";
import { registerAgentRoutes } from "./routes/agent.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerConsoleRoutes } from "./routes/console.js";
import { registerInsightRoutes } from "./routes/insights.js";
import { registerIssueRoutes } from "./routes/issues.js";
import { registerJobRoutes } from "./routes/jobs.js";
import { registerMediaRoutes } from "./routes/media.js";
import { registerPrivacyRoutes } from "./routes/privacy.js";
import { registerProjectRoutes } from "./routes/projects.js";
import { registerSubmissionRoutes } from "./routes/submissions.js";
import { registerPlannerRoutes } from "./routes/planner.js";
import { registerPublicRoutes } from "./routes/public.js";
import { registerReportRoutes } from "./routes/reports.js";
import { registerWebhookRoutes } from "./routes/webhooks.js";
import { registerWorkflowRoutes } from "./routes/workflow.js";

export function buildApp(deps: Deps) {
  // Behind a reverse proxy (Render, Cloud Run) request.ip must come from X-Forwarded-For or
  // every caller shares the proxy address, collapsing the anonymous rate limiter and the
  // demo-day CIDR allowlist (lib/cidr.ts) onto one bucket. Trust exactly ONE hop (the platform
  // proxy, which appends the real client address): `true` would trust the whole chain and take
  // the client-supplied leftmost entry, letting anyone dodge the rate limit by sending their
  // own X-Forwarded-For. Set TRUST_PROXY_HOPS=0 when serving directly.
  const trustedHops = Number(process.env.TRUST_PROXY_HOPS ?? 1);
  const app = Fastify({
    logger: true,
    trustProxy: (_address: string, hop: number) => hop < trustedHops,
    // Correlate one request across the web app, gateway logs and support tickets: honour a sane
    // caller-supplied id, otherwise mint one; either way it is echoed back in x-request-id.
    requestIdHeader: false,
    genReqId: (req) => {
      const given = req.headers["x-request-id"];
      return typeof given === "string" && /^[A-Za-z0-9._-]{8,64}$/.test(given) ? given : randomUUID();
    },
  });

  // The web app is served from a different origin than the API. Auth is by Bearer token
  // (never cookies), so an open origin list is safe; set CORS_ORIGINS to lock it down.
  const origins = (process.env.CORS_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean);
  void app.register(cors, { origin: origins.length > 0 ? origins : true, methods: ["GET", "HEAD", "POST", "PATCH"], exposedHeaders: ["x-request-id"] });

  app.addHook("onSend", async (request, reply) => {
    reply.header("x-request-id", request.id);
    reply.header("x-content-type-options", "nosniff");
    reply.header("x-frame-options", "DENY");
    reply.header("referrer-policy", "no-referrer");
    reply.header("strict-transport-security", "max-age=31536000; includeSubDomains");
    reply.header("cross-origin-resource-policy", "cross-origin");
    // The API only ever returns JSON, CSV or media bytes: nothing it serves should run scripts.
    reply.header("content-security-policy", "default-src 'none'; frame-ancestors 'none'");
    if (!reply.hasHeader("cache-control")) reply.header("cache-control", "no-store");
  });

  app.get("/healthz", async () => ({ status: "ok" }));

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({ error: { code: "NOT_FOUND", message: `No route for ${request.method} ${request.url.split("?")[0]}.` } });
  });

  app.setErrorHandler((error, request, reply) => {
    // Client mistakes Fastify detects itself (malformed JSON, body too large, wrong content type)
    // keep their 4xx status; only genuine failures are reported as a dependent-service error.
    const { statusCode: status, message } = error as { statusCode?: number; message?: string };
    if (status && status >= 400 && status < 500) {
      const code = status === 413 ? "PAYLOAD_TOO_LARGE" : status === 415 ? "UNSUPPORTED_MEDIA_TYPE" : status === 429 ? "RATE_LIMITED" : "VALIDATION_ERROR";
      return reply.code(status).send({ error: { code, message: message ?? "Invalid request." } });
    }
    request.log.error(error);
    return reply.code(502).send({
      error: { code: "UPSTREAM_ERROR", message: "A dependent service failed. Try again.", request_id: request.id },
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
      registerConsoleRoutes(v1, deps);
      registerWorkflowRoutes(v1, deps);
      registerPlannerRoutes(v1, deps);
      registerReportRoutes(v1, deps);
      registerPublicRoutes(v1, deps);
      registerJobRoutes(v1, deps);
    },
    { prefix: "/v1" },
  );

  return app;
}
