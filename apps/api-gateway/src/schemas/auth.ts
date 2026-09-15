import { z } from "zod";

const E164_PHONE = /^\+[1-9]\d{1,14}$/;

export const otpRequestSchema = z.object({
  phone: z.string().regex(E164_PHONE, "phone must be E.164 format, e.g. +919812345678"),
  country_code: z.string().length(2).optional(),
});

export const otpVerifySchema = z.object({
  request_id: z.string().min(1),
  otp: z.string().min(1),
});
