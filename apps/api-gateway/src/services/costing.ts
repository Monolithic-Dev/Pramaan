import type { Issue } from "@jansetu/shared-types";

// Category -> the department that would own the fix, and an indicative budget. Both are labelled
// as indicative in the UI: they seed a project brief and a plan, they are not a sanctioned estimate.
export const DEPARTMENT: Record<string, string> = {
  roads: "Public Works Department",
  water: "Water Supply & Sewerage Board",
  electricity: "Electricity Distribution Company",
  sanitation: "Municipal Sanitation Department",
  health_infra: "Health & Family Welfare Department",
  education_infra: "Education Department",
  other: "District Administration",
};

export const BASE_BUDGET: Record<string, number> = {
  roads: 500_000,
  water: 750_000,
  electricity: 400_000,
  sanitation: 600_000,
  health_infra: 900_000,
  education_infra: 800_000,
  other: 300_000,
};

/** Indicative cost of fixing an issue: the category base, scaled up to 2x for issues many people reported. */
export function estimateBudget(issue: Pick<Issue, "category" | "report_count">): number {
  return Math.round((BASE_BUDGET[issue.category] ?? BASE_BUDGET.other) * (1 + Math.min(issue.report_count, 50) / 50));
}
