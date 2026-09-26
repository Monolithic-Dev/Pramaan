import { createHash, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { SubmissionChannel } from "@jansetu/shared-types";
import type { Deps } from "../deps.js";
import { env } from "../lib/env.js";
import { getOrCreateCitizenByPhone } from "../services/citizens.js";
import { ingestSubmission } from "../services/ingestSubmission.js";
import { channelWebhookSchema } from "../schemas/webhooks.js";

const digest = (s: string) => createHash("sha256").update(s).digest();

// Fails closed: these endpoints bypass the per-citizen submission rate limiter and let the caller
// pick any phone number as the reporter, so an unconfigured deployment must not accept them.
function verifySharedSecret(request: FastifyRequest, reply: FastifyReply): boolean {
  if (!env.webhookSharedSecret) {
    reply.code(503).send({ error: { code: "CHANNEL_NOT_CONFIGURED", message: "Messaging webhooks are not enabled on this deployment." } });
    return false;
  }
  const given = request.headers["x-webhook-secret"];
  if (typeof given === "string" && timingSafeEqual(digest(given), digest(env.webhookSharedSecret))) return true;
  reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Invalid webhook signature." } });
  return false;
}

function registerChannelWebhook(
  app: FastifyInstance,
  deps: Deps,
  path: string,
  channel: SubmissionChannel,
  consentVersion: string,
) {
  app.post(path, async (request, reply) => {
    if (!verifySharedSecret(request, reply)) return;

    const parsed = channelWebhookSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message },
      });
    }
    const body = parsed.data;
    if (body.photo_url && !deps.mediaStore.owns(body.photo_url)) {
      return reply.code(400).send({
        error: { code: "VALIDATION_ERROR", message: "photo_url must be a URL returned by POST /media." },
      });
    }

    const citizen = await getOrCreateCitizenByPhone(deps, body.from);
    // The provider's message_id is already a stable per-attempt identifier —
    // no client-generated UUID exists on this path, so it doubles as the
    // Idempotency-Key (docs/EDGE_CASES.md #14).
    const idempotencyKey = `${channel}_${body.message_id}`;

    const { result, conflict } = await ingestSubmission(
      deps,
      {
        channel,
        text: body.text,
        photo_url: body.photo_url,
        lat: body.lat,
        lng: body.lng,
        location_text: body.location_text,
        consent_version: consentVersion,
        citizenId: citizen.citizen_id,
        idempotencyKey,
      },
      request.log,
    );

    if (conflict) {
      return reply.code(409).send({
        error: {
          code: "IDEMPOTENCY_CONFLICT",
          message: "This message_id was already processed with a different payload.",
        },
      });
    }

    return reply.code(202).send(result);
  });
}

export function registerWebhookRoutes(app: FastifyInstance, deps: Deps) {
  registerChannelWebhook(app, deps, "/webhooks/whatsapp", "whatsapp", "dpdp-notice-v1-whatsapp");
  registerChannelWebhook(app, deps, "/webhooks/sms", "sms", "dpdp-notice-v1-sms");
}
