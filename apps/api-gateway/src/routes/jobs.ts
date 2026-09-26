import { createHash, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Deps } from "../deps.js";
import { isWithinScope } from "../agent/scopeGuard.js";
import { notify } from "../services/notify.js";
import { ESCALATION_ROLE, slaFor } from "../services/sla.js";

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Background jobs the scheduler calls (GitHub Actions on the free stack, Cloud Scheduler on GCP),
 *  guarded by the same shared secret as the worker's jobs. Disabled when no secret is configured. */
export function registerJobRoutes(app: FastifyInstance, deps: Deps) {
  app.post("/jobs/escalations", async (request, reply) => {
    const secret = process.env.WORKER_SHARED_SECRET;
    const given = request.headers["x-worker-secret"];
    if (!secret || typeof given !== "string" || !timingSafeEqual(digest(given), digest(secret))) {
      return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "A valid x-worker-secret is required." } });
    }

    const [issues, officers] = await Promise.all([deps.store.listIssues(), deps.officerAdmin.list()]);
    const active = officers.filter((o) => !o.disabled && o.region_id);
    let escalated = 0;
    let notified = 0;

    for (const issue of issues) {
      if (issue.status === "tombstoned") continue;
      const { escalation, days_left } = slaFor(issue);
      if (escalation === 0 || escalation <= (issue.escalation_notified ?? 0)) continue;

      // The officers of the escalation role whose jurisdiction covers the issue; if a district has no
      // collector on the platform yet, the state admin gets it rather than nobody.
      const region = issue.admin_region_id ?? issue.state_id;
      const covering = [];
      for (const o of active) if (await isWithinScope(deps.bigqueryAgent, region, o.region_id)) covering.push(o);
      let recipients = covering.filter((o) => o.role === ESCALATION_ROLE[escalation]);
      if (recipients.length === 0) recipients = covering.filter((o) => o.role === "state_admin");

      notified += await notify(
        deps,
        recipients.map((o) => o.uid),
        { kind: "issue.escalated", params: { category: issue.category, days: Math.abs(days_left ?? 0), issue_id: issue.issue_id }, link: `/console/issues/${issue.issue_id}` },
      );
      await deps.store.updateIssue(issue.issue_id, { escalation_notified: escalation });
      escalated += 1;
    }
    return reply.code(200).send({ escalated, notified });
  });
}
