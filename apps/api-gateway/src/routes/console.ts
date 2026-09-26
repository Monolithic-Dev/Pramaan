import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { getCountryProfile, type Issue, type IssueStatus, type Project } from "@pramaan/shared-types";
import type { Deps } from "../deps.js";
import { audit, bad, forbidden, issueInScope, outside } from "./helpers.js";
import { generateBrief } from "../agent/tools.js";
import { isWithinScope } from "../agent/scopeGuard.js";
import { priorityBand } from "../insights/transparency.js";
import { hasMinimumRole, requireAuth, requireOfficer } from "../middleware/auth.js";
import { DEPARTMENT, estimateBudget } from "../services/costing.js";
import { notifyReporters } from "../services/notify.js";
import { slaFor } from "../services/sla.js";
import { permissionsFor } from "../services/permissions.js";
import {
  computeOverview,
  getIssuesInScope,
  regionNameMap,
  regionsWithin,
  summarizeIssue,
} from "../services/consoleData.js";

const STATUS_TARGETS = ["verified", "disputed", "prioritized", "funded", "in_progress"] as const;

export function registerConsoleRoutes(app: FastifyInstance, deps: Deps) {
  const officerOnly = { preHandler: [requireOfficer(deps.authVerifier)] };

  // ---- Identity ----------------------------------------------------------------------------

  // Who am I, what may I do? The web app builds its whole navigation from this.
  app.get("/me", { preHandler: [requireAuth(deps.authVerifier)] }, async (request, reply) => {
    const officer = request.officer;
    const citizen = officer ? null : await deps.store.getCitizen(request.citizenId!);
    return reply.code(200).send({
      uid: request.citizenId,
      kind: officer ? "officer" : "citizen",
      role: officer?.role ?? null,
      region_id: officer?.regionId ?? null,
      country_code: officer?.countryCode ?? citizen?.country_code ?? null,
      preferred_language: citizen?.preferred_language ?? null,
      permissions: permissionsFor(officer?.role ?? null),
    });
  });

  // Email/password (and any non-OTP) citizens have no Citizen record until they first sign in.
  app.post("/auth/session", { preHandler: [requireAuth(deps.authVerifier)] }, async (request, reply) => {
    if (request.officer) return reply.code(200).send({ kind: "officer" });
    const body = z
      .object({ preferred_language: z.string().min(2).max(10).optional(), country_code: z.string().length(2).optional() })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send(bad(body.error.issues[0]?.message));

    let citizen = await deps.store.getCitizen(request.citizenId!);
    if (!citizen) {
      const country = getCountryProfile(body.data.country_code);
      citizen = {
        citizen_id: request.citizenId!,
        phone_hash: "none",
        preferred_language: body.data.preferred_language ?? `${country.canonical_working_language}-${country.country_code}`,
        country_code: country.country_code,
        created_at: new Date().toISOString(),
        erasure_requested_at: null,
      };
      await deps.store.putCitizen(citizen);
    }
    return reply.code(200).send({ kind: "citizen", citizen });
  });

  // ---- Citizen: my reports -------------------------------------------------------------------

  app.get("/my-reports", { preHandler: [requireAuth(deps.authVerifier)] }, async (request, reply) => {
    const submissions = (await deps.store.getSubmissionsByCitizen(request.citizenId!))
      .filter((s) => s.status !== "tombstoned")
      .sort((a, b) => (a.submitted_at < b.submitted_at ? 1 : -1));
    const issueIds = [...new Set(submissions.map((s) => s.issue_id).filter((id): id is string => Boolean(id)))];
    const issues = new Map(
      (await Promise.all(issueIds.map((id) => deps.store.getIssue(id)))).filter((i): i is Issue => i !== null).map((i) => [i.issue_id, i]),
    );
    return reply.code(200).send({
      reports: submissions.map((s) => {
        const issue = s.issue_id ? issues.get(s.issue_id) : undefined;
        return {
          submission_id: s.submission_id,
          submitted_at: s.submitted_at,
          channel: s.channel,
          text: s.raw_text,
          has_photo: Boolean(s.photo_url),
          has_audio: Boolean(s.raw_audio_url),
          processing: s.status,
          category: issue?.category ?? null,
          issue_status: issue?.status ?? null,
          priority: issue ? priorityBand(issue.composite_score) : "pending",
          other_reporters: issue ? Math.max(0, issue.distinct_reporter_count - 1) : 0,
        };
      }),
    });
  });

  // ---- Officer console: issues -----------------------------------------------------------------

  app.get("/issues", officerOnly, async (request, reply) => {
    const q = z
      .object({
        region: z.string().optional(),
        category: z.string().optional(),
        status: z.string().optional(),
        q: z.string().optional(),
        sort: z.enum(["score", "reports", "recent"]).default("score"),
        flagged: z.enum(["true", "false"]).optional(),
        assigned: z.enum(["me", "unassigned"]).optional(),
        overdue: z.enum(["true"]).optional(),
        limit: z.coerce.number().int().min(1).max(500).default(200),
      })
      .safeParse(request.query);
    if (!q.success) return reply.code(400).send(bad(q.error.issues[0]?.message));

    const officer = request.officer!;
    const region = q.data.region ?? officer.regionId;
    if (!region || !officer.regionId || !(await isWithinScope(deps.bigqueryAgent, region, officer.regionId))) {
      return reply.code(403).send(outside);
    }

    const [issues, regions, projects] = await Promise.all([
      getIssuesInScope(deps, region),
      regionNameMap(deps),
      deps.store.listProjects(),
    ]);
    const withProject = new Set(projects.map((p) => p.issue_id));
    const needle = q.data.q?.trim().toLowerCase();

    const filtered = issues
      .filter((i) => !q.data.category || i.category === q.data.category)
      .filter((i) => !q.data.status || i.status === q.data.status)
      .filter((i) => q.data.flagged === undefined || (i.fraud_flags.length > 0) === (q.data.flagged === "true"))
      .filter((i) => q.data.assigned === undefined || (q.data.assigned === "me" ? i.assigned_to_uid === request.citizenId : !i.assigned_to_uid))
      .filter((i) => !q.data.overdue || slaFor(i).state === "overdue")
      .filter(
        (i) =>
          !needle ||
          i.canonical_description.toLowerCase().includes(needle) ||
          i.subcategory.toLowerCase().includes(needle) ||
          (regions.get(i.admin_region_id ?? "")?.name ?? "").toLowerCase().includes(needle),
      );

    const sorters = {
      score: (a: Issue, b: Issue) => (b.composite_score ?? -1) - (a.composite_score ?? -1) || b.report_count - a.report_count,
      reports: (a: Issue, b: Issue) => b.report_count - a.report_count,
      recent: (a: Issue, b: Issue) => (a.last_reported_at < b.last_reported_at ? 1 : -1),
    };
    filtered.sort(sorters[q.data.sort]);

    return reply.code(200).send({
      total: filtered.length,
      region,
      issues: filtered.slice(0, q.data.limit).map((i) => summarizeIssue(i, regions, withProject)),
    });
  });

  app.get("/issues/:issueId", officerOnly, async (request, reply) => {
    const { issueId } = request.params as { issueId: string };
    const issue = await deps.store.getIssue(issueId);
    if (!issue || issue.status === "tombstoned") {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Issue not found." } });
    }
    if (!(await issueInScope(deps, request, reply, issue))) return;

    const [regions, score, submissions, project, impact, auditLog] = await Promise.all([
      regionNameMap(deps),
      deps.store.getCanonicalScore(issueId),
      deps.store.getSubmissionsByIssue(issueId),
      deps.store.getProjectByIssue(issueId),
      deps.store.getImpactRecordByIssue(issueId),
      deps.store.listAuditLog(500),
    ]);
    const { embedding: _embedding, submission_ids: _ids, ...safe } = issue;

    return reply.code(200).send({
      issue: { ...safe, ...summarizeIssue(issue, regions) },
      score,
      project,
      impact,
      // Reports are shown without who filed them: an officer needs the content and the count,
      // not the reporter's identity (docs/SECURITY_PRIVACY.md data minimisation).
      reports: submissions
        .filter((s) => s.status !== "tombstoned")
        .sort((a, b) => (a.submitted_at < b.submitted_at ? -1 : 1))
        .slice(0, 100)
        .map((s) => ({
          submission_id: s.submission_id,
          channel: s.channel,
          submitted_at: s.submitted_at,
          language: s.detected_language,
          text: s.pii_scrubbed_text,
          translated_text: s.translated_text,
          photo: s.photo_url,
          has_audio: Boolean(s.raw_audio_url),
          location_confidence: s.location_confidence,
        })),
      history: auditLog.filter((a) => a.target_id === issueId || a.target_id === project?.project_id),
    });
  });

  // Photos are stored privately; officers fetch the bytes through the API, not a public URL.
  app.get("/media/*", officerOnly, async (request, reply) => {
    const url = decodeURIComponent((request.params as { "*": string })["*"]);
    const media = await deps.mediaStore.get(url);
    if (!media) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Media not found." } });
    return reply.code(200).header("content-type", media.contentType).header("cache-control", "private, max-age=300").send(media.data);
  });

  app.post("/issues/:issueId/status", officerOnly, async (request, reply) => {
    const officer = request.officer!;
    if (!hasMinimumRole(officer.role, "district_collector")) {
      return reply.code(403).send(forbidden("Changing an issue's status requires role >= district_collector."));
    }
    const body = z
      .object({ status: z.enum(STATUS_TARGETS), justification: z.string().min(3).max(500) })
      .safeParse(request.body);
    if (!body.success) return reply.code(400).send(bad(body.error.issues[0]?.message));

    const { issueId } = request.params as { issueId: string };
    const issue = await deps.store.getIssue(issueId);
    if (!issue || issue.status === "tombstoned") {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Issue not found." } });
    }
    if (!(await issueInScope(deps, request, reply, issue))) return;
    if (issue.status === "resolved") {
      return reply.code(409).send({ error: { code: "CONFLICT", message: "A resolved issue can only be reopened by the impact loop." } });
    }

    const updated = await deps.store.updateIssue(issueId, { status: body.data.status as IssueStatus });
    await audit(deps, request, "issue_status_change", issueId, { status: issue.status }, { status: updated.status }, body.data.justification);
    await notifyReporters(deps, issue, "issue.status_changed", { status: updated.status });
    return reply.code(200).send({ issue_id: issueId, status: updated.status });
  });

  // ---- Officer console: projects ----------------------------------------------------------------

  app.post("/issues/:issueId/project", officerOnly, async (request, reply) => {
    if (!hasMinimumRole(request.officer!.role, "district_collector")) {
      return reply.code(403).send(forbidden("Recommending a project requires role >= district_collector."));
    }
    const { issueId } = request.params as { issueId: string };
    const issue = await deps.store.getIssue(issueId);
    if (!issue || issue.status === "tombstoned") {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Issue not found." } });
    }
    if (!(await issueInScope(deps, request, reply, issue))) return;
    if (await deps.store.getProjectByIssue(issueId)) {
      return reply.code(409).send({ error: { code: "ALREADY_EXISTS", message: "This issue already has a project." } });
    }

    const brief = await generateBrief(deps, issueId);
    if (!("generated_brief" in brief)) {
      return reply.code(409).send({ error: { code: "NOT_SCORED", message: "Score this issue first (it needs 3 distinct reporters or an emergency override)." } });
    }
    const score = await deps.store.getCanonicalScore(issueId);
    const budget = estimateBudget(issue);
    const project: Project = {
      project_id: `proj_${randomUUID().replace(/-/g, "").slice(0, 10)}`,
      issue_id: issueId,
      country_code: issue.country_code,
      state_id: issue.state_id,
      generated_brief: brief.generated_brief,
      brief_model_version: "template-grounded-v1",
      brief_citations: brief.brief_citations,
      groundedness_check: brief.groundedness_check,
      composite_score: score?.composite_score ?? issue.composite_score ?? 0,
      status: "recommended",
      assigned_dept: DEPARTMENT[issue.category] ?? DEPARTMENT.other,
      budget_estimate_inr: budget,
      marked_complete_at: null,
      officer_signed_off_at: null,
    };
    await deps.store.putProject(project);
    if (issue.status === "open" || issue.status === "verified") await deps.store.updateIssue(issueId, { status: "prioritized" });
    await audit(deps, request, "project_recommended", issueId, null, { project_id: project.project_id }, null);
    return reply.code(201).send(project);
  });

  app.get("/projects", officerOnly, async (request, reply) => {
    const officer = request.officer!;
    const [projects, regions] = await Promise.all([deps.store.listProjects(), regionNameMap(deps)]);
    const rows = [];
    for (const project of projects) {
      const issue = await deps.store.getIssue(project.issue_id);
      if (!issue) continue;
      const target = issue.admin_region_id ?? issue.state_id;
      if (!officer.regionId || !(await isWithinScope(deps.bigqueryAgent, target, officer.regionId))) continue;
      rows.push({ ...project, issue: summarizeIssue(issue, regions) });
    }
    rows.sort((a, b) => b.composite_score - a.composite_score);
    return reply.code(200).send({ projects: rows });
  });

  app.post("/projects/:projectId/status", officerOnly, async (request, reply) => {
    if (!hasMinimumRole(request.officer!.role, "district_collector")) {
      return reply.code(403).send(forbidden("Changing a project's status requires role >= district_collector."));
    }
    const body = z.object({ status: z.enum(["funded", "in_progress"]) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send(bad(body.error.issues[0]?.message));

    const { projectId } = request.params as { projectId: string };
    const project = await deps.store.getProject(projectId);
    if (!project) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Project not found." } });
    const issue = await deps.store.getIssue(project.issue_id);
    if (!issue || !(await issueInScope(deps, request, reply, issue))) return;
    if (project.status === "completed") {
      return reply.code(409).send({ error: { code: "CONFLICT", message: "This project is already completed." } });
    }

    const updated = await deps.store.updateProject(projectId, { status: body.data.status });
    await deps.store.updateIssue(issue.issue_id, { status: body.data.status });
    await audit(deps, request, "project_status_change", projectId, { status: project.status }, { status: updated.status }, null);
    await notifyReporters(deps, issue, body.data.status === "funded" ? "issue.funded" : "issue.status_changed", { status: body.data.status });
    return reply.code(200).send(updated);
  });

  // ---- Officer console: analytics, regions ---------------------------------------------------------

  app.get("/analytics/overview", officerOnly, async (request, reply) => {
    const q = z.object({ region: z.string().optional() }).safeParse(request.query);
    if (!q.success) return reply.code(400).send(bad(q.error.issues[0]?.message));
    const officer = request.officer!;
    const region = q.data.region ?? officer.regionId;
    if (!region || !officer.regionId || !(await isWithinScope(deps.bigqueryAgent, region, officer.regionId))) {
      return reply.code(403).send(outside);
    }
    const [issues, regions] = await Promise.all([getIssuesInScope(deps, region), regionNameMap(deps)]);
    return reply.code(200).send({ region, region_name: regions.get(region)?.name ?? region, ...computeOverview(issues, regions) });
  });

  // Reference geography for pickers and filters: the regions inside the officer's jurisdiction.
  app.get("/regions", officerOnly, async (request, reply) => {
    const officer = request.officer!;
    if (!officer.regionId) return reply.code(200).send({ regions: [] });
    return reply.code(200).send({ regions: regionsWithin(await deps.bigqueryAgent.listRegions(), officer.regionId) });
  });

  // ---- State admin: officer accounts and the audit log ---------------------------------------------

  const adminOnly = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!hasMinimumRole(request.officer!.role, "state_admin")) {
      return reply.code(403).send(forbidden("This requires the state_admin role."));
    }
  };

  app.get("/admin/officers", { preHandler: [requireOfficer(deps.authVerifier), adminOnly] }, async (request, reply) => {
    const officer = request.officer!;
    const all = await deps.officerAdmin.list();
    const visible = [];
    for (const account of all) {
      // A state admin manages officers inside their own jurisdiction only.
      if (officer.regionId && account.region_id && (await isWithinScope(deps.bigqueryAgent, account.region_id, officer.regionId))) {
        visible.push(account);
      }
    }
    return reply.code(200).send({ officers: visible });
  });

  app.post("/admin/officers", { preHandler: [requireOfficer(deps.authVerifier), adminOnly] }, async (request, reply) => {
    const body = z
      .object({
        email: z.string().email(),
        password: z.string().min(10, "Password must be at least 10 characters."),
        role: z.enum(["field_officer", "district_collector", "state_admin"]),
        region_id: z.string().min(1),
      })
      .safeParse(request.body);
    if (!body.success) return reply.code(400).send(bad(body.error.issues[0]?.message));

    const officer = request.officer!;
    if (!officer.regionId || !(await isWithinScope(deps.bigqueryAgent, body.data.region_id, officer.regionId))) {
      return reply.code(403).send(outside);
    }
    try {
      const account = await deps.officerAdmin.create({
        email: body.data.email,
        password: body.data.password,
        role: body.data.role,
        regionId: body.data.region_id,
        countryCode: officer.countryCode ?? "IN",
      });
      await audit(deps, request, "officer_created", account.uid, null, { email: account.email, role: account.role, region_id: account.region_id }, null);
      return reply.code(201).send(account);
    } catch (err) {
      if (/already/i.test(String((err as Error).message))) {
        return reply.code(409).send({ error: { code: "ALREADY_EXISTS", message: "An account with that email already exists." } });
      }
      throw err;
    }
  });

  app.post("/admin/officers/:uid/disabled", { preHandler: [requireOfficer(deps.authVerifier), adminOnly] }, async (request, reply) => {
    const body = z.object({ disabled: z.boolean() }).safeParse(request.body);
    if (!body.success) return reply.code(400).send(bad(body.error.issues[0]?.message));
    const { uid } = request.params as { uid: string };
    if (uid === request.citizenId) {
      return reply.code(409).send({ error: { code: "CONFLICT", message: "You cannot disable your own account." } });
    }
    const target = (await deps.officerAdmin.list()).find((a) => a.uid === uid);
    const officer = request.officer!;
    if (!target || !officer.regionId || !(await isWithinScope(deps.bigqueryAgent, target.region_id, officer.regionId))) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Officer not found." } });
    }
    const updated = await deps.officerAdmin.setDisabled(uid, body.data.disabled);
    await audit(deps, request, body.data.disabled ? "officer_disabled" : "officer_enabled", uid, null, { disabled: body.data.disabled }, null);
    return reply.code(200).send(updated);
  });

  // Only entries about things inside the admin's jurisdiction, or made by officers inside it.
  app.get("/admin/audit", { preHandler: [requireOfficer(deps.authVerifier), adminOnly] }, async (request, reply) => {
    const scope = request.officer!.regionId;
    if (!scope) return reply.code(200).send({ entries: [] });
    const [entries, issues, projects, plans, officers, allRegions] = await Promise.all([
      deps.store.listAuditLog(1000),
      getIssuesInScope(deps, scope),
      deps.store.listProjects(),
      deps.store.listPlans(),
      deps.officerAdmin.list(),
      deps.bigqueryAgent.listRegions(),
    ]);
    const within = new Set(regionsWithin(allRegions, scope).map((r) => r.regionId));
    const issueIds = new Set(issues.map((i) => i.issue_id));
    const officerIds = new Set(officers.filter((o) => within.has(o.region_id)).map((o) => o.uid));
    const targets = new Set([
      ...issueIds,
      ...projects.filter((p) => issueIds.has(p.issue_id)).map((p) => p.project_id),
      ...plans.filter((p) => within.has(p.region_id)).map((p) => p.plan_id),
      ...officerIds,
    ]);
    const visible = entries.filter((e) => (e.target_id && targets.has(e.target_id)) || officerIds.has(e.actor_id));
    return reply.code(200).send({ entries: visible.slice(0, 200) });
  });

  // ---- Public (no login, aggregate only) -------------------------------------------------------------

  app.get("/public/overview", async (request, reply) => {
    const count = await deps.store.incrementRateLimit(`public-overview:${request.ip}`, 60_000);
    if (count > 60) return reply.code(429).send({ error: { code: "RATE_LIMITED", message: "Too many requests." } });
    const issues = (await deps.store.listIssues()).filter((i) => i.status !== "tombstoned");
    // Same k-anonymity floor as the transparency ledger: no numbers for a handful of issues.
    if (issues.length < 5) return reply.code(200).send({ status: "insufficient_data", min_required: 5 });
    const regions = await regionNameMap(deps);
    const overview = computeOverview(issues, regions);
    return reply.code(200).send({
      status: "ok",
      totals: overview.totals,
      by_category: overview.by_category,
      by_status: overview.by_status,
      trend_monthly: overview.trend_monthly,
      states: [...new Set(issues.map((i) => i.state_id))].length,
    });
  });

  app.get("/public/regions", async (request, reply) => {
    const q = z.object({ level: z.string().optional(), parent: z.string().optional(), country: z.string().optional() }).safeParse(request.query);
    if (!q.success) return reply.code(400).send(bad(q.error.issues[0]?.message));
    const regions = await deps.bigqueryAgent.listRegions({ level: q.data.level, parentId: q.data.parent, countryCode: q.data.country });
    return reply.code(200).send({ regions });
  });
}
