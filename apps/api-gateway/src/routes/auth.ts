import type { FastifyInstance } from "fastify";
import type { Citizen } from "@jansetu/shared-types";
import { hashPhone } from "@jansetu/shared-utils";
import type { Deps } from "../deps.js";
import { otpRequestSchema, otpVerifySchema } from "../schemas/auth.js";

export function registerAuthRoutes(app: FastifyInstance, deps: Deps) {
  app.post("/auth/otp/request", async (request, reply) => {
    const parsed = otpRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message },
      });
    }

    // country_code is accepted for API_SPEC.md forward-compatibility with
    // docs/CROSS_BORDER_AND_DPG.md's multi-country model; the MVP is India-only,
    // so it isn't threaded through to Citizen creation yet (hardcoded "IN" below).
    const { sessionInfo } = await deps.identityToolkit.sendVerificationCode(
      parsed.data.phone,
    );
    return reply.code(202).send({ request_id: sessionInfo });
  });

  app.post("/auth/otp/verify", async (request, reply) => {
    const parsed = otpVerifySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message },
      });
    }

    const { idToken, localId, phoneNumber } = await deps.identityToolkit.verifyPhoneNumber(
      parsed.data.request_id,
      parsed.data.otp,
    );

    const citizenId = localId;
    let citizen = await deps.store.getCitizen(citizenId);
    if (!citizen) {
      citizen = {
        citizen_id: citizenId,
        phone_hash: hashPhone(phoneNumber),
        preferred_language: "en-IN",
        country_code: "IN",
        created_at: new Date().toISOString(),
        erasure_requested_at: null,
      } satisfies Citizen;
      await deps.store.putCitizen(citizen);
    }

    return reply.code(200).send({ citizen_token: idToken, citizen_id: citizenId });
  });
}
