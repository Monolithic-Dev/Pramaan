import { z } from "zod";

export const emergencyOverrideSchema = z.object({
  enabled: z.boolean(),
  justification: z.string().min(1),
});
