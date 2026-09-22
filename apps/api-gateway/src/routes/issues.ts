import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Deps } from "../deps.js";
import { hasMinimumRole, requireOfficer } from "../middleware/auth.js";
import { isWithinScope } from "../agent/scopeGuard.js";
import { emergencyOverrideSchema } from "../schemas/issues.js";

export function registerIssueRoutes(app: FastifyInstance, deps: Deps) {
  // docs/API_SPEC.md §3, docs/phases/phase-5-scoring.md §5.5 — every component,
  // the weights used, and the fallback disclosures, per PRD.md §6.3. Officer
  // only: this is the raw ranking breakdown, not the citizen-safe summary
  // (see GET /my-reports/:id/status, which is the endpoint citizens get).
  app.get(
    "/issues/:issueId/score",
    { preHandler: [requireOfficer(deps.authVerifier)] },
    async (request, reply) => {
      const { issueId } = request.params as { issueId: string };
      const issue = await deps.store.getIssue(issueId);
      if (!issue) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Issue not found." } });
      }

      const officer = request.officer!;
      const target = issue.admin_region_id ?? issue.state_id;
      if (!officer.regionId || !target || !(await isWithinScope(deps.bigqueryAgent, target, officer.regionId))) {
        return reply.code(403).send({
          error: { code: "JURISDICTION_MISMATCH", message: "This issue is outside your jurisdiction." },
        });
      }

      const score = await deps.store.getCanonicalScore(issueId);
      if (!score) {
        return reply.code(404).send({
          error: { code: "NOT_FOUND", message: "This issue has not been scored yet." },
        });
      }
      return reply.code(200).send(score);
    },
  );

  // docs/API_SPEC.md §3, docs/phases/phase-5-scoring.md §5.7 — bypasses the
  // minimum-report threshold; the next /jobs/score batch picks it up
  // (docs/EDGE_CASES.md #11). "Officer (role >= collector)" per API_SPEC.md —
  // a field_officer token must not be able to trigger this.
  app.post(
    "/issues/:issueId/emergency-override",
    { preHandler: [requireOfficer(deps.authVerifier)] },
    async (request, reply) => {
      const officer = request.officer!;
      if (!hasMinimumRole(officer.role, "district_collector")) {
        return reply.code(403).send({
          error: { code: "FORBIDDEN", message: "Emergency override requires role >= district_collector." },
        });
      }

      const { issueId } = request.params as { issueId: string };
      const parsed = emergencyOverrideSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message },
        });
      }

      const before = await deps.store.getIssue(issueId);
      if (!before) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Issue not found." } });
      }

      const target = before.admin_region_id ?? before.state_id;
      if (!officer.regionId || !target || !(await isWithinScope(deps.bigqueryAgent, target, officer.regionId))) {
        return reply.code(403).send({
          error: { code: "JURISDICTION_MISMATCH", message: "This issue is outside your jurisdiction." },
        });
      }

      const after = await deps.store.setEmergencyOverride(issueId, parsed.data.enabled);

      // Every state-changing officer action writes an audit log entry, as
      // part of the same change (docs/SECURITY_PRIVACY.md §6).
      await deps.store.putAuditLogEntry({
        audit_id: randomUUID(),
        actor_id: request.citizenId ?? "unknown-officer",
        action: "emergency_override",
        target_id: issueId,
        before: { emergency_override: before.emergency_override },
        after: { emergency_override: after.emergency_override },
        justification: parsed.data.justification,
        timestamp: new Date().toISOString(),
      });

      return reply.code(200).send({ issue_id: issueId, emergency_override: after.emergency_override });
    },
  );
}
