import { PubSub } from "@google-cloud/pubsub";
import { withRetry } from "@pramaan/shared-utils";
import { env } from "./env.js";

export interface Publisher {
  publishRawSubmission(payload: unknown): Promise<void>;
}

export function createPubSubPublisher(): Publisher {
  const pubsub = new PubSub();
  const topic = pubsub.topic(env.pubsubRawSubmissionsTopic);

  return {
    async publishRawSubmission(payload) {
      await withRetry(() =>
        topic.publishMessage({ data: Buffer.from(JSON.stringify(payload)) }),
      );
    },
  };
}

// No-Pub/Sub deployments: nudge the worker over HTTP. Best-effort by design — a sleeping
// free-tier worker may take a minute to wake, and the citizen must never wait for it. The
// submission is already stored as "queued"; the worker's /jobs/sweep processes anything missed.
export function createHttpPublisher(workerUrl: string, secret: string): Publisher {
  return {
    async publishRawSubmission(payload) {
      const body = { message: { data: Buffer.from(JSON.stringify(payload)).toString("base64") } };
      void fetch(`${workerUrl.replace(/\/$/, "")}/pubsub-push`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(secret ? { "x-worker-secret": secret } : {}) },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      }).catch(() => undefined);
    },
  };
}
