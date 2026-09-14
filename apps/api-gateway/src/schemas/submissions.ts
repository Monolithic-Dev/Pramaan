import { z } from "zod";

export const createSubmissionSchema = z
  .object({
    channel: z.enum(["web", "voice", "whatsapp"]),
    text: z.string().min(1).optional(),
    audio_url: z.string().url().nullable().optional(),
    photo_url: z.string().url().nullable().optional(),
    // Text-only "describe a landmark" flow for no-GPS citizens (EDGE_CASES.md #3)
    // is geocoded by the AI pipeline in Phase 4 — Phase 3's ingestion layer
    // requires coordinates already resolved client-side.
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })
  .refine((body) => Boolean(body.text || body.audio_url || body.photo_url), {
    message: "At least one of text, audio_url, or photo_url is required.",
  });

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
