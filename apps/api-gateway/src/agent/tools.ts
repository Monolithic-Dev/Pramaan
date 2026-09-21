import { computeCompositeScore, type ScoreWeights } from "@jansetu/shared-utils";
import type { Deps } from "../deps.js";
import { verifyGrounded } from "./groundedness.js";
import { getEquityAudit, getForecasts } from "../insights/service.js";

// docs/AI_PIPELINE.md Stage 5 refusal guardrail, layer 1: an explicit
// no-data envelope, never an empty array — models narrate empty arrays away,
// they cannot narrate away an object that says "no data."
export interface NoDataResult {
  status: "no_data";
  reason: string;
  available_instead: string[];
}

function noData(reason: string, availableInstead: string[] = []): NoDataResult {
  return { status: "no_data", reason, available_instead: availableInstead };
}

// Gemini SDK function declarations (OpenAPI-subset schema), one per tool in
// docs/phases/phase-6-agent-rag.md §6.1. region_id is present on every
// region-scoped tool and is validated by scopeGuard.ts before execution.
export const TOOL_DECLARATIONS = [
  {
    name: "query_fused_data",
    description: "Demand records (Issues) for a region, optionally filtered by category.",
    parameters: {
      type: "object",
      properties: {
        region_id: { type: "string" },
        category: { type: "string" },
      },
      required: ["region_id"],
    },
  },
  {
    name: "check_investment_status",
    description: "InvestmentRecords for a region/category, including data_origin.",
    parameters: {
      type: "object",
      properties: {
        region_id: { type: "string" },
        category: { type: "string" },
      },
      required: ["region_id", "category"],
    },
  },
  {
    name: "get_priority_scores",
    description: "Canonical PriorityScores (with full breakdowns) for a region, ranked.",
    parameters: {
      type: "object",
      properties: {
        region_id: { type: "string" },
        limit: { type: "integer" },
      },
      required: ["region_id"],
    },
  },
  {
    name: "simulate_priority",
    description:
      "What-if re-scoring with overridden weights. Results are simulation only, never canonical.",
    parameters: {
      type: "object",
      properties: {
        region_id: { type: "string" },
        weight_overrides: {
          type: "object",
          properties: {
            demand: { type: "number" },
            vulnerability: { type: "number" },
            gap: { type: "number" },
          },
        },
      },
      required: ["region_id"],
    },
  },
  {
    name: "generate_brief",
    description: "A policy-grounded justification brief for one issue.",
    parameters: {
      type: "object",
      properties: { issue_id: { type: "string" } },
      required: ["issue_id"],
    },
  },
  {
    name: "list_available_data",
    description:
      "What InfraIndex types and investment fiscal years exist for a region — call this before refusing, so a refusal can say what is missing.",
    parameters: {
      type: "object",
      properties: { region_id: { type: "string" } },
      required: ["region_id"],
    },
  },
  {
    name: "get_risk_forecasts",
    description:
      "Predicted seasonal risk windows for a region (a forecast, not a citizen report). Categories with too little history are listed as insufficient_data.",
    parameters: {
      type: "object",
      properties: { region_id: { type: "string" }, category: { type: "string" } },
      required: ["region_id"],
    },
  },
  {
    name: "get_equity_audit",
    description:
      "Fairness audit for a state: funding and scores by vulnerability band, plus a plain-language verdict.",
    parameters: {
      type: "object",
      properties: { region_id: { type: "string", description: "The state region id" } },
      required: ["region_id"],
    },
  },
] as const;

export type ToolName = (typeof TOOL_DECLARATIONS)[number]["name"];

async function queryFusedData(deps: Deps, regionId: string, category?: string) {
  const issues = await deps.store.getIssuesByRegion(regionId, category);
  if (issues.length === 0) {
    const available = await deps.bigqueryAgent.getAvailableData(regionId);
    return noData(
      `no demand data for region ${regionId}${category ? ` in category "${category}"` : ""}`,
      available.infraIndexTypes.map((t) => `InfraIndex: ${t}`),
    );
  }
  return issues.map((issue) => ({
    issue_id: issue.issue_id,
    category: issue.category,
    subcategory: issue.subcategory,
    status: issue.status,
    report_count: issue.report_count,
    distinct_reporter_count: issue.distinct_reporter_count,
    composite_score: issue.composite_score,
  }));
}

async function checkInvestmentStatus(deps: Deps, regionId: string, category: string) {
  const records = await deps.bigqueryAgent.getInvestmentRecords(regionId, category);
  if (records.length === 0) {
    return noData(`no InvestmentRecord for category "${category}" in region ${regionId}`, [
      "demand data without investment data",
      "a wider region",
    ]);
  }
  return records;
}

async function getPriorityScores(deps: Deps, regionId: string, limit = 5) {
  const issues = await deps.store.getIssuesByRegion(regionId);
  const scored = issues.filter((i) => i.composite_score !== null);
  if (scored.length === 0) {
    return noData(`no scored issues for region ${regionId}`, [
      "unscored demand data via query_fused_data",
    ]);
  }
  const ranked = scored.sort((a, b) => (b.composite_score ?? 0) - (a.composite_score ?? 0)).slice(0, limit);
  const withScores = await Promise.all(
    ranked.map(async (issue) => ({
      issue_id: issue.issue_id,
      score: await deps.store.getCanonicalScore(issue.issue_id),
    })),
  );
  return withScores;
}

