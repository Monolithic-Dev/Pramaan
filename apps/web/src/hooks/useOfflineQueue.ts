import { useCallback, useEffect, useState } from "react";
import { submitReportAuthed, uploadMediaAuthed } from "../api/api.js";
import { ApiClientError, type CreateSubmissionInput } from "../api/client.js";
import { deleteOfflineMedia, loadOfflineMedia, saveOfflineMedia } from "../utils/offlineMedia.js";

type MediaKind = "photo" | "audio";
const URL_FIELD = { photo: "photo_url", audio: "audio_url" } as const;

interface QueuedSubmission {
  idempotencyKey: string;
  input: CreateSubmissionInput;
  queuedAt: string;
  /** Media captured offline, waiting in IndexedDB under these keys until it can be uploaded. */
  mediaKeys?: Partial<Record<MediaKind, string>>;
  /** Written by an earlier version of this queue (photo only). */
  photoKey?: string;
}

export interface OfflineMedia {
  photo?: Blob | null;
  audio?: Blob | null;
}

const STORAGE_KEY = "pramaan.offlineQueue";

// The queue itself is small JSON, so it lives in localStorage; photos and voice notes captured
// offline are Blobs and wait in IndexedDB (utils/offlineMedia.ts). It replays on the browser's
// `online` event and on the next visit rather than through Background Sync, which iOS Safari
// does not support.
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
    for (const [index, item] of queue.entries()) {
      try {
        const keys = { ...item.mediaKeys, ...(item.photoKey ? { photo: item.photoKey } : {}) };
        for (const kind of Object.keys(keys) as MediaKind[]) {
          const key = keys[kind]!;
          const blob = await loadOfflineMedia(key);
          if (blob) {
            item.input = { ...item.input, [URL_FIELD[kind]]: await uploadMediaAuthed(kind, blob) };
          }
          // Persist each uploaded URL before going on: a retry must resend the identical body, or
          // the server rejects the reused Idempotency-Key as a conflict.
          delete keys[kind];
          item.mediaKeys = keys;
          item.photoKey = undefined;
          writeQueue([...remaining, item, ...queue.slice(index + 1)]);
          await deleteOfflineMedia(key).catch(() => undefined);
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

  const enqueue = useCallback(async (input: CreateSubmissionInput, idempotencyKey: string, media: OfflineMedia = {}) => {
    const mediaKeys: Partial<Record<MediaKind, string>> = {};
    for (const kind of ["photo", "audio"] as const) {
      const blob = media[kind];
      if (!blob) continue;
      try {
        await saveOfflineMedia(`${idempotencyKey}:${kind}`, blob);
        mediaKeys[kind] = `${idempotencyKey}:${kind}`;
      } catch {
        // No IndexedDB (private mode): the report still goes, just without this attachment.
      }
    }
    const queue = readQueue();
    queue.push({ idempotencyKey, input, queuedAt: new Date().toISOString(), mediaKeys });
    writeQueue(queue);
    setPendingCount(queue.length);
  }, []);

  return { pendingCount, enqueue, flush };
}
