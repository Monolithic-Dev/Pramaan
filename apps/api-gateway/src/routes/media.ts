import type { FastifyInstance } from "fastify";
import type { Deps } from "../deps.js";
import { ALLOWED_CONTENT_TYPES, type MediaKind } from "../lib/mediaStore.js";
import { optionalAuth } from "../middleware/auth.js";
import { submissionRateLimiter } from "../middleware/rateLimiter.js";

// Extension/Content-Type headers are attacker-controlled, so image uploads are
// also checked against real file signatures.
function looksLikeImage(contentType: string, b: Buffer): boolean {
  if (contentType === "image/jpeg") return b[0] === 0xff && b[1] === 0xd8;
  if (contentType === "image/png") return b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  if (contentType === "image/webp") return b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP";
  return true;
}

export function registerMediaRoutes(app: FastifyInstance, deps: Deps) {
  // Raw-body upload (Content-Type = the media type) so no multipart dependency is needed.
  app.register(async (scope) => {
    for (const type of ALLOWED_CONTENT_TYPES) {
      scope.addContentTypeParser(type, { parseAs: "buffer", bodyLimit: 10 * 1024 * 1024 }, (_req, body, done) =>
        done(null, body),
      );
    }
    // codecs suffixes (e.g. "audio/webm;codecs=opus") are matched by prefix
    scope.addContentTypeParser(/^audio\/.+/, { parseAs: "buffer", bodyLimit: 10 * 1024 * 1024 }, (_req, body, done) =>
      done(null, body),
    );

    scope.post(
      "/media",
      { preHandler: [optionalAuth(deps.authVerifier), submissionRateLimiter(deps.store, { scope: "media", citizenLimit: 40, anonymousLimit: 12 })] },
      async (request, reply) => {
        const kind = (request.query as { kind?: string }).kind as MediaKind | undefined;
        if (kind !== "photo" && kind !== "audio") {
          return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "kind must be photo or audio." } });
        }
        const contentType = (request.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
        const body = request.body as Buffer;
        if (!ALLOWED_CONTENT_TYPES.includes(contentType) || !contentType.startsWith(kind === "photo" ? "image/" : "audio/")) {
          return reply.code(415).send({ error: { code: "UNSUPPORTED_MEDIA_TYPE", message: `Unsupported type for ${kind}.` } });
        }
        if (!Buffer.isBuffer(body) || body.length === 0 || body.length > deps.mediaStore.maxBytes[kind]) {
          return reply.code(413).send({ error: { code: "PAYLOAD_TOO_LARGE", message: `${kind} must be 1 byte to up to ${Math.round(deps.mediaStore.maxBytes[kind] / 1024)} KB.` } });
        }
        if (kind === "photo" && !looksLikeImage(contentType, body)) {
          return reply.code(415).send({ error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "File contents do not match the declared image type." } });
        }
        const url = await deps.mediaStore.put(kind, contentType, body);
        return reply.code(201).send({ url });
      },
    );
  });
}
