import { z } from "zod";

// Normalized shape we control — the real Gupshup/Twilio payload gets mapped to
// this at the provider-integration step once a sandbox account exists (see
// docs/phases/phase-3-manual-checklist.md). Keeping this schema provider-agnostic
// means WhatsApp and SMS share one handler.
export const channelWebhookSchema = z.object({
  from: z.string().min(1),
  message_id: z.string().min(1),
  text: z.string().min(1).optional(),
  photo_url: z.string().url().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  location_text: z.string().min(1).optional(),
});
