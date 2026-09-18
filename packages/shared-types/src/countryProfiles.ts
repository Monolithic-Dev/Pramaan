// Runtime registry backing CountryProfile (docs/CROSS_BORDER_AND_DPG.md).
// Adding a country is a registry entry, not a code change — every consumer
// goes through getCountryProfile() rather than hardcoding "IN".
import type { CountryProfile } from "./index.js";

export const COUNTRY_PROFILES: Record<string, CountryProfile> = {
  IN: {
    country_code: "IN",
    admin_levels: ["state", "district", "block", "ward"],
    region_code_authority: "LGD",
    boundary_dataset_uri: "bq://jansetu.reference.in_admin_boundaries",
    official_languages: ["hi", "ta", "bn", "mr", "te", "en"],
    canonical_working_language: "en",
    currency: "INR",
    citizen_auth_method: "phone_otp",
    policy_corpus_id: "corpus_in_v1",
    data_residency_region: "asia-south1",
    privacy_regime: "DPDP_2023",
  },
  BR: {
    country_code: "BR",
    admin_levels: ["estado", "município", "distrito", "bairro"],
    region_code_authority: "IBGE",
    boundary_dataset_uri: "bq://jansetu.reference.br_admin_boundaries",
    official_languages: ["pt"],
    canonical_working_language: "pt",
    currency: "BRL",
    citizen_auth_method: "phone_otp",
    policy_corpus_id: "corpus_br_v1",
    data_residency_region: "southamerica-east1",
    privacy_regime: "LGPD",
  },
};

export const DEFAULT_COUNTRY_CODE = "IN";

/** Falls back to the default profile for an unregistered code rather than throwing —
 *  a typo'd country_code should degrade to India's behaviour, not crash a request. */
export function getCountryProfile(countryCode: string | null | undefined): CountryProfile {
  return COUNTRY_PROFILES[countryCode ?? ""] ?? COUNTRY_PROFILES[DEFAULT_COUNTRY_CODE];
}
