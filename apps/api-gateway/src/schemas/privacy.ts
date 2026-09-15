import { z } from "zod";

export const erasureRequestSchema = z.object({
  scope: z.literal("all_submissions"),
});
