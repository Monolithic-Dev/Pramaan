// TypeScript interfaces mirroring docs/DATA_MODEL.md. Field names/types must match
// the JSON examples there exactly — this is the shared contract every app imports.

export type SubmissionChannel = "web" | "voice" | "whatsapp";
export type SubmissionStatus = "queued" | "processing" | "processed" | "flagged" | "rejected";
export type LocationConfidence = "high" | "medium" | "low";
export type IssueStatus =
  | "open"
  | "verified"
  | "disputed"
  | "prioritized"
  | "funded"
  | "in_progress"
  | "resolved";
export type InfraIndexType =
  | "road_density"
  | "water_access"
  | "health_facility_ratio"
  | "literacy_rate"
  | "poverty_index";
export type ProjectStatus = "recommended" | "funded" | "in_progress" | "completed";
export type OfficerRole = "field_officer" | "district_collector" | "state_admin";

export interface AdminBoundary {
  ward: string;
  district: string;
  state: string;
}

export interface Citizen {
  citizen_id: string;
  phone_hash: string;
  preferred_language: string;
  created_at: string;
}

export interface Submission {
  submission_id: string;
  citizen_id: string;
  channel: SubmissionChannel;
  raw_text: string;
  raw_audio_url: string | null;
  photo_url: string | null;
  detected_language: string;
  translated_text: string;
  lat: number;
  lng: number;
  location_confidence: LocationConfidence;
  submitted_at: string;
  status: SubmissionStatus;
  /** Filled in once the submission is geo-clustered; null until then. */
  state_id: string | null;
}

export interface Issue {
  issue_id: string;
  category: string;
  subcategory: string;
  canonical_description: string;
  geo_cluster_id: string;
  submission_ids: string[];
  report_count: number;
  first_reported_at: string;
  last_reported_at: string;
  status: IssueStatus;
  state_id: string;
}

export interface GeoCluster {
  cluster_id: string;
  centroid_lat: number;
  centroid_lng: number;
  admin_boundary: AdminBoundary;
  issue_ids: string[];
  state_id: string;
}

export interface InfraIndex {
  region_id: string;
  index_type: InfraIndexType;
  value: number;
  source: string;
  year: number;
  state_id: string;
}

export interface InvestmentRecord {
  investment_id: string;
  region_id: string;
  scheme_name: string;
  amount_inr: number;
  category: string;
  fiscal_year: string;
  state_id: string;
}

export interface PriorityScore {
  score_id: string;
  issue_id: string;
  demand_score: number;
  vulnerability_score: number;
  gap_score: number;
  duplication_penalty: number;
  composite_score: number;
  model_version: string;
  computed_at: string;
  state_id: string;
}

export interface Project {
  project_id: string;
  issue_id: string;
  generated_brief: string;
  composite_score: number;
  status: ProjectStatus;
  assigned_dept: string;
  budget_estimate_inr: number;
  state_id: string;
}

export interface ImpactRecord {
  impact_id: string;
  project_id: string;
  citizen_confirmations: number;
  resolution_photo_url: string | null;
  resolved_at: string;
  verified_by: string;
  state_id: string;
}

export interface OfficerUser {
  officer_id: string;
  name: string;
  role: OfficerRole;
  jurisdiction: AdminBoundary;
  auth_provider_id: string;
  state_id: string;
}

export interface AgentToolCall {
  tool: string;
  params: Record<string, unknown>;
}

export interface AgentSession {
  session_id: string;
  officer_id: string;
  query_text: string;
  tool_calls: AgentToolCall[];
  agent_response: string;
  timestamp: string;
  state_id: string;
}
