import { PubSub } from "@google-cloud/pubsub";
import { withRetry } from "@jansetu/shared-utils";
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
