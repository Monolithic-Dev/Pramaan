import { z } from "zod";

export const createSubmissionSchema = z
  .object({
    channel: z.enum(["web", "voice", "whatsapp", "sms"]),
    text: z.string().min(1).optional(),
    audio_url: z.string().url().nullable().optional(),
    photo_url: z.string().url().nullable().optional(),
    // No-GPS flow (EDGE_CASES.md #3): a citizen with no coordinates sends a
    // landmark/ward description instead; the worker geocodes it in Phase 4.
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    location_text: z.string().min(1).nullable().optional(),
    consent_version: z.string().min(1),
    // Anonymous-submission country hint (docs/CROSS_BORDER_AND_DPG.md) — the
    // frontend derives this from the selected language; ignored for a
    // citizen who already has a country_code on their Citizen record.
    country_code: z.string().length(2).optional(),
  })
  .refine((body) => Boolean(body.text || body.audio_url || body.photo_url), {
    message: "At least one of text, audio_url, or photo_url is required.",
  })
  .refine((body) => (body.lat === undefined) === (body.lng === undefined), {
    message: "lat and lng must be provided together.",
  })
  .refine((body) => Boolean((body.lat !== undefined && body.lng !== undefined) || body.location_text), {
    message: "Either lat/lng or location_text is required.",
  });

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;

// Required per API_SPEC.md §2: "Idempotency-Key: <client-generated uuid v4> — required."
export const idempotencyKeyHeaderSchema = z
  .string()
  .min(1, "Idempotency-Key header is required.");
