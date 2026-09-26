import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Issue, ImpactRecord, Project } from "@jansetu/shared-types";
import type { Deps } from "../deps.js";
import { isWithinScope } from "../agent/scopeGuard.js";
import { requireAuth, requireOfficer } from "../middleware/auth.js";
import { confirmResolutionSchema } from "../schemas/projects.js";
import { completeIfConfirmed } from "../services/impactLoop.js";
import { notifyReporters } from "../services/notify.js";
import { requireRole } from "./helpers.js";

const DEFAULT_CONFIRMATIONS_REQUIRED = 3;

/** Officer-facing project actions are scoped to the underlying issue's region — an
 *  officer from state A must not be able to mark-complete or sign off a project in
 *  state B just because they hold a valid officer token (docs/SECURITY_PRIVACY.md §5). */
async function assertProjectInJurisdiction(
  deps: Deps,
  request: FastifyRequest,
  reply: FastifyReply,
  project: Project,
): Promise<Issue | null> {
  const officer = request.officer!;
  const issue = await deps.store.getIssue(project.issue_id);
  const target = issue?.admin_region_id ?? issue?.state_id ?? project.state_id;
  if (!officer.regionId || !target || !(await isWithinScope(deps.bigqueryAgent, target, officer.regionId))) {
    reply.code(403).send({
      error: { code: "JURISDICTION_MISMATCH", message: "This project is outside your jurisdiction." },
    });
    return null;
  }
  return issue;
}

