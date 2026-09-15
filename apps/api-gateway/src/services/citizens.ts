import { createHash } from "node:crypto";
import type { Citizen } from "@jansetu/shared-types";
import { hashPhone } from "@jansetu/shared-utils";
import type { Deps } from "../deps.js";

// WhatsApp/SMS senders arrive pre-verified by the telecom/provider layer — there
// is no OTP step for these channels, so the citizen_id is derived deterministically
// from the phone number instead of a Firebase UID.
export async function getOrCreateCitizenByPhone(deps: Deps, phone: string): Promise<Citizen> {
  const citizenId = `cit_${createHash("sha256").update(phone).digest("hex").slice(0, 16)}`;
  const existing = await deps.store.getCitizen(citizenId);
  if (existing) return existing;

  const citizen: Citizen = {
    citizen_id: citizenId,
    phone_hash: hashPhone(phone),
    preferred_language: "en-IN",
    country_code: "IN",
    created_at: new Date().toISOString(),
    erasure_requested_at: null,
  };
  await deps.store.putCitizen(citizen);
  return citizen;
}
