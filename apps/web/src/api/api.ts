import { http, httpBlobUrl } from "./http.js";
import type { PriorityScore, Project, ImpactRecord } from "@jansetu/shared-types";

// ---- Types (mirror the gateway's console routes) -------------------------------------------

export interface Permissions {
  view_console: boolean;
  update_issue_status: boolean;
  emergency_override: boolean;
  manage_projects: boolean;
  view_equity: boolean;
  manage_states: boolean;
  manage_officers: boolean;
  view_audit_log: boolean;
}

export interface Me {
  uid: string;
  kind: "citizen" | "officer";
  role: "field_officer" | "district_collector" | "state_admin" | null;
  region_id: string | null;
  country_code: string | null;
  preferred_language: string | null;
  permissions: Permissions;
}

export type Priority = "high" | "medium" | "low" | "pending";

export interface IssueSummary {
  issue_id: string;
  category: string;
  subcategory: string;
  description: string;
  status: string;
  report_count: number;
  distinct_reporter_count: number;
  composite_score: number | null;
  priority: Priority;
  admin_region_id: string | null;
  region_name: string | null;
  state_id: string;
  state_name: string | null;
  country_code: string;
  lat: number | null;
  lng: number | null;
  first_reported_at: string;
  last_reported_at: string;
  emergency_override: boolean;
  fraud_flags: string[];
  is_synthetic: boolean;
  has_project?: boolean;
}

export interface IssueDetail {
  issue: IssueSummary;
  score: PriorityScore | null;
  project: Project | null;
  impact: ImpactRecord | null;
  reports: {
    submission_id: string;
    channel: string;
    submitted_at: string;
    language: string | null;
    text: string | null;
    photo: string | null;
    has_audio: boolean;
    location_confidence: string;
  }[];
  history: { audit_id: string; actor_id: string; action: string; justification: string | null; timestamp: string; before: unknown; after: unknown }[];
}

export interface Overview {
  region: string;
  region_name: string;
  totals: {
    issues: number;
    reports: number;
    distinct_reporters: number;
    resolved: number;
    resolution_rate: number;
    high_priority: number;
    emergency: number;
    flagged: number;
    avg_score: number | null;
    sample_data: boolean;
  };
  by_category: { category: string; issues: number; reports: number }[];
  by_status: { status: string; count: number }[];
  top_regions: { region_id: string; name: string; issues: number; reports: number; top_score: number }[];
  trend_daily: { date: string; count: number }[];
  trend_monthly: { month: string; count: number }[];
}

export interface PublicOverview {
  status: "ok" | "insufficient_data";
  min_required?: number;
  totals?: Overview["totals"];
  by_category?: Overview["by_category"];
  by_status?: Overview["by_status"];
  trend_monthly?: Overview["trend_monthly"];
  states?: number;
}

export interface RegionInfo {
  regionId: string;
  name: string;
  level: string;
  parentRegionId: string | null;
  countryCode: string;
  population: number;
  lat: number;
  lng: number;
}

export interface MyReport {
  submission_id: string;
  submitted_at: string;
  channel: string;
  text: string | null;
  has_photo: boolean;
  has_audio: boolean;
  processing: string;
  category: string | null;
  issue_status: string | null;
  priority: Priority;
  other_reporters: number;
}

export interface ReportStatus {
  submission_status: string;
  issue_status: string | null;
  other_reporters: number;
  priority: Priority;
  explanation: string | null;
  explanation_language?: string;
  project_id: string | null;
  awaiting_confirmation: boolean;
  first_reported_at?: string;
  category?: string;
}

export interface OfficerAccount {
  uid: string;
  email: string;
  role: "field_officer" | "district_collector" | "state_admin";
  region_id: string;
  country_code: string;
  disabled: boolean;
  created_at: string | null;
  last_sign_in: string | null;
}

export interface AuditEntry {
  audit_id: string;
  actor_id: string;
  action: string;
  target_id?: string;
  justification: string | null;
  timestamp: string;
  before: unknown;
  after: unknown;
}

export interface ProjectRow extends Project {
  issue: IssueSummary;
}

export interface Forecast {
  forecast_id: string;
  geo_cluster_id: string;
  category: string;
  risk_level: "low" | "medium" | "high";
  predicted_window_start: string;
  predicted_window_end: string;
  contributing_factors: string[];
}

export interface EquityBand {
  vulnerability_band: "low" | "medium" | "high";
  avg_composite_score: number | null;
  avg_days_to_resolved: number | null;
  funded_ratio: number | null;
  sample_size: number;
  status: "ok" | "insufficient_data";
}

export interface TransparencyStats {
  state_id: string;
  status: "ok" | "insufficient_data";
  min_required?: number;
  total_reported?: number;
  pct_verified?: number;
  pct_funded?: number;
  pct_resolved?: number;
  avg_days_to_resolved?: number | null;
}

export interface IssueQuery {
  region?: string;
  category?: string;
  status?: string;
  q?: string;
  sort?: "score" | "reports" | "recent";
  flagged?: boolean;
}

const qs = (params: Record<string, string | number | boolean | undefined>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") s.set(k, String(v));
  const out = s.toString();
  return out ? `?${out}` : "";
};