export function registerProjectRoutes(app: FastifyInstance, deps: Deps) {
  // docs/API_SPEC.md §6, docs/phases/phase-8-fraud-impact-crossborder.md §8.2.
  // No real WhatsApp/SMS/push integration exists anywhere in this build yet
  // (docs/phases/phase-8-manual-checklist.md) — this computes and logs the
  // notification plan (who, on which channel, in which language) rather than
  // actually sending anything.
  app.post(
    "/projects/:projectId/mark-complete",
    { preHandler: [requireOfficer(deps.authVerifier)] },
    async (request, reply) => {
      if (!requireRole(request, reply, "district_collector", "Marking a project complete")) return;
      const { projectId } = request.params as { projectId: string };
      const project = await deps.store.getProject(projectId);
      if (!project) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Project not found." } });
      }

      const issue = await assertProjectInJurisdiction(deps, request, reply, project);
      if (reply.sent) return;
      const submissions = issue ? await deps.store.getSubmissionsByIssue(issue.issue_id) : [];
      const reporterIds = [...new Set(submissions.map((s) => s.citizen_id))].filter(
        (id) => id !== "anonymous",
      );

      const notifications = await Promise.all(
        reporterIds.map(async (citizenId) => {
          const citizen = await deps.store.getCitizen(citizenId);
          const originalSubmission = submissions.find((s) => s.citizen_id === citizenId);
          return {
            citizen_id: citizenId,
            channel: originalSubmission?.channel ?? "web",
            preferred_language: citizen?.preferred_language ?? "en",
          };
        }),
      );
      request.log.info({ projectId, notifications }, "impact loop: mark-complete notification plan");
      if (issue) await notifyReporters(deps, issue, "issue.confirm_resolution", { project_id: projectId });

      await deps.store.updateProject(projectId, { marked_complete_at: new Date().toISOString() });

      if (!(await deps.store.getImpactRecord(projectId))) {
        const impactRecord: ImpactRecord = {
          impact_id: `imp_${randomUUID().slice(0, 8)}`,
          project_id: projectId,
          issue_id: project.issue_id,
          country_code: project.country_code,
          state_id: project.state_id,
          category: issue?.category ?? "other",
          region_id: issue?.admin_region_id ?? "UNRESOLVED",
          confirmations_received: 0,
          // Confirmations must come from distinct original reporters, so an issue with fewer
          // identified reporters than the default could otherwise never close.
          confirmations_required: Math.max(1, Math.min(DEFAULT_CONFIRMATIONS_REQUIRED, reporterIds.length)),
          confirmations_negative: 0,
          confirmed_by: [],
          resolution_photo_url: null,
          resolved_at: "",
          verified_by: "",
          efficacy: 0,
        };
        await deps.store.putImpactRecord(impactRecord);
      }

      await deps.store.putAuditLogEntry({
        audit_id: randomUUID(),
        actor_id: request.citizenId ?? "unknown-officer",
        action: "mark_complete",
        target_id: projectId,
        before: { marked_complete_at: project.marked_complete_at },
        after: { marked_complete_at: new Date().toISOString() },
        justification: null,
        timestamp: new Date().toISOString(),
      });

      return reply.code(200).send({ project_id: projectId, notified: notifications.length });
    },
  );

  // Not in API_SPEC.md's endpoint list verbatim — added to implement
  // EDGE_CASES.md #13's "confirmations >= required AND officer sign-off"
  // condition, which needs a distinct officer action separate from
  // mark-complete (sign-off happens after confirmations start arriving, not
  // before). See docs/phases/phase-8-manual-checklist.md.
  app.post(
    "/projects/:projectId/officer-signoff",
    { preHandler: [requireOfficer(deps.authVerifier)] },
    async (request, reply) => {
      if (!requireRole(request, reply, "district_collector", "Signing off a project")) return;
      const { projectId } = request.params as { projectId: string };
      const project = await deps.store.getProject(projectId);
      if (!project) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Project not found." } });
      }

      await assertProjectInJurisdiction(deps, request, reply, project);
      if (reply.sent) return;

      const updated = await deps.store.updateProject(projectId, {
        officer_signed_off_at: new Date().toISOString(),
      });

      await completeIfConfirmed(deps, projectId);

      await deps.store.putAuditLogEntry({
        audit_id: randomUUID(),
        actor_id: request.citizenId ?? "unknown-officer",
        action: "officer_signoff",
        target_id: projectId,
        before: { officer_signed_off_at: project.officer_signed_off_at },
        after: { officer_signed_off_at: updated.officer_signed_off_at },
        justification: null,
        timestamp: new Date().toISOString(),
      });

      return reply.code(200).send({ project_id: projectId, officer_signed_off_at: updated.officer_signed_off_at });
    },
  );

  app.post(
    "/projects/:projectId/confirm-resolution",
    { preHandler: [requireAuth(deps.authVerifier)] },
    async (request, reply) => {
      if (request.officer) {
        return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Officers cannot confirm a resolution as a citizen." } });
      }
      const { projectId } = request.params as { projectId: string };
      const parsed = confirmResolutionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message },
        });
      }
      if (parsed.data.photo_url && !deps.mediaStore.owns(parsed.data.photo_url)) {
        return reply.code(400).send({
          error: { code: "VALIDATION_ERROR", message: "photo_url must be a URL returned by POST /media." },
        });
      }

      const project = await deps.store.getProject(projectId);
      if (!project) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Project not found." } });
      }

      const submissions = await deps.store.getSubmissionsByIssue(project.issue_id);
      const isOriginalReporter = submissions.some((s) => s.citizen_id === request.citizenId);
      if (!isOriginalReporter) {
        return reply.code(403).send({
          error: {
            code: "NOT_AN_ORIGINAL_REPORTER",
            message: "Only citizens who reported the underlying issue can confirm its resolution.",
          },
        });
      }

      const impactRecord = await deps.store.getImpactRecord(projectId);
      if (!impactRecord) {
        return reply.code(409).send({
          error: { code: "NOT_MARKED_COMPLETE", message: "This project hasn't been marked complete yet." },
        });
      }

      const citizenId = request.citizenId!;
      const confirmedBy = impactRecord.confirmed_by ?? [];
      if (confirmedBy.includes(citizenId)) {
        return reply.code(409).send({
          error: { code: "ALREADY_CONFIRMED", message: "You have already responded for this project." },
        });
      }

      const updated: ImpactRecord = {
        ...impactRecord,
        confirmed_by: [...confirmedBy, citizenId],
        confirmations_received: impactRecord.confirmations_received + (parsed.data.confirmed ? 1 : 0),
        confirmations_negative: impactRecord.confirmations_negative + (parsed.data.confirmed ? 0 : 1),
        resolution_photo_url: parsed.data.photo_url ?? impactRecord.resolution_photo_url,
        verified_by: request.citizenId ?? impactRecord.verified_by,
      };
      const total = updated.confirmations_received + updated.confirmations_negative;
      updated.efficacy = total > 0 ? updated.confirmations_received / total : 0;
      if (updated.confirmations_received >= updated.confirmations_required && !updated.resolved_at) {
        updated.resolved_at = new Date().toISOString();
      }
      await deps.store.putImpactRecord(updated);

      // Resolution requires the confirmation threshold AND a separate officer
      // sign-off (docs/EDGE_CASES.md #13) — never flips on citizen input alone.
      await completeIfConfirmed(deps, projectId);

      return reply.code(200).send({ impact_id: updated.impact_id });
    },
  );
}
