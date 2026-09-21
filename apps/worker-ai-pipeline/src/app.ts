import Fastify from "fastify";
import type { Deps } from "./deps.js";
import { processSubmission } from "./services/processSubmission.js";
import { runScoringBatch } from "./services/scoring.js";

interface PubSubPushBody {
  message?: { data?: string };
}

// Submissions are processed one at a time per worker instance. Dedup is check-then-create:
// two near-simultaneous reports of the same pothole would each see "no existing issue" and
// create duplicates. Serialising removes that race for a single instance (Render free tier,
// or Cloud Run with maxInstances=1); with several instances it would need a Firestore lock.
// ponytail: in-process queue; upgrade to a transactional geohash-cell lock before scaling out.
let queueTail: Promise<unknown> = Promise.resolve();
function serially<T>(task: () => Promise<T>): Promise<T> {
  const run = queueTail.then(task, task);
  queueTail = run.catch(() => undefined);
  return run;
}

export function buildApp(deps: Deps) {
  const app = Fastify({ logger: true });

  app.get("/healthz", async () => ({ status: "ok" }));

  // On hosts where the worker has a public URL and no Pub/Sub OIDC (e.g. Render), a
  // shared secret keeps strangers from triggering processing or scoring.
  const secret = process.env.WORKER_SHARED_SECRET;
  if (secret) {
    app.addHook("onRequest", async (request, reply) => {
      if (request.url === "/healthz") return;
      if (request.headers["x-worker-secret"] !== secret) {
        return reply.code(401).send({ error: "unauthorized" });
      }
    });
  }

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
      await serially(() => processSubmission(deps, submissionId, request.log));
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

  // Pub/Sub-less deployments: the gateway pings /pubsub-push best-effort, and this sweep
  // (called by the scheduler) picks up anything that was missed, oldest first.
  app.post("/jobs/sweep", async (request, reply) => {
    // Submissions stuck "processing" for 5+ minutes were interrupted (crash, cold-start kill):
    // put them back in the queue so they are retried instead of being lost.
    const stale = await deps.store.listStaleProcessingSubmissions(
      new Date(Date.now() - 5 * 60_000).toISOString(),
      20,
    );
    for (const s of stale) await deps.store.putSubmission({ ...s, status: "queued" });
    const pending = await deps.store.listPendingSubmissions(20);
    let processed = 0;
    for (const submission of pending) {
      try {
        await serially(() => processSubmission(deps, submission.submission_id, request.log));
        processed += 1;
      } catch (err) {
        request.log.error({ err, submissionId: submission.submission_id }, "sweep: processing failed");
      }
    }
    return reply.code(200).send({ pending: pending.length, processed });
  });

  return app;
}
