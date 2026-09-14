// TypeScript interfaces mirroring docs/DATA_MODEL.md. Field names/types must match
// the JSON examples there exactly — this is the shared contract every app imports.
//
// Migration note (see docs/phases/phase-2-data-layer.md): this file previously keyed
// InfraIndex/InvestmentRecord to GeoCluster, a dynamically-created entity that doesn't
// exist until a citizen reports something — every reference-data join silently missed.
// AdminRegion (below) is the fix: a stable, externally-coded administrative unit that
// reference data joins to, resolved from a GeoCluster's centroid by point-in-polygon.

export type SubmissionChannel = "web" | "voice" | "whatsapp" | "sms";
export type SubmissionStatus =
  | "queued"
  | "processing"
  | "deferred"
  | "processed"
  | "flagged"
  | "rejected"
  | "tombstoned";
export type LocationConfidence = "high" | "medium" | "low";
export type IssueStatus =
  | "open"
  | "verified"
  | "disputed"
  | "prioritized"
  | "funded"
  | "in_progress"
  | "resolved"
  | "tombstoned";
export type InfraIndexType =
  | "road_density"
  | "water_access"
  | "health_facility_ratio"
  | "literacy_rate"
  | "poverty_index"
  | "electrification_rate";
export type InvestmentDataOrigin = "public_dataset" | "synthetic_demo" | "partner_feed";
export type ProjectStatus = "recommended" | "funded" | "in_progress" | "completed";
export type OfficerRole = "field_officer" | "district_collector" | "state_admin";
export type AdminRegionLevel = "country" | "state" | "district" | "block" | "ward";

/** @deprecated Superseded by AdminRegion. Kept only for reading pre-migration fixtures/data. */
export interface AdminBoundary {
  ward: string;
  district: string;
  state: string;
}

/**
 * The unit of cross-border portability (docs/CROSS_BORDER_AND_DPG.md). Adding a
 * country is a document insert against this shape, not a code change.
 */
export interface CountryProfile {
  country_code: string;
  admin_levels: string[];
  region_code_authority: string;
  boundary_dataset_uri: string;
  official_languages: string[];
  canonical_working_language: string;
  currency: string;
  citizen_auth_method: string;
  policy_corpus_id: string;
  data_residency_region: string;
  privacy_regime: string;
}

/**
 * Stable, externally-defined administrative unit (LGD code for India). All reference
 * data (InfraIndex, InvestmentRecord) joins here — never to a GeoCluster.
 */
export interface AdminRegion {
  region_id: string;
  country_code: string;
  level: AdminRegionLevel;
  name: string;
  parent_region_id: string | null;
  population: number;
  boundary_ref: string;
  centroid: { lat: number; lng: number };
}

export interface ConsentRecord {
  consent_id: string;
  citizen_id: string;
  purpose: string;
  consent_text_version: string;
  language_shown: string;
  granted_at: string;
  channel: SubmissionChannel;
  withdrawn_at: string | null;
}

export interface Citizen {
  citizen_id: string;
  phone_hash: string;
  preferred_language: string;
  country_code: string;
  created_at: string;
  erasure_requested_at: string | null;
}

export interface Submission {
  submission_id: string;
  /** Client-generated UUID v4, reused across retries. Required (docs/EDGE_CASES.md #14). */
  idempotency_key: string;
  citizen_id: string;
  country_code: string;
  channel: SubmissionChannel;
  /** Null until STT transcribes it (voice channel) or immediately set (web/whatsapp/sms text). */
  raw_text: string | null;
  raw_audio_url: string | null;
  photo_url: string | null;
  /** Both null until the AI pipeline (Phase 4) processes the submission. */
  detected_language: string | null;
  translated_text: string | null;
  /** PII-scrubbed copy that flows to BigQuery; null until Phase 4 populates it. */
  pii_scrubbed_text: string | null;
  lat: number | null;
  lng: number | null;
  /** Landmark/ward text for the no-GPS flow (docs/EDGE_CASES.md #3); geocoded in Phase 4. */
  location_text: string | null;
  location_confidence: LocationConfidence;
  /** Precision-6 geohash of lat/lng; null until resolved. */
  geohash: string | null;
  /** AdminRegion.region_id resolved by point-in-polygon; null until Phase 4 resolves it. */
  resolved_region_id: string | null;
  /** Filled in once geo-clustered; null until then. */
  state_id: string | null;
  /** Set once merged/created into a canonical Issue (Phase 4); null until then. */
  issue_id: string | null;
  submitted_at: string;
  status: SubmissionStatus;
  processing_error: string | null;
}

