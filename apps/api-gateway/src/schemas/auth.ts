import { z } from "zod";

const E164_PHONE = /^\+[1-9]\d{1,14}$/;

export const otpRequestSchema = z.object({
  phone: z.string().regex(E164_PHONE, "phone must be E.164 format, e.g. +919812345678"),
  country_code: z.string().length(2).optional(),
});

export const otpVerifySchema = z.object({
  request_id: z.string().min(1),
  otp: z.string().min(1),
  // Repeated here (not just on /request) because the two calls don't share
  // server-side session state (docs/CROSS_BORDER_AND_DPG.md) — the frontend
  // already knows the country from the language picked before OTP request.
  country_code: z.string().length(2).optional(),
});