// ---- Calls -----------------------------------------------------------------------------------

export const api = {
  me: () => http<Me>("/me"),
  ensureCitizenSession: (body: { preferred_language?: string; country_code?: string }) =>
    http<{ kind: string }>("/auth/session", { method: "POST", json: body }),

  // citizen
  myReports: () => http<{ reports: MyReport[] }>("/my-reports"),
  reportStatus: (id: string) => http<ReportStatus>(`/my-reports/${encodeURIComponent(id)}/status`),
  confirmResolution: (projectId: string, confirmed: boolean) =>
    http<{ status?: string }>(`/projects/${projectId}/confirm-resolution`, { method: "POST", json: { confirmed } }),
  myData: () => http<unknown>("/privacy/my-data"),
  eraseMyData: () => http<{ request_id: string }>("/privacy/erasure-requests", { method: "POST", json: { scope: "all_submissions" } }),

  // officer console
  overview: (region?: string) => http<Overview>(`/analytics/overview${qs({ region })}`),
  issues: (q: IssueQuery = {}) =>
    http<{ total: number; region: string; issues: IssueSummary[] }>(
      `/issues${qs({ region: q.region, category: q.category, status: q.status, q: q.q, sort: q.sort, flagged: q.flagged, limit: 500 })}`,
    ),
  issue: (id: string) => http<IssueDetail>(`/issues/${id}`),
  setIssueStatus: (id: string, status: string, justification: string) =>
    http<{ status: string }>(`/issues/${id}/status`, { method: "POST", json: { status, justification } }),
  setEmergency: (id: string, enabled: boolean, justification: string) =>
    http<{ emergency_override: boolean }>(`/issues/${id}/emergency-override`, { method: "POST", json: { enabled, justification } }),
  recommendProject: (id: string) => http<Project>(`/issues/${id}/project`, { method: "POST", json: {} }),
  projects: () => http<{ projects: ProjectRow[] }>("/projects"),
  setProjectStatus: (id: string, status: "funded" | "in_progress") =>
    http<Project>(`/projects/${id}/status`, { method: "POST", json: { status } }),
  markComplete: (id: string) => http<{ notified: number }>(`/projects/${id}/mark-complete`, { method: "POST", json: {} }),
  signOff: (id: string) => http<unknown>(`/projects/${id}/officer-signoff`, { method: "POST", json: {} }),
  forecasts: (region: string) =>
    http<{ forecasts: Forecast[]; not_forecast: { category: string; status: string; reason: string }[] }>(`/forecasts${qs({ region })}`),
  equity: (state: string) => http<{ bands: EquityBand[]; verdict: string }>(`/equity-audit${qs({ state })}`),
  regions: () => http<{ regions: RegionInfo[] }>("/regions"),
  photoUrl: (mediaUrl: string) => httpBlobUrl(`/media/${encodeURIComponent(mediaUrl)}`),

  // admin
  officers: () => http<{ officers: OfficerAccount[] }>("/admin/officers"),
  createOfficer: (body: { email: string; password: string; role: string; region_id: string }) =>
    http<OfficerAccount>("/admin/officers", { method: "POST", json: body }),
  setOfficerDisabled: (uid: string, disabled: boolean) =>
    http<OfficerAccount>(`/admin/officers/${uid}/disabled`, { method: "POST", json: { disabled } }),
  audit: () => http<{ entries: AuditEntry[] }>("/admin/audit"),
  states: () => http<{ states: { state_id: string; name: string; country_code: string; created_at: string }[] }>("/states"),
  addState: (state_id: string, name: string) => http<unknown>("/admin/states", { method: "POST", json: { state_id, name } }),

  // public
  publicOverview: () => http<PublicOverview>("/public/overview", { auth: false }),
  publicRegions: (params: { level?: string; parent?: string; country?: string } = {}) =>
    http<{ regions: RegionInfo[] }>(`/public/regions${qs(params)}`, { auth: false }),
  transparency: (state: string) => http<TransparencyStats>(`/public/transparency${qs({ state })}`, { auth: false }),
};

import type { CreateSubmissionInput } from "./client.js";

/** Submit a report with the signed-in citizen's token (if any) so it lands in their account. */
export function submitReportAuthed(input: CreateSubmissionInput, idempotencyKey: string) {
  return http<{ submission_id: string; status: string }>("/submissions", {
    method: "POST",
    json: input,
    headers: { "idempotency-key": idempotencyKey },
  });
}

export function uploadMediaAuthed(kind: "photo" | "audio", blob: Blob) {
  return http<{ url: string }>(`/media?kind=${kind}`, {
    method: "POST",
    body: blob,
    headers: { "content-type": blob.type || (kind === "photo" ? "image/jpeg" : "audio/webm") },
  }).then((r) => r.url);
}

export interface MapForecast {
  forecast_id: string;
  category: string;
  risk_level: string;
  window_start: string;
  window_end: string;
  lat: number;
  lng: number;
}

/** Forecast markers (each placed at the centroid of the history it was derived from). */
export const mapForecasts = (region: string) =>
  http<{ forecasts: MapForecast[] }>(`/map/markers${qs({ region })}`);
