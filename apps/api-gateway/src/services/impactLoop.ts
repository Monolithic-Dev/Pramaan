import type { Deps } from "../deps.js";
import { notifyReporters } from "./notify.js";

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
