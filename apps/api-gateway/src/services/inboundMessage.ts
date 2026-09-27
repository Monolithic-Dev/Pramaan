import type { FastifyBaseLogger } from "fastify";
import type { Issue, SubmissionChannel } from "@pramaan/shared-types";
import type { Deps } from "../deps.js";
import { normalizeTrackingCode } from "../lib/trackingCode.js";
import { ingestSubmission, type IngestSubmissionResult } from "./ingestSubmission.js";

// One handler for every text-message channel (WhatsApp, SMS, and the public simulator), so a feature
// phone gets exactly what the web app gets: a report is filed and answered with a tracking code, and a
// message like "STATUS JS-K7M3P9QD" (or just the code) is answered with where that report stands,
// without filing anything. `reply` is the text the messaging provider sends back to the phone.

const STATUS_WORDS = /^\s*(status|track|check|स्थिति|நிலை|স্থিতি|స్థితి|स्थिती|ಸ್ಥಿತಿ|സ്ഥിതി|સ્થિતિ|ਸਥਿਤੀ|situação)(?:[\s:-]+|$)(.*)$/iu;
const LABEL: Record<string, string> = {
  received: "received",
  understood: "understood and being reviewed",
  verified: "verified by an officer",
  funded: "funded, work is being arranged",
  fixed: "fixed and confirmed",
};

/** A tracking code the message is asking about, or null if this is a new report. */
export function statusQueryCode(text: string | undefined | null): string | null {
  if (!text) return null;
  const match = STATUS_WORDS.exec(text);
  const candidate = match ? match[2] : text.trim();
  // A bare message is only a status query if it is nothing but a code.
  if (!match && !/^[A-Za-z0-9\s-]{8,14}$/.test(candidate)) return null;
  return normalizeTrackingCode(candidate);
}

function stageOf(issue: Pick<Issue, "status"> | null): keyof typeof LABEL {
  if (!issue) return "received";
  if (issue.status === "resolved") return "fixed";
  if (["funded", "in_progress"].includes(issue.status)) return "funded";
  if (["verified", "prioritized"].includes(issue.status)) return "verified";
  return "understood";
}

export type InboundOutcome =
  | { kind: "status"; tracking_code: string; stage: string; category: string | null; other_reporters: number; reply: string }
  | { kind: "status_not_found"; reply: string }
  | { kind: "report"; result: IngestSubmissionResult; reply: string }
  | { kind: "conflict" };

export async function handleInboundMessage(
  deps: Deps,
  message: {
    channel: SubmissionChannel;
    text?: string;
    photo_url?: string;
    lat?: number;
    lng?: number;
    location_text?: string;
    citizenId: string | undefined;
    idempotencyKey: string;
    consentVersion: string;
    countryCode?: string;
  },
  log: FastifyBaseLogger,
): Promise<InboundOutcome> {
  const code = message.photo_url ? null : statusQueryCode(message.text);
  if (code) {
    const submission = await deps.store.getSubmissionByTrackingCode(code);
    if (!submission || submission.status === "tombstoned") {
      return { kind: "status_not_found", reply: `Pramaan: we could not find ${code}. Check the code and try again.` };
    }
    const issue = submission.issue_id ? await deps.store.getIssue(submission.issue_id) : null;
    const live = issue && issue.status !== "tombstoned" ? issue : null;
    const stage = stageOf(live);
    const others = live ? Math.max(0, live.distinct_reporter_count - 1) : 0;
    const what = live ? `${live.category.replace("_", " ")} report` : "report";
    return {
      kind: "status",
      tracking_code: code,
      stage,
      category: live?.category ?? null,
      other_reporters: others,
      reply: `Pramaan ${code}: your ${what} is ${LABEL[stage]}.${others > 0 ? ` ${others} other people reported the same problem.` : ""}`,
    };
  }

  const { result, conflict } = await ingestSubmission(
    deps,
    {
      channel: message.channel,
      text: message.text,
      photo_url: message.photo_url,
      lat: message.lat,
      lng: message.lng,
      location_text: message.location_text,
      consent_version: message.consentVersion,
      citizenId: message.citizenId,
      idempotencyKey: message.idempotencyKey,
      countryCode: message.countryCode,
    },
    log,
  );
  if (conflict) return { kind: "conflict" };
  const tracking = result.tracking_code ?? "";
  return {
    kind: "report",
    result,
    reply: `Pramaan: thank you, your report is recorded. Your tracking code is ${tracking}. Reply "STATUS ${tracking}" any time to see what is happening.`,
  };
}
