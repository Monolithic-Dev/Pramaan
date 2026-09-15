import { z } from "zod";

export const createSessionSchema = z.object({
  region_scope: z.string().min(1),
});

export const postMessageSchema = z.object({
  text: z.string().min(1),
});
