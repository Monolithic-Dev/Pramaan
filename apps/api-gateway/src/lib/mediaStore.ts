import { randomUUID } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { Storage } from "@google-cloud/storage";
import { env } from "./env.js";

export type MediaKind = "photo" | "audio";

// Seam over Cloud Storage so routes never import the SDK (same DI pattern as Store).
export interface MediaStore {
  /** Persists the bytes and returns a gs:// URL. */
  put(kind: MediaKind, contentType: string, data: Buffer): Promise<string>;
  /** Reads back what put() stored, by the URL it returned; null if it does not exist. */
  get(url: string): Promise<{ data: Buffer; contentType: string } | null>;
  /** True only for URLs in the exact shape put() mints. Client-supplied media URLs must pass this,
   *  or a caller could point the worker/API at any object the service account can read. */
  owns(url: string): boolean;
  /** Largest upload this backend accepts, per kind. */
  maxBytes: Record<MediaKind, number>;
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

export const ALLOWED_CONTENT_TYPES = Object.keys(EXTENSIONS);

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function createGcsMediaStore(): MediaStore {
  const storage = new Storage({ projectId: env.gcpProjectId || undefined });
  const ownUrl = new RegExp(`^gs://${escapeRegex(env.mediaBucket)}/((?:photos|audios)/${UUID}\\.[a-z0-9]+)$`);
  return {
    maxBytes: { photo: 8 * 1024 * 1024, audio: 10 * 1024 * 1024 },
    owns: (url) => ownUrl.test(url),
    async put(kind, contentType, data) {
      const name = `${kind}s/${randomUUID()}.${EXTENSIONS[contentType] ?? "bin"}`;
      await storage.bucket(env.mediaBucket).file(name).save(data, { contentType, resumable: false });
      return `gs://${env.mediaBucket}/${name}`;
    },
    async get(url) {
      const match = ownUrl.exec(url);
      if (!match) return null;
      const file = storage.bucket(env.mediaBucket).file(match[1]);
      const [exists] = await file.exists();
      if (!exists) return null;
      const [[data], [meta]] = await Promise.all([file.download(), file.getMetadata()]);
      return { data, contentType: String(meta.contentType ?? "application/octet-stream") };
    },
  };
}

// Free-plan backend: Firestore documents (1 MiB limit) instead of Cloud Storage, which
// needs a billing account. The web app compresses photos and caps recordings to fit.
export function createFirestoreMediaStore(db: Firestore): MediaStore {
  const ownUrl = new RegExp(`^fs://media/(${UUID})$`);
  return {
    maxBytes: { photo: 900 * 1024, audio: 900 * 1024 },
    owns: (url) => ownUrl.test(url),
    async put(kind, contentType, data) {
      const id = randomUUID();
      await db.collection("media").doc(id).set({ kind, contentType, data, size: data.length, created_at: new Date().toISOString() });
      return `fs://media/${id}`;
    },
    async get(url) {
      const match = ownUrl.exec(url);
      if (!match) return null;
      const doc = await db.collection("media").doc(match[1]).get();
      if (!doc.exists) return null;
      const d = doc.data() as { data: Buffer | Uint8Array; contentType: string };
      return { data: Buffer.from(d.data), contentType: d.contentType };
    },
  };
}
