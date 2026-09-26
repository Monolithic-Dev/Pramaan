import type { Issue } from "@pramaan/shared-types";
import { priorityBand } from "../insights/transparency.js";

// Service-level clock: how long an issue may sit untouched (status "open") before it is overdue.
// Higher-priority issues get a shorter window; an emergency override gets the shortest. An officer
// can override the due date on a single issue (Issue.sla_due_at).
export const SLA_DAYS = { emergency: 2, high: 7, medium: 21, low: 45, pending: 30 } as const;

export type SlaState = "met" | "ok" | "due_soon" | "overdue";

/** Graded escalation, as in CPGRAMS: a missed deadline goes up to the district collector; missing it
 *  again by a whole further window goes up to the state admin. */
export type EscalationLevel = 0 | 1 | 2;
export const ESCALATION_ROLE = { 1: "district_collector", 2: "state_admin" } as const;

export interface Sla {
  due_at: string;
  state: SlaState;
  /** Whole days until due (negative once overdue). Null when the clock has stopped. */
  days_left: number | null;
  escalation: EscalationLevel;
  escalated_to: (typeof ESCALATION_ROLE)[1 | 2] | null;
}

const DAY = 86_400_000;

export function slaFor(issue: Pick<Issue, "status" | "composite_score" | "emergency_override" | "first_reported_at" | "sla_due_at">, now = new Date()): Sla {
  const band = issue.emergency_override ? "emergency" : priorityBand(issue.composite_score);
  const reported = new Date(issue.first_reported_at).getTime();
  const due = issue.sla_due_at ? new Date(issue.sla_due_at) : new Date(reported + SLA_DAYS[band] * DAY);
  // The clock stops the moment someone acts on the issue: verified, disputed, prioritised, funded...
  if (issue.status !== "open") return { due_at: due.toISOString(), state: "met", days_left: null, escalation: 0, escalated_to: null };
  const daysLeft = Math.floor((due.getTime() - now.getTime()) / DAY);
  const state: SlaState = daysLeft < 0 ? "overdue" : daysLeft <= 2 ? "due_soon" : "ok";
  const window = Math.max(1, Math.round((due.getTime() - reported) / DAY));
  const escalation: EscalationLevel = state !== "overdue" ? 0 : -daysLeft >= window ? 2 : 1;
  return { due_at: due.toISOString(), state, days_left: daysLeft, escalation, escalated_to: escalation ? ESCALATION_ROLE[escalation] : null };
}
