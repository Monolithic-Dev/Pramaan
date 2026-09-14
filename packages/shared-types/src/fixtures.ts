// Fixture objects mirroring docs/DATA_MODEL.md's JSON examples exactly (plus the
// state_id every entity carries per §4). Assigning each fixture to its interface
// makes the compiler catch field drift; index.test.ts also checks the key sets
// at runtime so a typo that TS structural typing would tolerate still fails CI.
import type {
  AgentSession,
  Citizen,
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

export const citizenFixture: Citizen = {
  citizen_id: "cit_9af2",
  phone_hash: "sha256:...",
  preferred_language: "hi-IN",
  created_at: "2026-09-12T10:00:00Z",
};

export const submissionFixture: Submission = {
  submission_id: "sub_1a2b3c",
  citizen_id: "cit_9af2",
  channel: "whatsapp",
  raw_text: "sadak me bahut bada gaddha hai",
  raw_audio_url: null,
  photo_url: "gs://jansetu-media/photos/sub_1a2b3c.jpg",
  detected_language: "hi",
  translated_text: "There is a very large pothole on the road",
  lat: 28.6139,
  lng: 77.209,
  location_confidence: "high",
  submitted_at: "2026-09-12T10:02:11Z",
  status: "processed",
  state_id: "DL",
};

export const issueFixture: Issue = {
  issue_id: "iss_7d4e",
  category: "roads",
  subcategory: "pothole",
  canonical_description: "Large pothole causing traffic hazard near XYZ market",
  geo_cluster_id: "gc_442",
  submission_ids: ["sub_1a2b3c", "sub_9f0a1b"],
  report_count: 14,
  first_reported_at: "2026-09-10T08:00:00Z",
  last_reported_at: "2026-09-14T18:20:00Z",
  status: "prioritized",
  state_id: "DL",
};

export const geoClusterFixture: GeoCluster = {
  cluster_id: "gc_442",
  centroid_lat: 28.614,
  centroid_lng: 77.2088,
  admin_boundary: { ward: "Ward 14", district: "Central Delhi", state: "Delhi" },
  issue_ids: ["iss_7d4e", "iss_88a1"],
  state_id: "DL",
};

export const infraIndexFixture: InfraIndex = {
  region_id: "gc_442",
  index_type: "road_density",
  value: 0.42,
  source: "Sample derived from public infra survey data",
  year: 2025,
  state_id: "DL",
};

export const investmentRecordFixture: InvestmentRecord = {
  investment_id: "inv_3021",
  region_id: "gc_442",
  scheme_name: "Sample Road Maintenance Scheme",
  amount_inr: 500000,
  category: "roads",
  fiscal_year: "2024-25",
  state_id: "DL",
};

export const priorityScoreFixture: PriorityScore = {
  score_id: "score_iss_7d4e_v3",
  issue_id: "iss_7d4e",
  demand_score: 0.71,
  vulnerability_score: 0.55,
  gap_score: 0.63,
  duplication_penalty: 0.1,
  composite_score: 0.635,
  model_version: "formula-v1",
  computed_at: "2026-09-15T02:00:00Z",
  state_id: "DL",
};

export const projectFixture: Project = {
  project_id: "proj_112",
  issue_id: "iss_7d4e",
  generated_brief:
    "Ward 14 has received 14 distinct reports (from 22 raw submissions) about a road hazard since Sep 10. No road maintenance funding recorded in this ward in the last 2 fiscal years. Estimated population impact: ~3,200 residents within 500m.",
  composite_score: 0.635,
  status: "recommended",
  assigned_dept: "PWD",
  budget_estimate_inr: 500000,
  state_id: "DL",
};

export const impactRecordFixture: ImpactRecord = {
  impact_id: "imp_55",
  project_id: "proj_112",
  citizen_confirmations: 9,
  resolution_photo_url: "gs://jansetu-media/resolutions/proj_112.jpg",
  resolved_at: "2026-10-20T00:00:00Z",
  verified_by: "officer_204",
  state_id: "DL",
};

export const officerUserFixture: OfficerUser = {
  officer_id: "officer_204",
  name: "Sample Officer",
  role: "field_officer",
  jurisdiction: { ward: "Ward 14", district: "Central Delhi", state: "Delhi" },
  auth_provider_id: "idp|abc123",
  state_id: "DL",
};

export const agentSessionFixture: AgentSession = {
  session_id: "sess_88b2",
  officer_id: "officer_204",
  query_text:
    "What are the top 3 unaddressed road issues here, and are they already funded?",
  tool_calls: [
    { tool: "query_fused_data", params: { category: "roads", location: "Ward 14" } },
    { tool: "check_investment_status", params: { category: "roads" } },
  ],
  agent_response:
    "There are 14 distinct reports about a road hazard near XYZ market. There is no recorded investment in the last 2 fiscal years for this area.",
  timestamp: "2026-09-15T09:30:00Z",
  state_id: "DL",
};
