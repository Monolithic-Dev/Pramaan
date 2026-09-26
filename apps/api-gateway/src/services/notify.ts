import { randomUUID } from "node:crypto";
import type { Issue, Notification, NotificationKind } from "@pramaan/shared-types";
import type { Deps } from "../deps.js";

type Params = Record<string, string | number>;

export async function notify(
  deps: Deps,
  recipientIds: string[],
  message: { kind: NotificationKind; params: Params; link: string },
): Promise<number> {
  const unique = [...new Set(recipientIds)].filter((id) => id && id !== "anonymous");
  await Promise.all(
    unique.map((recipient) =>
      deps.store.putNotification({
        notification_id: `ntf_${randomUUID().replace(/-/g, "").slice(0, 14)}`,
        recipient_id: recipient,
        kind: message.kind,
        params: message.params,
        link: message.link,
        created_at: new Date().toISOString(),
        read_at: null,
      }),
    ),
  );
  return unique.length;
}

/** Tells every distinct citizen who reported an issue, each linked to their *own* report so the
 *  page they land on is one they are allowed to open. Anonymous reporters have no inbox. */
export async function notifyReporters(
  deps: Deps,
  issue: Pick<Issue, "issue_id" | "category">,
  kind: NotificationKind,
  params: Params = {},
): Promise<number> {
  const submissions = await deps.store.getSubmissionsByIssue(issue.issue_id);
  const firstByCitizen = new Map<string, string>();
  for (const s of submissions) {
    if (s.status === "tombstoned" || s.citizen_id === "anonymous" || firstByCitizen.has(s.citizen_id)) continue;
    firstByCitizen.set(s.citizen_id, s.submission_id);
  }
  await Promise.all(
    [...firstByCitizen].map(([citizenId, submissionId]) =>
      notify(deps, [citizenId], { kind, params: { category: issue.category, ...params }, link: `/my/${submissionId}` }),
    ),
  );
  return firstByCitizen.size;
}
