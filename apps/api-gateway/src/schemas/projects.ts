import { z } from "zod";

export const confirmResolutionSchema = z.object({
  confirmed: z.boolean(),
  photo_url: z.string().url().nullable().optional(),
});
