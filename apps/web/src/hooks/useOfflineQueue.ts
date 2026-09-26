import { useCallback, useEffect, useState } from "react";
import { submitReportAuthed, uploadMediaAuthed } from "../api/api.js";
import { ApiClientError, type CreateSubmissionInput } from "../api/client.js";
import { deleteOfflineMedia, loadOfflineMedia, saveOfflineMedia } from "../utils/offlineMedia.js";

interface QueuedSubmission {
  idempotencyKey: string;
  input: CreateSubmissionInput;
  queuedAt: string;
  /** A photo taken offline, waiting in IndexedDB under this key until it can be uploaded. */
  photoKey?: string;
}

const STORAGE_KEY = "pramaan.offlineQueue";

// The queue itself is small JSON, so it lives in localStorage; photos taken offline are Blobs and
// wait in IndexedDB (utils/offlineMedia.ts). It replays on the browser's `online` event and on the
// next visit rather than through Background Sync, which iOS Safari does not support.
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
        if (item.photoKey) {
          const blob = await loadOfflineMedia(item.photoKey);
          if (blob) {
            item.input = { ...item.input, photo_url: await uploadMediaAuthed("photo", blob) };
            // Persist the uploaded URL before submitting: a retry must resend the identical body,
            // or the server rejects the reused Idempotency-Key as a conflict.
            writeQueue([...remaining, item, ...queue.slice(queue.indexOf(item) + 1)]);
          }
          await deleteOfflineMedia(item.photoKey).catch(() => undefined);
          item.photoKey = undefined;
        }
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

  const enqueue = useCallback(async (input: CreateSubmissionInput, idempotencyKey: string, photo?: Blob | null) => {
    let photoKey: string | undefined;
    if (photo) {
      try {
        await saveOfflineMedia(idempotencyKey, photo);
        photoKey = idempotencyKey;
      } catch {
        // No IndexedDB (private mode): the report still goes, just without the photo.
      }
    }
    const queue = readQueue();
    queue.push({ idempotencyKey, input, queuedAt: new Date().toISOString(), photoKey });
    writeQueue(queue);
    setPendingCount(queue.length);
  }, []);

  return { pendingCount, enqueue, flush };
}
