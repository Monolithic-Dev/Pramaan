import type { FastifyInstance } from "fastify";
import type { Deps } from "../deps.js";
import { optionalAuth } from "../middleware/auth.js";
import { submissionRateLimiter } from "../middleware/rateLimiter.js";
import { ingestSubmission } from "../services/ingestSubmission.js";
import { createSubmissionSchema, idempotencyKeyHeaderSchema } from "../schemas/submissions.js";

export function registerSubmissionRoutes(app: FastifyInstance, deps: Deps) {
  app.post(
    "/submissions",
    { preHandler: [optionalAuth(deps.authVerifier), submissionRateLimiter(deps.store)] },
    async (request, reply) => {
      const idempotencyKeyHeader = request.headers["idempotency-key"];
      const idempotencyKey = idempotencyKeyHeaderSchema.safeParse(
        Array.isArray(idempotencyKeyHeader) ? idempotencyKeyHeader[0] : idempotencyKeyHeader,
      );
      if (!idempotencyKey.success) {
        return reply.code(400).send({
          error: { code: "VALIDATION_ERROR", message: idempotencyKey.error.issues[0]?.message },
        });
      }

      const parsed = createSubmissionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message },
        });
      }
      const body = parsed.data;

      const { result, conflict } = await ingestSubmission(
        deps,
        {
          channel: body.channel,
          text: body.text,
          audio_url: body.audio_url,
          photo_url: body.photo_url,
          lat: body.lat,
          lng: body.lng,
          location_text: body.location_text,
          consent_version: body.consent_version,
          citizenId: request.citizenId,
          idempotencyKey: idempotencyKey.data,
          submitterIp: request.ip,
          countryCode: body.country_code,
        },
        request.log,
      );

      if (conflict) {
        return reply.code(409).send({
          error: {
            code: "IDEMPOTENCY_CONFLICT",
            message: "This Idempotency-Key was already used with a different request body.",
          },
        });
      }

      return reply.code(202).send(result);
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