export interface Issue {
  issue_id: string;
  country_code: string;
  state_id: string;
  category: string;
  subcategory: string;
  canonical_description: string;
  /** 768-dim text-embedding-005 vector of the canonical summary; null until Phase 4. */
  embedding: number[] | null;
  embedding_model: string | null;
  geo_cluster_id: string;
  /** AdminRegion.region_id, resolved once at cluster creation. Null until Phase 4. */
  admin_region_id: string | null;
  /** Precision-6 geohash of the cluster centroid; null until Phase 4. */
  geohash: string | null;
  submission_ids: string[];
  report_count: number;
  /** Distinct citizen_ids behind report_count — this, not report_count, feeds demand_score. */
  distinct_reporter_count: number;
  first_reported_at: string;
  last_reported_at: string;
  emergency_override: boolean;
  fraud_flags: string[];
  status: IssueStatus;
}

export interface GeoCluster {
  cluster_id: string;
  country_code: string;
  state_id: string;
  /** AdminRegion.region_id, resolved by point-in-polygon at creation — never trust
   *  citizen-typed admin names (docs/EDGE_CASES.md #17). Null until Phase 4 resolves it. */
  admin_region_id: string | null;
  centroid_lat: number;
  centroid_lng: number;
  geohash: string | null;
  radius_m: number;
  /** @deprecated Superseded by admin_region_id. Kept only for reading pre-migration fixtures/data. */
  admin_boundary?: AdminBoundary;
  issue_ids: string[];
}

export interface InfraIndex {
  /** AdminRegion.region_id — never a GeoCluster id. See migration note above. */
  region_id: string;
  country_code: string;
  state_id: string;
  index_type: InfraIndexType;
  value: number;
  /** 0-1 percentile within the country, precomputed at load time — never at query time. */
  normalised_value: number;
  source: string;
  source_url: string;
  licence: string;
  year: number;
}

export interface InvestmentRecord {
  investment_id: string;
  /** AdminRegion.region_id — never a GeoCluster id. See migration note above. */
  region_id: string;
  country_code: string;
  state_id: string;
  scheme_name: string;
  scheme_id: string;
  amount: number;
  currency: string;
  category: string;
  fiscal_year: string;
  sanctioned_at: string;
  /** Every synthetic record must be flagged — surfaced as a UI badge, not buried in a README. */
  data_origin: InvestmentDataOrigin;
}

export interface DataFallback {
  component: string;
  used_level: string;
  reason: string;
}

export interface PriorityScore {
  score_id: string;
  issue_id: string;
  country_code: string;
  state_id: string;
  demand_score: number;
  vulnerability_score: number;
  gap_score: number;
  duplication_penalty: number;
  /** Historical ImpactRecord.efficacy mean for (category, region ancestry); null if no history. */
  impact_efficacy: number | null;
  base_score: number;
  composite_score: number;
  weights: { demand: number; vulnerability: number; gap: number };
  data_fallbacks: DataFallback[];
  model_version: string;
  computed_at: string;
  /** true = scheduled batch score, the only kind any read path returns. Agent
   *  simulate_priority results are false and never reach the map or priorities list. */
  is_canonical: boolean;
}

export interface BriefCitation {
  claim: string;
  source: string;
  field?: string;
}

export interface Project {
  project_id: string;
  issue_id: string;
  country_code: string;
  state_id: string;
  generated_brief: string;
  brief_model_version: string;
  /** Generated by the post-generation verifier, not by Gemini. */
  brief_citations: BriefCitation[];
  groundedness_check: { passed: boolean; unverified_claims: string[] };
  composite_score: number;
  status: ProjectStatus;
  assigned_dept: string;
  budget_estimate_inr: number;
}

export interface ImpactRecord {
  impact_id: string;
  project_id: string;
  issue_id: string;
  country_code: string;
  state_id: string;
  category: string;
  region_id: string;
  confirmations_received: number;
  confirmations_required: number;
  confirmations_negative: number;
  resolution_photo_url: string | null;
  resolved_at: string;
  verified_by: string;
  /** positive / total responses — aggregated by (category, region_id) into impact_efficacy. */
  efficacy: number;
}

export interface OfficerUser {
  officer_id: string;
  name: string;
  role: OfficerRole;
  country_code: string;
  /** AdminRegion.region_id. Jurisdiction checks are an ancestor test on the region
   *  chain — enforceable server-side, unlike string comparison on a ward name. */
  region_id: string;
  auth_provider_id: string;
  state_id: string;
}

export interface AgentSession {
  session_id: string;
  officer_id: string;
  country_code: string;
  state_id: string;
  /** AdminRegion.region_id pinned for the session; every tool call is validated as a
   *  descendant of this scope before it runs. */
  region_scope: string;
  started_at: string;
  turn_count: number;
}

export interface AgentToolCall {
  tool: string;
  params: Record<string, unknown>;
  result_hash?: string;
  latency_ms?: number;
  row_count?: number;
}

export interface AgentCitation {
  span: [number, number];
  source: string;
  field?: string;
}

export interface AgentTurn {
  turn_id: string;
  session_id: string;
  query_text: string;
  tool_calls: AgentToolCall[];
  agent_response: string;
  citations: AgentCitation[];
  refused: boolean;
  refusal_reason: string | null;
  prompt_version: string;
  total_latency_ms: number;
  timestamp: string;
}