async function simulatePriority(
  deps: Deps,
  regionId: string,
  weightOverrides: Partial<ScoreWeights> = {},
) {
  const issues = await deps.store.getIssuesByRegion(regionId);
  const results = [];
  for (const issue of issues) {
    const canonical = await deps.store.getCanonicalScore(issue.issue_id);
    if (!canonical) continue;
    const weights: ScoreWeights = {
      demand: weightOverrides.demand ?? canonical.weights.demand,
      vulnerability: weightOverrides.vulnerability ?? canonical.weights.vulnerability,
      gap: weightOverrides.gap ?? canonical.weights.gap,
    };
    const { composite } = computeCompositeScore(
      {
        demand: canonical.demand_score,
        vulnerability: canonical.vulnerability_score,
        gap: canonical.gap_score,
        duplicationPenalty: canonical.duplication_penalty,
        impactEfficacy: canonical.impact_efficacy,
      },
      weights,
    );
    // Never persisted, never canonical — a what-if only (docs/phases/phase-6-agent-rag.md §6.1).
    results.push({ issue_id: issue.issue_id, simulated_composite_score: composite, is_simulation: true });
  }
  if (results.length === 0) {
    return noData(`no scored issues to simulate for region ${regionId}`, []);
  }
  return results;
}

async function generateBrief(deps: Deps, issueId: string) {
  const issue = await deps.store.getIssue(issueId);
  if (!issue) return noData(`issue ${issueId} not found`, []);
  const score = await deps.store.getCanonicalScore(issueId);
  if (!score) return noData(`issue ${issueId} has not been scored yet`, []);

  // Template-generated, not Vector Search RAG (cut-line applied,
  // docs/phases/phase-6-agent-rag.md "Cut-line") — every number below is
  // copied verbatim from real fetched data, so it is grounded by construction.
  const brief =
    `${issue.category}/${issue.subcategory} issue with ${issue.report_count} reports ` +
    `from ${issue.distinct_reporter_count} distinct reporters. Composite priority score: ` +
    `${score.composite_score.toFixed(3)} (demand ${score.demand_score.toFixed(2)}, ` +
    `vulnerability ${score.vulnerability_score.toFixed(2)}, gap ${score.gap_score.toFixed(2)}).` +
    (score.data_fallbacks.length > 0
      ? ` Note: ${score.data_fallbacks.map((f) => f.reason).join("; ")}.`
      : "");

  // Run the real verifier rather than assuming "grounded by construction" — the
  // template is expected to always pass today, but a hardcoded `true` couldn't
  // catch a future interpolation bug, and this is the panel a judge asking "how
  // do you know it didn't hallucinate" gets shown (docs/phases/phase-6-agent-rag.md §6.5).
  const verification = verifyGrounded(brief, [issue, score]);

  return {
    generated_brief: brief,
    brief_citations: [{ claim: "composite_score", source: `PriorityScore:${score.score_id}` }],
    groundedness_check: {
      passed: verification.passed,
      unverified_claims: verification.unverifiedClaims,
    },
  };
}

async function listAvailableData(deps: Deps, regionId: string) {
  const [available, issues] = await Promise.all([
    deps.bigqueryAgent.getAvailableData(regionId),
    deps.store.getIssuesByRegion(regionId),
  ]);
  return {
    region_id: regionId,
    infra_index_types: available.infraIndexTypes,
    investment_fiscal_years: available.investmentFiscalYears,
    has_demand_data: issues.length > 0,
  };
}

export async function executeTool(
  deps: Deps,
  name: ToolName,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "query_fused_data":
      return queryFusedData(deps, args.region_id as string, args.category as string | undefined);
    case "check_investment_status":
      return checkInvestmentStatus(deps, args.region_id as string, args.category as string);
    case "get_priority_scores":
      return getPriorityScores(deps, args.region_id as string, args.limit as number | undefined);
    case "simulate_priority":
      return simulatePriority(
        deps,
        args.region_id as string,
        (args.weight_overrides as Partial<ScoreWeights>) ?? {},
      );
    case "get_risk_forecasts": {
      const r = await getForecasts(deps, args.region_id as string, args.category as string | undefined);
      return r.forecasts.length === 0 && r.not_forecast.length === 0
        ? noData(`no issue history for region ${args.region_id as string}`, [])
        : r;
    }
    case "get_equity_audit":
      return getEquityAudit(deps, args.region_id as string);
    case "generate_brief":
      return generateBrief(deps, args.issue_id as string);
    case "list_available_data":
      return listAvailableData(deps, args.region_id as string);
    default:
      return noData(`unknown tool ${name as string}`, []);
  }
}

/** The region_id (or, for generate_brief, the issue's resolved region) a tool
 *  call needs validated against the pinned session scope — null means the
 *  call can't be scope-checked (e.g. the referenced issue has no resolved
 *  region yet) and must fail closed. */
export async function extractScopeTarget(
  deps: Deps,
  name: ToolName,
  args: Record<string, unknown>,
): Promise<string | null> {
  if (name === "generate_brief") {
    const issue = await deps.store.getIssue(args.issue_id as string);
    return issue?.admin_region_id ?? null;
  }
  return (args.region_id as string) ?? null;
}
