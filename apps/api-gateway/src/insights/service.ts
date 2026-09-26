import type { EquityAuditReport, RiskForecast } from "@pramaan/shared-types";
import type { Deps } from "../deps.js";
import { computeEquityAudit } from "./equity.js";
import {
  computeSeasonalRisk,
  FORECAST_MODEL_VERSION,
  hasRecentInvestment,
} from "./forecasting.js";

export interface ForecastsResult {
  forecasts: RiskForecast[];
  /** Categories examined but not forecast, each with the honest reason. */
  not_forecast: { category: string; status: "insufficient_data" | "no_risk"; reason: string }[];
}

// Shared by GET /forecasts and the agent's get_risk_forecasts tool, so the two
// can never disagree. Computed on read from Issue history: deterministic, so
// there's nothing to persist or let go stale.
export async function getForecasts(
  deps: Deps,
  regionId: string,
  category: string | undefined,
  now = new Date(),
): Promise<ForecastsResult> {
  const issues = await deps.store.getIssuesByRegion(regionId, category);
  const byCategory = new Map<string, typeof issues>();
  for (const issue of issues) {
    if (issue.status === "tombstoned") continue;
    if (!byCategory.has(issue.category)) byCategory.set(issue.category, []);
    byCategory.get(issue.category)!.push(issue);
  }

  const result: ForecastsResult = { forecasts: [], not_forecast: [] };
  for (const [cat, history] of byCategory) {
    const investments = await deps.bigqueryAgent.getInvestmentRecords(regionId, cat);
    const risk = computeSeasonalRisk(history, {
      now,
      hasRecentInvestment: hasRecentInvestment(
        investments.map((i) => i.fiscal_year),
        now,
      ),
    });
    if (risk.status === "forecast") {
      result.forecasts.push({
        forecast_id: `fc_${regionId}_${cat}_${risk.window_start.slice(0, 7)}`,
        geo_cluster_id: regionId,
        category: cat,
        risk_level: risk.risk_level,
        predicted_window_start: risk.window_start,
        predicted_window_end: risk.window_end,
        contributing_factors: risk.factors,
        model_version: FORECAST_MODEL_VERSION,
        computed_at: now.toISOString(),
      });
    } else {
      result.not_forecast.push({ category: cat, status: risk.status, reason: risk.reason });
    }
  }
  return result;
}

export async function getEquityAudit(
  deps: Deps,
  stateId: string,
  now = new Date(),
): Promise<{ bands: EquityAuditReport[]; verdict: string }> {
  const issues = await deps.store.listIssues(stateId);
  const inputs = await Promise.all(
    issues.map(async (issue) => ({
      issue,
      score: await deps.store.getCanonicalScore(issue.issue_id),
      impact: await deps.store.getImpactRecordByIssue(issue.issue_id),
    })),
  );
  return computeEquityAudit(stateId, inputs, now);
}
