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
 *  page they land on is one they are allowed to open, and everyone who pressed "I'm affected too"
 *  (they follow the issue without having filed it). Anonymous reporters have no inbox; they see
 *  progress through their tracking code. */
export async function notifyReporters(
  deps: Deps,
  issue: Pick<Issue, "issue_id" | "category">,
  kind: NotificationKind,
  params: Params = {},
): Promise<number> {
  const [submissions, supporters] = await Promise.all([
    deps.store.getSubmissionsByIssue(issue.issue_id),
    deps.store.listSupporters(issue.issue_id),
  ]);
  const firstByCitizen = new Map<string, string>();
  for (const s of submissions) {
    if (s.status === "tombstoned" || s.citizen_id === "anonymous" || firstByCitizen.has(s.citizen_id)) continue;
    firstByCitizen.set(s.citizen_id, s.submission_id);
  }
  const followers = supporters.filter((id) => !firstByCitizen.has(id));
  const payload = { category: issue.category, ...params };
  await Promise.all([
    ...[...firstByCitizen].map(([citizenId, submissionId]) => notify(deps, [citizenId], { kind, params: payload, link: `/my/${submissionId}` })),
    notify(deps, followers, { kind, params: payload, link: `/community?issue=${issue.issue_id}` }),
  ]);
  return firstByCitizen.size + followers.length;
}
