import { randomUUID } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Issue } from "@pramaan/shared-types";
import type { Deps } from "../deps.js";
import { isWithinScope } from "../agent/scopeGuard.js";
import { hasMinimumRole } from "../middleware/auth.js";

export const bad = (message: string | undefined) => ({ error: { code: "VALIDATION_ERROR", message } });
export const forbidden = (message: string) => ({ error: { code: "FORBIDDEN", message } });
export const notFound = (what: string) => ({ error: { code: "NOT_FOUND", message: `${what} not found.` } });
export const outside = { error: { code: "JURISDICTION_MISMATCH", message: "This is outside your jurisdiction." } };

/** True when the officer's jurisdiction covers `regionId`. */
export async function regionInScope(deps: Deps, request: FastifyRequest, regionId: string | null | undefined): Promise<boolean> {
  const officer = request.officer!;
  return Boolean(regionId && officer.regionId && (await isWithinScope(deps.bigqueryAgent, regionId, officer.regionId)));
}

/** Resolves the officer's jurisdiction check for an issue, sending the 403 itself. */
export async function issueInScope(deps: Deps, request: FastifyRequest, reply: FastifyReply, issue: Issue): Promise<boolean> {
  if (await regionInScope(deps, request, issue.admin_region_id ?? issue.state_id)) return true;
  reply.code(403).send(outside);
  return false;
}

/** Sends a 403 and returns false unless the caller holds at least `minimum`. */
export function requireRole(request: FastifyRequest, reply: FastifyReply, minimum: "district_collector" | "state_admin", action: string): boolean {
  if (hasMinimumRole(request.officer!.role, minimum)) return true;
  reply.code(403).send(forbidden(`${action} requires role >= ${minimum}.`));
  return false;
}

export async function audit(
  deps: Deps,
  request: FastifyRequest,
  action: string,
  targetId: string,
  before: unknown,
  after: unknown,
  justification: string | null,
) {
  await deps.store.putAuditLogEntry({
    audit_id: randomUUID(),
    actor_id: request.citizenId ?? "unknown-officer",
    action,
    target_id: targetId,
    before,
    after,
    justification,
    timestamp: new Date().toISOString(),
  });
}

/** Per-IP fixed-window limiter for the unauthenticated endpoints. Returns false after sending the 429. */
export async function publicRateLimit(deps: Deps, request: FastifyRequest, reply: FastifyReply, bucket: string, perMinute = 60): Promise<boolean> {
  const count = await deps.store.incrementRateLimit(`${bucket}:${request.ip}`, 60_000);
  if (count <= perMinute) return true;
  reply.code(429).send({ error: { code: "RATE_LIMITED", message: "Too many requests." } });
  return false;
}
