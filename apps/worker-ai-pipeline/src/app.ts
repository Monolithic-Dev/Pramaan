import Fastify from "fastify";

export function buildApp() {
  const app = Fastify({ logger: true });

  app.get("/healthz", async () => ({ status: "ok" }));

  // Real categorization/dedup logic arrives in Phase 4 (AI_PIPELINE.md).
  app.post("/pubsub-push", async (request, reply) => {
    app.log.info({ body: request.body }, "received pubsub push");
    return reply.code(204).send();
  });

  return app;
}
