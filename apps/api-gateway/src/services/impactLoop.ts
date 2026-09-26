import { randomUUID } from "node:crypto";
import type { ImpactRecord, Project, Submission } from "@pramaan/shared-types";
import type { Deps } from "../deps.js";
import { notify, notifyReporters } from "./notify.js";

export const DEFAULT_CONFIRMATIONS_REQUIRED = 3;

/** Everyone who can vouch for a fix: signed-in reporters by account, anonymous ones by the tracking
 *  code their report carries (a code is only ever handed to the person who filed it). */
export function identifiedReporters(submissions: Submission[]): string[] {
  const ids = new Set<string>();
  for (const s of submissions) {
    if (s.status === "tombstoned") continue;
    if (s.citizen_id !== "anonymous") ids.add(s.citizen_id);
    else if (s.tracking_code) ids.add(`sub:${s.submission_id}`);
  }
  return [...ids];
}

/** Confirmations must come from distinct reporters, so an issue with fewer of them than the default
 *  could otherwise never close. */
export const confirmationsRequired = (reporters: number) => Math.max(1, Math.min(DEFAULT_CONFIRMATIONS_REQUIRED, reporters));

/** The closing step of the loop (docs/EDGE_CASES.md #13): a project completes, and its issue becomes
 *  "resolved", only when enough reporters confirmed the fix AND an officer signed it off. Either
 *  condition alone never flips it. Safe to call after either event: it does nothing until both hold. */
export async function completeIfConfirmed(deps: Deps, projectId: string): Promise<boolean> {
  const project = await deps.store.getProject(projectId);
  if (!project || project.status === "completed") return false;
  const impact = await deps.store.getImpactRecord(projectId);
  if (!impact || !project.officer_signed_off_at || impact.confirmations_received < impact.confirmations_required) {
    return false;
  }

  await deps.store.updateProject(projectId, { status: "completed" });
  const issue = await deps.store.getIssue(project.issue_id);
  if (issue && issue.status !== "resolved") {
    await deps.store.updateIssue(issue.issue_id, { status: "resolved" });
    await notifyReporters(deps, issue, "issue.status_changed", { status: "resolved" });
  }
  return true;
}

/** Citizens said it is not fixed (the Swachhata "reopen" pattern): once "not fixed" answers reach the
 *  threshold and outnumber "fixed", the work goes back to in progress, the sign-off is withdrawn, the
 *  next round of answers starts clean, and the officer handling the issue is told. */
async function reopenIfRejected(deps: Deps, project: Project, impact: ImpactRecord): Promise<boolean> {
  if (impact.confirmations_negative < impact.confirmations_required || impact.confirmations_negative <= impact.confirmations_received) {
    return false;
  }
  await deps.store.updateProject(project.project_id, { status: "in_progress", marked_complete_at: null, officer_signed_off_at: null });
  await deps.store.putImpactRecord({
    ...impact,
    confirmations_received: 0,
    confirmations_negative: 0,
    confirmed_by: [],
    resolved_at: "",
    efficacy: 0,
    reopened_count: (impact.reopened_count ?? 0) + 1,
  });
  const issue = await deps.store.getIssue(project.issue_id);
  if (issue) {
    await deps.store.updateIssue(issue.issue_id, { status: "in_progress" });
    if (issue.assigned_to_uid) {
      await notify(deps, [issue.assigned_to_uid], {
        kind: "issue.reopened",
        params: { category: issue.category, issue_id: issue.issue_id },
        link: `/console/issues/${issue.issue_id}`,
      });
    }
  }
  await deps.store.putAuditLogEntry({
    audit_id: randomUUID(),
    actor_id: "citizens",
    action: "reopened_by_citizens",
    target_id: project.project_id,
    before: { confirmations_negative: impact.confirmations_negative, confirmations_received: impact.confirmations_received },
    after: { status: "in_progress" },
    justification: null,
    timestamp: new Date().toISOString(),
  });
  return true;
}

export type ResponseOutcome =
  | { kind: "not_marked" }
  | { kind: "already" }
  | { kind: "recorded"; impact_id: string; completed: boolean; reopened: boolean };

/** One reporter's answer to "was it really fixed?". Shared by signed-in citizens and tracking-code holders. */
export async function recordResolutionResponse(
  deps: Deps,
  project: Project,
  responderId: string,
  confirmed: boolean,
  photoUrl: string | null = null,
): Promise<ResponseOutcome> {
  const impact = await deps.store.getImpactRecord(project.project_id);
  if (!impact || !project.marked_complete_at) return { kind: "not_marked" };
  const confirmedBy = impact.confirmed_by ?? [];
  if (confirmedBy.includes(responderId)) return { kind: "already" };

  const updated: ImpactRecord = {
    ...impact,
    confirmed_by: [...confirmedBy, responderId],
    confirmations_received: impact.confirmations_received + (confirmed ? 1 : 0),
    confirmations_negative: impact.confirmations_negative + (confirmed ? 0 : 1),
    resolution_photo_url: photoUrl ?? impact.resolution_photo_url,
    verified_by: confirmed ? responderId : impact.verified_by,
  };
  const total = updated.confirmations_received + updated.confirmations_negative;
  updated.efficacy = total > 0 ? updated.confirmations_received / total : 0;
  if (updated.confirmations_received >= updated.confirmations_required && !updated.resolved_at) {
    updated.resolved_at = new Date().toISOString();
  }
  await deps.store.putImpactRecord(updated);

  const reopened = !confirmed && (await reopenIfRejected(deps, project, updated));
  // Resolution requires the confirmation threshold AND a separate officer sign-off — never citizen input alone.
  const completed = !reopened && (await completeIfConfirmed(deps, project.project_id));
  return { kind: "recorded", impact_id: updated.impact_id, completed, reopened };
}
