import type { Storage } from "@google-cloud/storage";
import type { Firestore } from "firebase-admin/firestore";

const MIME_BY_EXT: Record<string, string> = {
  webm: "audio/webm", ogg: "audio/ogg", m4a: "audio/mp4", mp3: "audio/mpeg", wav: "audio/wav",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
};

/** Reads uploaded media from Firestore (fs://media/<id>, free plan) or Cloud Storage (gs://). */
export async function readMedia(
  url: string,
  storage: Storage,
  db?: Firestore,
): Promise<{ data: Buffer; mimeType: string }> {
  const fs = /^fs:\/\/media\/(.+)$/.exec(url);
  if (fs) {
    if (!db) throw new Error("fs:// media needs a Firestore handle");
    const doc = await db.collection("media").doc(fs[1]).get();
    if (!doc.exists) throw new Error(`media ${fs[1]} not found`);
    const d = doc.data() as { data: Buffer | Uint8Array; contentType: string };
    return { data: Buffer.from(d.data), mimeType: d.contentType };
  }
  const gs = /^gs:\/\/([^/]+)\/(.+)$/.exec(url);
  if (!gs) throw new Error(`unsupported media url: ${url}`);
  const [data] = await storage.bucket(gs[1]).file(gs[2]).download();
  return { data, mimeType: MIME_BY_EXT[gs[2].split(".").pop() ?? ""] ?? "application/octet-stream" };
}
