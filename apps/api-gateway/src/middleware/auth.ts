import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthVerifier } from "../lib/authVerifier.js";

async function tryAttachAuth(request: FastifyRequest, authVerifier: AuthVerifier) {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return;

  const token = header.slice("Bearer ".length);
  const decoded = await authVerifier.verifyIdToken(token);
  request.citizenId = decoded.uid;
  if (typeof decoded.claims.role === "string") {
    request.officer = {
      role: decoded.claims.role,
      regionId: typeof decoded.claims.region_id === "string" ? decoded.claims.region_id : null,
      countryCode: typeof decoded.claims.country_code === "string" ? decoded.claims.country_code : null,
    };
  }
}

/** Anonymous submissions are allowed — attach identity if a valid token is present, ignore otherwise. */
export function optionalAuth(authVerifier: AuthVerifier) {
  return async (request: FastifyRequest) => {
    try {
      await tryAttachAuth(request, authVerifier);
    } catch {
      // Invalid/expired token on an optional-auth route: treat as anonymous.
    }
  };
}

/** Endpoints that require a caller identity — 401 on a missing or invalid token. */
export function requireAuth(authVerifier: AuthVerifier) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await tryAttachAuth(request, authVerifier);
    } catch {
      // fall through to the missing-identity check below
    }
    if (!request.citizenId && !request.officer) {
      return reply.code(401).send({
        error: { code: "UNAUTHORIZED", message: "A valid Bearer token is required." },
      });
    }
  };
}

/** Endpoints restricted to officers. Role-hierarchy ("role >= collector") and
 *  jurisdiction/region scoping are stubbed here, completed in Phase 7. */
export function requireOfficer(authVerifier: AuthVerifier) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await tryAttachAuth(request, authVerifier);
    } catch {
      // fall through to the missing-officer check below
    }
    if (!request.officer) {
      return reply.code(401).send({
        error: { code: "UNAUTHORIZED", message: "A valid officer Bearer token is required." },
      });
    }
  };
}
