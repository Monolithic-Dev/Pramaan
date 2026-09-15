import Fastify from "fastify";
import type { Deps } from "./deps.js";
import { processSubmission } from "./services/processSubmission.js";
import { runScoringBatch } from "./services/scoring.js";

interface PubSubPushBody {
  message?: { data?: string };
}

export function buildApp(deps: Deps) {
  const app = Fastify({ logger: true });

  app.get("/healthz", async () => ({ status: "ok" }));

  app.post("/pubsub-push", async (request, reply) => {
    const body = request.body as PubSubPushBody;
    const data = body.message?.data;
    if (!data) {
      // Malformed push — ack anyway so Pub/Sub doesn't retry a message that
      // will never parse.
      return reply.code(204).send();
    }

    let submissionId: string | undefined;
    try {
      const payload = JSON.parse(Buffer.from(data, "base64").toString("utf8"));
      submissionId = payload.submission_id;
    } catch (err) {
      app.log.error({ err }, "failed to parse pubsub push payload");
      return reply.code(204).send();
    }

    if (!submissionId) return reply.code(204).send();

    try {
      await processSubmission(deps, submissionId, request.log);
    } catch (err) {
      // Let Pub/Sub retry (with backoff) on a genuine processing failure —
      // this is the "citizen never blocked by AI availability" contract from
      // the ingestion side; retries here are the worker's half of it.
      app.log.error({ err, submissionId }, "processSubmission failed, will retry");
      return reply.code(500).send();
    }

    return reply.code(204).send();
  });

  // Triggered by Cloud Scheduler every 15 minutes in production
  // (docs/phases/phase-5-scoring.md §5.4). Also callable directly for an
  // immediate rescore (e.g. after an emergency-override flag flips).
  app.post("/jobs/score", async (request, reply) => {
    const summary = await runScoringBatch(deps, request.log);
    return reply.code(200).send(summary);
  });

  return app;
}
