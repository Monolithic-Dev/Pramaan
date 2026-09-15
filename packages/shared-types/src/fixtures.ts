// Fixture objects mirroring docs/DATA_MODEL.md's JSON examples exactly. Assigning
// each fixture to its interface makes the compiler catch field drift; index.test.ts
// also checks the key sets at runtime so a typo TS structural typing would tolerate
// still fails CI.
import type {
  AdminRegion,
  AgentSession,
  AgentTurn,
  Citizen,
  ConsentRecord,
  CountryProfile,
  GeoCluster,
  ImpactRecord,
  InfraIndex,
  Issue,
  InvestmentRecord,
  OfficerUser,
  PriorityScore,
  Project,
  Submission,
} from "./index.js";

export const countryProfileFixture: CountryProfile = {
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
};

export const adminRegionFixture: AdminRegion = {
  region_id: "LGD:IN-07-091-0014",
  country_code: "IN",
  level: "ward",
  name: "Ward 14",
  parent_region_id: "LGD:IN-07-091",
  population: 18400,
  boundary_ref: "bq://jansetu.reference.in_admin_boundaries/ward/0014",
  centroid: { lat: 28.6141, lng: 77.2085 },
};

export const consentRecordFixture: ConsentRecord = {
  consent_id: "con_771",
  citizen_id: "cit_9af2",
  purpose: "infrastructure_prioritisation",
  consent_text_version: "dpdp-notice-v1-hi",
  language_shown: "hi-IN",
  granted_at: "2026-09-12T10:01:55Z",
  channel: "whatsapp",
  withdrawn_at: null,
};

export const citizenFixture: Citizen = {
  citizen_id: "cit_9af2",
  phone_hash: "sha256:...",
  preferred_language: "hi-IN",
  country_code: "IN",
  created_at: "2026-09-12T10:00:00Z",
  erasure_requested_at: null,
};

export const submissionFixture: Submission = {
  submission_id: "sub_1a2b3c",
  idempotency_key: "cli_5f2e9a4c-8b31-4d02-9a17-77c0e1b3d2aa",
  citizen_id: "cit_9af2",
  country_code: "IN",
  channel: "whatsapp",
  raw_text: "sadak me bahut bada gaddha hai",
  raw_audio_url: null,
  photo_url: "gs://jansetu-media/photos/sub_1a2b3c.jpg",
  detected_language: "hi",
  translated_text: "There is a very large pothole on the road",
  pii_scrubbed_text: "There is a very large pothole on the road",
  lat: 28.6139,
  lng: 77.209,
  location_text: null,
  location_confidence: "high",
  geohash: "ttnfv2",
  resolved_region_id: "LGD:IN-07-091-0014",
  state_id: "DL",
  issue_id: "iss_7d4e",
  submitted_at: "2026-09-12T10:02:11Z",
  status: "processed",
  processing_error: null,
  submitter_ip_hash: "sha256:...",
};

export const issueFixture: Issue = {
  issue_id: "iss_7d4e",
  country_code: "IN",
  state_id: "DL",
  category: "roads",
  subcategory: "pothole",
  canonical_description: "Large pothole causing traffic hazard near XYZ market",
  embedding: [0.0123, -0.0456],
  embedding_model: "text-embedding-005",
  geo_cluster_id: "gc_442",
  admin_region_id: "LGD:IN-07-091-0014",
  geohash: "ttnfv2",
  submission_ids: ["sub_1a2b3c", "sub_9f0a1b"],
  report_count: 14,
  distinct_reporter_count: 11,
  first_reported_at: "2026-09-10T08:00:00Z",
  last_reported_at: "2026-09-14T18:20:00Z",
  emergency_override: false,
  fraud_flags: [],
  status: "prioritized",
  composite_score: 0.628,
  latest_score_id: "score_iss_7d4e_v3",
};

export const geoClusterFixture: GeoCluster = {
  cluster_id: "gc_442",
  country_code: "IN",
  state_id: "DL",
  admin_region_id: "LGD:IN-07-091-0014",
  centroid_lat: 28.614,
  centroid_lng: 77.2088,
  geohash: "ttnfv2",
  radius_m: 300,
  issue_ids: ["iss_7d4e", "iss_88a1"],
};

export const infraIndexFixture: InfraIndex = {
  region_id: "LGD:IN-07-091-0014",
  country_code: "IN",
  state_id: "DL",
  index_type: "road_density",
  value: 0.42,
  normalised_value: 0.38,
  source: "Sample derived from public infra survey data",
  source_url: "https://censusindia.gov.in/",
  licence: "Government Open Data Licence - India",
  year: 2025,
};

