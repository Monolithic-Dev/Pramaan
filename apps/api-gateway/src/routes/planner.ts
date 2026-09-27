import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { BudgetPlan, Project } from "@pramaan/shared-types";
import type { Deps } from "../deps.js";
import { generateBrief } from "../agent/tools.js";
import { requireOfficer } from "../middleware/auth.js";
import { SCHEMES, SCHEME_BY_ID } from "../data/schemes.js";
import { getIssuesInScope, regionNameMap } from "../services/consoleData.js";
import { DEPARTMENT } from "../services/costing.js";
import { notifyReporters, notify } from "../services/notify.js";
import { NOT_PLANNABLE, buildCandidates, optimizePlan, simulateWeights } from "../services/planner.js";
import { computeAlignment, inferSettlement, matchSchemes, type Settlement } from "../services/schemes.js";
import { audit, bad, issueInScope, notFound, outside, regionInScope, requireRole } from "./helpers.js";

const paramsSchema = z.object({
  region: z.string().optional(),
  budget_inr: z.number().int().min(100_000).max(100_000_000_000),
  min_vulnerable_share: z.number().min(0).max(1).default(0.3),
});

export function registerPlannerRoutes(app: FastifyInstance, deps: Deps) {
  const officerOnly = { preHandler: [requireOfficer(deps.authVerifier)] };

  /** Everything the optimiser needs for a region, gathered once. */
  async function planningInputs(region: string) {
    const [issues, scores, projects, regions] = await Promise.all([
      getIssuesInScope(deps, region),
      deps.store.listScores(),
      deps.store.listProjects(),
      regionNameMap(deps),
    ]);
    return {
      issues,
      regions,
      scoreById: new Map(scores.map((s) => [s.issue_id, s])),
      projectByIssue: new Map<string, Project>(projects.map((p) => [p.issue_id, p])),
    };
  }

  // ---- Scheme catalogue and matching ---------------------------------------------------------------------

  app.get("/schemes", officerOnly, async (_request, reply) => reply.code(200).send({ schemes: SCHEMES }));

  app.get("/issues/:issueId/schemes", officerOnly, async (request, reply) => {
    const q = z.object({ settlement: z.enum(["urban", "rural"]).optional() }).safeParse(request.query);
    if (!q.success) return reply.code(400).send(bad(q.error.issues[0]?.message));
    const { issueId } = request.params as { issueId: string };
    const issue = await deps.store.getIssue(issueId);
    if (!issue || issue.status === "tombstoned") return reply.code(404).send(notFound("Issue"));
    if (!(await issueInScope(deps, request, reply, issue))) return;

    const regions = await regionNameMap(deps);
    const inferred = inferSettlement(issue.admin_region_id ? regions.get(issue.admin_region_id) : undefined);
    const settlement: Settlement = q.data.settlement ?? inferred.settlement;
    const project = await deps.store.getProjectByIssue(issueId);
    return reply.code(200).send({
      settlement,
      settlement_basis: q.data.settlement ? "Set by you" : inferred.basis,
      budget_inr: project?.budget_estimate_inr ?? null,
      matches: matchSchemes(issue, settlement, project?.budget_estimate_inr).slice(0, 5),
    });
  });

  // How much of the open work in a region could be drawn from central programmes, and through which.
  app.get("/schemes/alignment", officerOnly, async (request, reply) => {
    const q = z.object({ region: z.string().optional() }).safeParse(request.query);
    if (!q.success) return reply.code(400).send(bad(q.error.issues[0]?.message));
    const region = q.data.region ?? request.officer!.regionId;
    if (!(await regionInScope(deps, request, region))) return reply.code(403).send(outside);
    const [issues, regions] = await Promise.all([getIssuesInScope(deps, region!), regionNameMap(deps)]);
    return reply.code(200).send({ region, ...computeAlignment(issues, regions) });
  });

  // ---- Budget optimiser ---------------------------------------------------------------------------------

  app.post("/planner/optimize", officerOnly, async (request, reply) => {
    if (!requireRole(request, reply, "district_collector", "Budget planning")) return;
    const body = paramsSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send(bad(body.error.issues[0]?.message));
    const region = body.data.region ?? request.officer!.regionId;
    if (!(await regionInScope(deps, request, region))) return reply.code(403).send(outside);

    const { issues, regions, scoreById, projectByIssue } = await planningInputs(region!);
    const candidates = buildCandidates(issues, scoreById, projectByIssue, regions);
    const result = optimizePlan(candidates, { budget_inr: body.data.budget_inr, min_vulnerable_share: body.data.min_vulnerable_share });
    const describe = (c: { issue_id: string }) => {
      const issue = issues.find((i) => i.issue_id === c.issue_id)!;
      return {
        description: issue.canonical_description,
        subcategory: issue.subcategory,
        region_name: issue.admin_region_id ? regions.get(issue.admin_region_id)?.name ?? null : null,
        report_count: issue.report_count,
      };
    };
    return reply.code(200).send({
      region,
      params: { budget_inr: body.data.budget_inr, min_vulnerable_share: body.data.min_vulnerable_share },
      ...result,
      plan: { ...result.plan, items: result.plan.items.map((c) => ({ ...c, ...describe(c) })) },
      left_out: result.left_out.map((c) => ({ ...c, ...describe(c) })),
    });
  });

  app.post("/planner/plans", officerOnly, async (request, reply) => {
    if (!requireRole(request, reply, "district_collector", "Saving a plan")) return;
    const body = paramsSchema.extend({ name: z.string().trim().min(2).max(80) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send(bad(body.error.issues[0]?.message));
    const region = body.data.region ?? request.officer!.regionId;
    if (!(await regionInScope(deps, request, region))) return reply.code(403).send(outside);

    // Recomputed on the server: the client never gets to dictate which issues a plan contains.
    const { issues, regions, scoreById, projectByIssue } = await planningInputs(region!);
    const result = optimizePlan(buildCandidates(issues, scoreById, projectByIssue, regions), {
      budget_inr: body.data.budget_inr,
      min_vulnerable_share: body.data.min_vulnerable_share,
    });
    const plan: BudgetPlan = {
      plan_id: `plan_${randomUUID().replace(/-/g, "").slice(0, 10)}`,
      name: body.data.name,
      region_id: region!,
      created_by: request.citizenId!,
      created_at: new Date().toISOString(),
      status: "draft",
      approved_at: null,
      params: { budget_inr: body.data.budget_inr, min_vulnerable_share: body.data.min_vulnerable_share },
      items: result.plan.items.map(({ reports: _r, has_project: _h, ...item }) => item),
      totals: { cost_inr: result.plan.cost_inr, beneficiaries: result.plan.beneficiaries, vulnerable_share: result.plan.vulnerable_share, issues: result.plan.items.length },
    };
    await deps.store.putPlan(plan);
    await audit(deps, request, "plan_saved", plan.plan_id, null, { budget_inr: plan.params.budget_inr, issues: plan.totals.issues }, null);
    return reply.code(201).send(plan);
  });

  app.get("/planner/plans", officerOnly, async (request, reply) => {
    const plans = await deps.store.listPlans();
    const visible = [];
    for (const p of plans) if (await regionInScope(deps, request, p.region_id)) visible.push(p);
    return reply.code(200).send({ plans: visible });
  });

  // Approving a plan is the moment citizen demand becomes committed money: every issue in it gets a
  // project (created with a grounded brief if it has none) and moves to "funded", and the people who
  // reported those issues are told.
  app.post("/planner/plans/:planId/approve", officerOnly, async (request, reply) => {
    if (!requireRole(request, reply, "district_collector", "Approving a plan")) return;
    const { planId } = request.params as { planId: string };
    const plan = await deps.store.getPlan(planId);
    if (!plan) return reply.code(404).send(notFound("Plan"));
    if (!(await regionInScope(deps, request, plan.region_id))) return reply.code(403).send(outside);
    if (plan.status === "approved") return reply.code(409).send({ error: { code: "CONFLICT", message: "This plan is already approved." } });

    let funded = 0;
    const skipped: { issue_id: string; reason: string }[] = [];
    for (const item of plan.items) {
      const issue = await deps.store.getIssue(item.issue_id);
      // Re-checked at approval: an issue can be funded elsewhere or disputed after the plan was saved.
      if (!issue || NOT_PLANNABLE.has(issue.status)) {
        skipped.push({ issue_id: item.issue_id, reason: "no longer plannable" });
        continue;
      }
      let project = await deps.store.getProjectByIssue(issue.issue_id);
      if (!project) {
        const brief = await generateBrief(deps, issue.issue_id);
        if (!("generated_brief" in brief)) {
          skipped.push({ issue_id: item.issue_id, reason: "not scored" });
          continue;
        }
        project = {
          project_id: `proj_${randomUUID().replace(/-/g, "").slice(0, 10)}`,
          issue_id: issue.issue_id,
          country_code: issue.country_code,
          state_id: issue.state_id,
          generated_brief: brief.generated_brief,
          brief_model_version: "template-grounded-v1",
          brief_citations: brief.brief_citations,
          groundedness_check: brief.groundedness_check,
          composite_score: item.composite_score,
          status: "recommended",
          assigned_dept: DEPARTMENT[issue.category] ?? DEPARTMENT.other,
          budget_estimate_inr: item.cost_inr,
          marked_complete_at: null,
          officer_signed_off_at: null,
          scheme_id: item.scheme_id,
        };
        await deps.store.putProject(project);
      }
      await deps.store.updateProject(project.project_id, { status: "funded" });
      await deps.store.updateIssue(issue.issue_id, { status: "funded" });
      await notifyReporters(deps, issue, "issue.funded", { scheme: item.scheme_id ? SCHEME_BY_ID.get(item.scheme_id)?.short ?? "" : "" });
      funded += 1;
    }

    const approved = { ...plan, status: "approved" as const, approved_at: new Date().toISOString() };
    await deps.store.putPlan(approved);
    await audit(deps, request, "plan_approved", planId, { status: plan.status }, { status: "approved", funded, skipped: skipped.length }, null);
    await notify(deps, [plan.created_by], { kind: "plan.approved", params: { name: plan.name, funded }, link: "/console/planner" });
    return reply.code(200).send({ plan: approved, funded, skipped });
  });

  // ---- Weights lab ----------------------------------------------------------------------------------------

  app.post("/planner/simulate-weights", officerOnly, async (request, reply) => {
    const body = z
      .object({
        region: z.string().optional(),
        // Any non-negative scale: the sliders are relative, and the server normalises them.
        demand: z.number().min(0).max(100),
        vulnerability: z.number().min(0).max(100),
        gap: z.number().min(0).max(100),
      })
      .safeParse(request.body);
    if (!body.success) return reply.code(400).send(bad(body.error.issues[0]?.message));
    const region = body.data.region ?? request.officer!.regionId;
    if (!(await regionInScope(deps, request, region))) return reply.code(403).send(outside);

    // Weights are normalised so the sliders can be dragged freely without the score leaving 0..1.
    const total = body.data.demand + body.data.vulnerability + body.data.gap;
    if (total <= 0) return reply.code(400).send(bad("At least one weight must be above zero."));
    const weights = { demand: body.data.demand / total, vulnerability: body.data.vulnerability / total, gap: body.data.gap / total };

    const { issues, scoreById, regions } = await planningInputs(region!);
    const rows = simulateWeights(issues.filter((i) => i.status !== "resolved"), scoreById, weights, 10);
    return reply.code(200).send({
      weights,
      ranking: rows.map((r) => ({ ...r, region_name: r.region_id ? regions.get(r.region_id)?.name ?? null : null })),
    });
  });
}
