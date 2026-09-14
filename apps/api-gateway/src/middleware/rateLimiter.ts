import type { FastifyReply, FastifyRequest } from "fastify";
import type { Store } from "../store/types.js";

const WINDOW_MS = 60 * 60 * 1000;
const CITIZEN_LIMIT = 10;
const ANONYMOUS_IP_LIMIT = 3;

/** Firestore-backed rolling counter — fine at hackathon scale (single logical counter per key). */
export function submissionRateLimiter(store: Store) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const isAuthenticated = Boolean(request.citizenId);
    const key = isAuthenticated ? `citizen:${request.citizenId}` : `ip:${request.ip}`;
    const limit = isAuthenticated ? CITIZEN_LIMIT : ANONYMOUS_IP_LIMIT;

    const count = await store.incrementRateLimit(key, WINDOW_MS);
    if (count > limit) {
      return reply.code(429).send({
        error: {
          code: "RATE_LIMITED",
          message: `Too many submissions from this ${isAuthenticated ? "account" : "number"} in the last hour. Try again later.`,
        },
      });
    }
  };
}
