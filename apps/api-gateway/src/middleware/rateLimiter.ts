import type { FastifyReply, FastifyRequest } from "fastify";
import type { Store } from "../store/types.js";
import { isIpAllowlisted } from "../lib/cidr.js";
import { env } from "../lib/env.js";

const WINDOW_MS = 60 * 60 * 1000;
const CITIZEN_LIMIT = 10;
const ANONYMOUS_IP_LIMIT = 3;

/** Firestore-backed rolling counter — fine at hackathon scale (single logical counter per key). */
export interface RateLimitOptions {
  /** Counter namespace, so uploads do not eat into the submission budget. */
  scope?: string;
  citizenLimit?: number;
  anonymousLimit?: number;
}

export function submissionRateLimiter(store: Store, opts: RateLimitOptions = {}) {
  const citizenLimit = opts.citizenLimit ?? CITIZEN_LIMIT;
  const anonymousLimit = opts.anonymousLimit ?? ANONYMOUS_IP_LIMIT;
  const prefix = opts.scope ? `${opts.scope}:` : "";
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (isIpAllowlisted(request.ip, env.rateLimitAllowlistCidrs)) return;

    const isAuthenticated = Boolean(request.citizenId);
    const key = `${prefix}${isAuthenticated ? `citizen:${request.citizenId}` : `ip:${request.ip}`}`;
    const limit = isAuthenticated ? citizenLimit : anonymousLimit;

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
