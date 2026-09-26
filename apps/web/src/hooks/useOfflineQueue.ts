import { useCallback, useEffect, useState } from "react";
import { submitReportAuthed } from "../api/api.js";
import { ApiClientError, type CreateSubmissionInput } from "../api/client.js";

interface QueuedSubmission {
  idempotencyKey: string;
  input: CreateSubmissionInput;
  queuedAt: string;
}

const STORAGE_KEY = "jansetu.offlineQueue";

// ponytail: localStorage instead of IndexedDB — payloads here are small JSON
// (no photo/audio blobs are uploaded yet, see docs/phases/phase-7-manual-checklist.md),
// so localStorage's size limit isn't a real constraint. Upgrade path: move to
// IndexedDB (docs/phases/phase-7-frontend.md §7.2) once media upload exists.
// Similarly, this replays on the browser's `online` event rather than
// registering a Background Sync API handler — simpler, works while the tab is
// open, which covers the demo ("airplane mode off, watch it sync").
function readQueue(): QueuedSubmission[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedSubmission[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // Best-effort — losing the queue is better than crashing the report flow.
  }
}

/** A 4xx other than timeout/rate-limit will fail identically on every retry. */
const isPermanent = (err: unknown) =>
  err instanceof ApiClientError && err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429;

/** `authReady`: replay only once sign-in state is known, so a signed-in citizen's queued report is
 *  sent with their token (and lands in their account) rather than anonymously. */
export function useOfflineQueue(authReady: boolean) {
  const [pendingCount, setPendingCount] = useState(() => readQueue().length);

  const flush = useCallback(async () => {
    const queue = readQueue();
    if (queue.length === 0) return;
    const remaining: QueuedSubmission[] = [];
    for (const item of queue) {
      try {
        await submitReportAuthed(item.input, item.idempotencyKey);
      } catch (err) {
        if (!isPermanent(err)) remaining.push(item); // still offline or throttled: keep for next try
      }
    }
    writeQueue(remaining);
    setPendingCount(remaining.length);
  }, []);

  useEffect(() => {
    if (!authReady) return;
    window.addEventListener("online", flush);
    if (navigator.onLine) flush();
    return () => window.removeEventListener("online", flush);
  }, [flush, authReady]);

  const enqueue = useCallback((input: CreateSubmissionInput, idempotencyKey: string) => {
    const queue = readQueue();
    queue.push({ idempotencyKey, input, queuedAt: new Date().toISOString() });
    writeQueue(queue);
    setPendingCount(queue.length);
  }, []);

  return { pendingCount, enqueue, flush };
}
