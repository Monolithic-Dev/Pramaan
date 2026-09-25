import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { IssueComment, OfficerRole } from "@jansetu/shared-types";
import type { Deps } from "../deps.js";
import { isWithinScope } from "../agent/scopeGuard.js";
import { requireAuth, requireOfficer } from "../middleware/auth.js";
import { getIssuesInScope, regionNameMap, regionsWithin } from "../services/consoleData.js";
import { notify } from "../services/notify.js";
import { audit, bad, issueInScope, notFound, outside, regionInScope, requireRole } from "./helpers.js";

export function registerWorkflowRoutes(app: FastifyInstance, deps: Deps) {
  const officerOnly = { preHandler: [requireOfficer(deps.authVerifier)] };

  /** Officers a colleague may assign work to: everyone whose jurisdiction reaches into mine. */
  async function directory(request: Parameters<typeof regionInScope>[1]) {
    const within = new Set(regionsWithin(await deps.bigqueryAgent.listRegions(), request.officer!.regionId ?? "").map((r) => r.regionId));
    return (await deps.officerAdmin.list()).filter((a) => !a.disabled && within.has(a.region_id));
  }

  async function labelFor(uid: string): Promise<string> {
    const account = (await deps.officerAdmin.list()).find((a) => a.uid === uid);
    return account?.email ?? uid.slice(0, 8);
  }

  app.get("/officers/directory", officerOnly, async (request, reply) => {
    const officers = await directory(request);
    return reply.code(200).send({
      officers: officers.map((o) => ({ uid: o.uid, email: o.email, role: o.role, region_id: o.region_id })),
    });
  });

  // ---- Assignment and SLA ---------------------------------------------------------------------------

  app.post("/issues/:issueId/assign", officerOnly, async (request, reply) => {
    if (!requireRole(request, reply, "district_collector", "Assigning an issue")) return;
    const body = z
      .object({ officer_uid: z.string().min(1).nullable(), due_in_days: z.number().int().min(1).max(180).optional() })
      .safeParse(request.body);
    if (!body.success) return reply.code(400).send(bad(body.error.issues[0]?.message));

    const { issueId } = request.params as { issueId: string };
    const issue = await deps.store.getIssue(issueId);
    if (!issue || issue.status === "tombstoned") return reply.code(404).send(notFound("Issue"));
    if (!(await issueInScope(deps, request, reply, issue))) return;

    let label: string | null = null;
    if (body.data.officer_uid) {
      const assignee = (await deps.officerAdmin.list()).find((a) => a.uid === body.data.officer_uid && !a.disabled);
      const issueRegion = issue.admin_region_id ?? issue.state_id;
      // The assignee must actually be able to see the issue: their jurisdiction must cover its region.
      if (!assignee || !assignee.region_id || !(await isWithinScope(deps.bigqueryAgent, issueRegion, assignee.region_id))) {
        return reply.code(409).send({ error: { code: "INVALID_ASSIGNEE", message: "That officer's jurisdiction does not cover this issue." } });
      }
      label = assignee.email;
    }

    const dueAt = body.data.due_in_days ? new Date(Date.now() + body.data.due_in_days * 86_400_000).toISOString() : issue.sla_due_at ?? null;
    const updated = await deps.store.updateIssue(issueId, {
      assigned_to_uid: body.data.officer_uid,
      assigned_to_label: label,
      assigned_at: body.data.officer_uid ? new Date().toISOString() : null,
      sla_due_at: dueAt,
    });
    await audit(deps, request, body.data.officer_uid ? "issue_assigned" : "issue_unassigned", issueId, { assigned_to: issue.assigned_to_uid ?? null }, { assigned_to: body.data.officer_uid, sla_due_at: dueAt }, null);
    if (body.data.officer_uid && body.data.officer_uid !== request.citizenId) {
      await notify(deps, [body.data.officer_uid], { kind: "issue.assigned", params: { category: issue.category, issue_id: issueId }, link: `/console/issues/${issueId}` });
    }
    return reply.code(200).send({ issue_id: issueId, assigned_to_uid: updated.assigned_to_uid, assigned_to_label: updated.assigned_to_label, sla_due_at: updated.sla_due_at });
  });

  // ---- Internal notes -------------------------------------------------------------------------------

  app.get("/issues/:issueId/comments", officerOnly, async (request, reply) => {
    const { issueId } = request.params as { issueId: string };
    const issue = await deps.store.getIssue(issueId);
    if (!issue || issue.status === "tombstoned") return reply.code(404).send(notFound("Issue"));
    if (!(await issueInScope(deps, request, reply, issue))) return;
    return reply.code(200).send({ comments: await deps.store.listComments(issueId) });
  });

  app.post("/issues/:issueId/comments", officerOnly, async (request, reply) => {
    const body = z.object({ body: z.string().trim().min(1).max(1000) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send(bad(body.error.issues[0]?.message));
    const { issueId } = request.params as { issueId: string };
    const issue = await deps.store.getIssue(issueId);
    if (!issue || issue.status === "tombstoned") return reply.code(404).send(notFound("Issue"));
    if (!(await issueInScope(deps, request, reply, issue))) return;

    const comment: IssueComment = {
      comment_id: `cmt_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
      issue_id: issueId,
      author_id: request.citizenId!,
      author_label: await labelFor(request.citizenId!),
      author_role: request.officer!.role as OfficerRole,
      body: body.data.body,
      created_at: new Date().toISOString(),
    };
    await deps.store.putComment(comment);
    if (issue.assigned_to_uid && issue.assigned_to_uid !== request.citizenId) {
      await notify(deps, [issue.assigned_to_uid], { kind: "issue.comment", params: { category: issue.category, issue_id: issueId }, link: `/console/issues/${issueId}` });
    }
    return reply.code(201).send(comment);
  });

  // ---- Notifications (citizens and officers) ------------------------------------------------------

  app.get("/notifications", { preHandler: [requireAuth(deps.authVerifier)] }, async (request, reply) => {
    const items = await deps.store.listNotifications(request.citizenId!, 50);
    return reply.code(200).send({ notifications: items, unread: items.filter((n) => !n.read_at).length });
  });

  app.post("/notifications/read", { preHandler: [requireAuth(deps.authVerifier)] }, async (request, reply) => {
    const body = z.object({ ids: z.array(z.string()).max(100).optional() }).safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send(bad(body.error.issues[0]?.message));
    const changed = await deps.store.markNotificationsRead(request.citizenId!, body.data.ids ?? null);
    return reply.code(200).send({ marked: changed });
  });

  // ---- Live activity feed -------------------------------------------------------------------------

  app.get("/activity", officerOnly, async (request, reply) => {
    const q = z.object({ region: z.string().optional() }).safeParse(request.query);
    if (!q.success) return reply.code(400).send(bad(q.error.issues[0]?.message));
    const region = q.data.region ?? request.officer!.regionId;
    if (!(await regionInScope(deps, request, region))) return reply.code(403).send(outside);

    const [issues, regions, log, projects] = await Promise.all([
      getIssuesInScope(deps, region!),
      regionNameMap(deps),
      deps.store.listAuditLog(300),
      deps.store.listProjects(),
    ]);
    const byId = new Map(issues.map((i) => [i.issue_id, i]));
    const projectToIssue = new Map(projects.map((p) => [p.project_id, p.issue_id]));
    const nameOf = (id: string | null) => (id ? regions.get(id)?.name ?? null : null);

    const events = [
      ...issues.map((i) => ({
        kind: "report" as const,
        at: i.last_reported_at,
        issue_id: i.issue_id,
        category: i.category,
        region_name: nameOf(i.admin_region_id),
        detail: i.report_count > 1 ? `${i.report_count} reports` : null,
        action: null as string | null,
      })),
      ...log.flatMap((a) => {
        const issueId = a.target_id ? (byId.has(a.target_id) ? a.target_id : projectToIssue.get(a.target_id)) : undefined;
        const issue = issueId ? byId.get(issueId) : undefined;
        return issue
          ? [{ kind: "action" as const, at: a.timestamp, issue_id: issue.issue_id, category: issue.category, region_name: nameOf(issue.admin_region_id), detail: null, action: a.action }]
          : [];
      }),
    ]
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, 20);
    return reply.code(200).send({ events });
  });
}