export const investmentRecordFixture: InvestmentRecord = {
  investment_id: "inv_3021",
  region_id: "LGD:IN-07-091-0014",
  country_code: "IN",
  state_id: "DL",
  scheme_name: "Sample Road Maintenance Scheme",
  scheme_id: "PMGSY",
  amount: 500000,
  currency: "INR",
  category: "roads",
  fiscal_year: "2024-25",
  sanctioned_at: "2024-06-01",
  data_origin: "synthetic_demo",
};

export const priorityScoreFixture: PriorityScore = {
  score_id: "score_iss_7d4e_v3",
  issue_id: "iss_7d4e",
  country_code: "IN",
  state_id: "DL",
  demand_score: 0.71,
  vulnerability_score: 0.55,
  gap_score: 0.63,
  duplication_penalty: 0.1,
  impact_efficacy: null,
  base_score: 0.638,
  composite_score: 0.628,
  weights: { demand: 0.4, vulnerability: 0.3, gap: 0.3 },
  data_fallbacks: [
    { component: "vulnerability_score", used_level: "district", reason: "no ward-level poverty_index" },
  ],
  model_version: "formula-v2",
  computed_at: "2026-09-15T02:00:00Z",
  is_canonical: true,
};

export const projectFixture: Project = {
  project_id: "proj_112",
  issue_id: "iss_7d4e",
  country_code: "IN",
  state_id: "DL",
  generated_brief:
    "Ward 14 has received 14 distinct reports (from 22 raw submissions) about a road hazard since Sep 10. No road maintenance funding recorded in this ward in the last 2 fiscal years. Estimated population impact: ~3,200 residents within 500m.",
  brief_model_version: "gemini-2.5-flash / brief-prompt-v3",
  brief_citations: [
    { claim: "14 distinct reports since Sep 10", source: "tool:query_fused_data", field: "distinct_reporter_count" },
    { claim: "No road funding in last 2 FY", source: "tool:check_investment_status" },
  ],
  groundedness_check: { passed: true, unverified_claims: [] },
  composite_score: 0.628,
  status: "recommended",
  assigned_dept: "PWD",
  budget_estimate_inr: 500000,
  marked_complete_at: null,
  officer_signed_off_at: null,
};

export const impactRecordFixture: ImpactRecord = {
  impact_id: "imp_55",
  project_id: "proj_112",
  issue_id: "iss_7d4e",
  country_code: "IN",
  state_id: "DL",
  category: "roads",
  region_id: "LGD:IN-07-091-0014",
  confirmations_received: 9,
  confirmations_required: 3,
  confirmations_negative: 1,
  resolution_photo_url: "gs://jansetu-media/resolutions/proj_112.jpg",
  resolved_at: "2026-10-20T00:00:00Z",
  verified_by: "officer_204",
  efficacy: 0.9,
};

export const officerUserFixture: OfficerUser = {
  officer_id: "officer_204",
  name: "Sample Officer",
  role: "field_officer",
  country_code: "IN",
  region_id: "LGD:IN-07-091-0014",
  auth_provider_id: "idp|abc123",
  state_id: "DL",
};

export const agentSessionFixture: AgentSession = {
  session_id: "sess_88b2",
  officer_id: "officer_204",
  country_code: "IN",
  state_id: "DL",
  region_scope: "LGD:IN-07-091-0014",
  started_at: "2026-09-15T09:28:00Z",
  turn_count: 4,
};

export const agentTurnFixture: AgentTurn = {
  turn_id: "turn_88b2_02",
  session_id: "sess_88b2",
  query_text: "What are the top 3 unaddressed road issues here, and are they already funded?",
  tool_calls: [
    {
      tool: "query_fused_data",
      params: { category: "roads", region_id: "LGD:IN-07-091-0014" },
      result_hash: "sha256:ab12",
      latency_ms: 340,
      row_count: 3,
    },
    {
      tool: "check_investment_status",
      params: { category: "roads", region_id: "LGD:IN-07-091-0014" },
      result_hash: "sha256:cd34",
      latency_ms: 210,
      row_count: 0,
    },
  ],
  agent_response:
    "There are 14 distinct reports about a road hazard near XYZ market. There is no recorded investment in the last 2 fiscal years for this area.",
  citations: [{ span: [0, 42], source: "tool:query_fused_data" }],
  refused: false,
  refusal_reason: null,
  prompt_version: "agent-system-v2",
  total_latency_ms: 2180,
  timestamp: "2026-09-15T09:30:00Z",
};
