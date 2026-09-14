import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Submission } from "@jansetu/shared-types";
import { isWithinIndiaBoundingBox } from "@jansetu/shared-utils";
import type { Deps } from "../deps.js";
import { optionalAuth } from "../middleware/auth.js";
import { submissionRateLimiter } from "../middleware/rateLimiter.js";
import { createSubmissionSchema } from "../schemas/submissions.js";

export function registerSubmissionRoutes(app: FastifyInstance, deps: Deps) {
  app.post(
    "/submissions",
    { preHandler: [optionalAuth(deps.authVerifier), submissionRateLimiter(deps.store)] },
    async (request, reply) => {
      const parsed = createSubmissionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message },
        });
      }

      const body = parsed.data;
      const submissionId = `sub_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

      const submission: Submission = {
        submission_id: submissionId,
        citizen_id: request.citizenId ?? "anonymous",
        channel: body.channel,
        raw_text: body.text ?? null,
        raw_audio_url: body.audio_url ?? null,
        photo_url: body.photo_url ?? null,
        detected_language: null,
        translated_text: null,
        lat: body.lat,
        lng: body.lng,
        location_confidence: isWithinIndiaBoundingBox(body.lat, body.lng) ? "high" : "low",
        submitted_at: new Date().toISOString(),
        status: "queued",
        state_id: null,
      };

      // Ingestion latency must be independent of AI pipeline / Pub/Sub health
      // (docs/EDGE_CASES.md #18) — the Firestore write already succeeded, so a
      // publish failure is logged, not surfaced to the citizen.
      await deps.store.putSubmission(submission);
      try {
        await deps.publisher.publishRawSubmission({ submission_id: submissionId });
      } catch (err) {
        request.log.error({ err, submissionId }, "failed to publish raw-submission event");
      }

      return reply.code(202).send({ submission_id: submissionId, status: submission.status });
    },
  );

  app.get(
    "/submissions/:submissionId",
    { preHandler: [optionalAuth(deps.authVerifier)] },
    async (request, reply) => {
      const { submissionId } = request.params as { submissionId: string };
      const submission = await deps.store.getSubmission(submissionId);
      if (!submission) {
        return reply.code(404).send({
          error: { code: "NOT_FOUND", message: "Submission not found." },
        });
      }

      const isOwner = request.citizenId === submission.citizen_id;
      if (!isOwner && !request.officer) {
        return reply.code(401).send({
          error: { code: "UNAUTHORIZED", message: "You may only view your own submissions." },
        });
      }

      return reply.code(200).send(submission);
    },
  );
}
