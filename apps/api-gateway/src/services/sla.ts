import type { Issue } from "@pramaan/shared-types";
import { priorityBand } from "../insights/transparency.js";

// Service-level clock: how long an issue may sit untouched (status "open") before it is overdue.
// Higher-priority issues get a shorter window; an emergency override gets the shortest. An officer
// can override the due date on a single issue (Issue.sla_due_at).
export const SLA_DAYS = { emergency: 2, high: 7, medium: 21, low: 45, pending: 30 } as const;

export type SlaState = "met" | "ok" | "due_soon" | "overdue";

export interface Sla {
  due_at: string;
  state: SlaState;
  /** Whole days until due (negative once overdue). Null when the clock has stopped. */
  days_left: number | null;
}

const DAY = 86_400_000;

export function slaFor(issue: Pick<Issue, "status" | "composite_score" | "emergency_override" | "first_reported_at" | "sla_due_at">, now = new Date()): Sla {
  const band = issue.emergency_override ? "emergency" : priorityBand(issue.composite_score);
  const due = issue.sla_due_at
    ? new Date(issue.sla_due_at)
    : new Date(new Date(issue.first_reported_at).getTime() + SLA_DAYS[band] * DAY);
  // The clock stops the moment someone acts on the issue: verified, disputed, prioritised, funded...
  if (issue.status !== "open") return { due_at: due.toISOString(), state: "met", days_left: null };
  const daysLeft = Math.floor((due.getTime() - now.getTime()) / DAY);
  const state: SlaState = daysLeft < 0 ? "overdue" : daysLeft <= 2 ? "due_soon" : "ok";
  return { due_at: due.toISOString(), state, days_left: daysLeft };
}
