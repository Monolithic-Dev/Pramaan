import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Deps } from "../deps.js";
import { requireAuth } from "../middleware/auth.js";
import { erasureRequestSchema } from "../schemas/privacy.js";

const ERASURE_SLA_DAYS = 30;

export function registerPrivacyRoutes(app: FastifyInstance, deps: Deps) {
  // docs/API_SPEC.md §7, docs/SECURITY_PRIVACY.md §3 (DPDP right-to-erasure).
  app.post(
    "/privacy/erasure-requests",
    { preHandler: [requireAuth(deps.authVerifier)] },
    async (request, reply) => {
      const parsed = erasureRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message },
        });
      }
      const citizenId = request.citizenId;
      if (!citizenId) {
        return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Sign in required." } });
      }

      const submissions = await deps.store.getSubmissionsByCitizen(citizenId);
      const tombstonedIssueIds = new Set<string>();

      for (const submission of submissions) {
        // Content nulled, status tombstoned, citizen_id unlinked — the
        // submission_id itself is preserved so report_count on any Issue it
        // fed into never has to change (docs/phases/phase-8-fraud-impact-crossborder.md "Traps").
        await deps.store.putSubmission({
          ...submission,
          citizen_id: "erased",
          raw_text: null,
          translated_text: null,
          pii_scrubbed_text: null,
          photo_url: null,
          raw_audio_url: null,
          location_text: null,
          lat: null,
          lng: null,
          submitter_ip_hash: null,
          status: "tombstoned",
        });

        if (submission.issue_id && !tombstonedIssueIds.has(submission.issue_id)) {
          const issue = await deps.store.getIssue(submission.issue_id);
          // Sole-source: this was the only submission behind the Issue.
          if (issue && issue.submission_ids.length === 1) {
            await deps.store.tombstoneIssue(issue.issue_id);
            tombstonedIssueIds.add(issue.issue_id);
          }
        }
      }

      // Audit entries record actor IDs and actions, never citizen content —
      // that is what makes retaining them compatible with erasure.
      await deps.store.putAuditLogEntry({
        audit_id: randomUUID(),
        actor_id: citizenId,
        action: "erasure_request",
        before: { submission_count: submissions.length },
        after: { tombstoned_issue_count: tombstonedIssueIds.size },
        justification: null,
        timestamp: new Date().toISOString(),
      });

      return reply
        .code(202)
        .send({ request_id: `era_${randomUUID().slice(0, 8)}`, sla_days: ERASURE_SLA_DAYS });
    },
  );

  // docs/API_SPEC.md §7 (DPDP access right).
  app.get(
    "/privacy/my-data",
    { preHandler: [requireAuth(deps.authVerifier)] },
    async (request, reply) => {
      const citizenId = request.citizenId;
      if (!citizenId) {
        return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Sign in required." } });
      }

      const [citizen, submissions, consentRecords] = await Promise.all([
        deps.store.getCitizen(citizenId),
        deps.store.getSubmissionsByCitizen(citizenId),
        deps.store.getConsentRecordsByCitizen(citizenId),
      ]);

      return reply.code(200).send({ citizen, submissions, consent_records: consentRecords });
    },
  );
}
