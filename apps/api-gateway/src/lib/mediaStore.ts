import { randomUUID } from "node:crypto";
import { Storage } from "@google-cloud/storage";
import { env } from "./env.js";

export type MediaKind = "photo" | "audio";

// Seam over Cloud Storage so routes never import the SDK (same DI pattern as Store).
export interface MediaStore {
  /** Persists the bytes and returns a gs:// URL. */
  put(kind: MediaKind, contentType: string, data: Buffer): Promise<string>;
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

export function createGcsMediaStore(): MediaStore {
  const storage = new Storage({ projectId: env.gcpProjectId || undefined });
  return {
    async put(kind, contentType, data) {
      const name = `${kind}s/${randomUUID()}.${EXTENSIONS[contentType] ?? "bin"}`;
      await storage.bucket(env.mediaBucket).file(name).save(data, { contentType, resumable: false });
      return `gs://${env.mediaBucket}/${name}`;
    },
  };
}
