import { http, httpBlob, httpBlobUrl } from "./http.js";
import type { PriorityScore, Project, ImpactRecord } from "@pramaan/shared-types";

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
  /** When the citizen record was created; null for officers. */
  member_since?: string | null;
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
  support_count: number;
  assigned_to_uid: string | null;
  assigned_to_label: string | null;
  sla: Sla;
  /** Detail view only: the embedding model that placed this issue for duplicate matching. */
  embedding_model?: string | null;
}

export interface Sla {
  due_at: string;
  state: "met" | "ok" | "due_soon" | "overdue";
  days_left: number | null;
  /** 1: missed deadline, raised to the district collector. 2: missed by a further window, raised to the state admin. */
  escalation?: 0 | 1 | 2;
  escalated_to?: "district_collector" | "state_admin" | null;
}

export interface NearbyIssue {
  issue_id: string;
  category: string;
  subcategory: string;
  status: string;
  report_count: number;
  support_count: number;
  distance_m: number;
  first_reported_at: string;
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
    translated_text?: string | null;
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

export interface Scheme {
  id: string;
  name: string;
  short: string;
  ministry: string;
  categories: string[];
  settlement: "urban" | "rural" | "both";
  centre_share: number;
  summary: string;
  keywords: string[];
  priority: string;
  requires_mp_recommendation?: boolean;
  guideline_note: string;
}

export interface SchemeMatch {
  scheme: Scheme;
  fit: number;
  reasons: string[];
  funding: { budget_inr: number; centre_inr: number; state_inr: number };
}

export interface Alignment {
  region: string;
  open_issues: number;
  total_cost_inr: number;
  centre_inr: number;
  state_inr: number;
  centre_share: number;
  by_scheme: { scheme_id: string; short: string; name: string; priority: string; issues: number; cost_inr: number; centre_inr: number }[];
}

export interface PlanItem {
  issue_id: string;
  cost_inr: number;
  value: number;
  composite_score: number;
  vulnerability_score: number;
  beneficiaries: number;
  category: string;
  region_id: string | null;
  scheme_id: string | null;
  description?: string;
  subcategory?: string;
  region_name?: string | null;
  report_count?: number;
}

export interface PlanOutcome {
  items: PlanItem[];
  cost_inr: number;
  beneficiaries: number;
  vulnerable_share: number;
  avg_score: number;
}

export interface OptimizeResult {
  region: string;
  params: { budget_inr: number; min_vulnerable_share: number };
  candidates: number;
  candidates_cost_inr: number;
  plan: PlanOutcome;
  remaining_inr: number;
  equity_floor_met: boolean;
  baseline: PlanOutcome;
  left_out: PlanItem[];
}

export interface SavedPlan {
  plan_id: string;
  name: string;
  region_id: string;
  created_by: string;
  created_at: string;
  status: "draft" | "approved";
  approved_at: string | null;
  params: { budget_inr: number; min_vulnerable_share: number };
  items: PlanItem[];
  totals: { cost_inr: number; beneficiaries: number; vulnerable_share: number; issues: number };
}

export interface WeightRow {
  issue_id: string;
  category: string;
  region_id: string | null;
  region_name: string | null;
  current: number;
  simulated: number;
  rank: number;
  previous_rank: number | null;
  moved: number;
}

export interface ImpactLedger {
  region?: string;
  region_name?: string;
  status?: "ok" | "insufficient_data";
  min_required?: number;
  sample_data?: boolean;
  issues: number;
  resolved: number;
  resolution_rate: number;
  avg_days_to_resolve: number | null;
  people_benefited: number;
  funds_committed_inr: number;
  funds_completed_inr: number;
  cost_per_beneficiary_inr: number | null;
  citizen_confirmations: number;
  confirmation_rate: number | null;
  by_category: { category: string; resolved: number; avg_days: number | null; efficacy: number | null }[];
  monthly_resolved: { month: string; count: number }[];
}

export interface BriefingFacts {
  region: { id: string; name: string };
  generated_at: string;
  totals: Overview["totals"];
  last_7_days: { new_issues: number; actions_taken: number };
  top_priorities: { issue_id: string; category: string; region_name: string | null; score: number | null; reports: number; status: string; has_project: boolean }[];
  overdue: { count: number; oldest_days: number | null };
  forecasts: { region_name: string; category: string; risk_level: string; month: string }[];
  funding: { needed: string; central_drawable: string; central_share_pct: number };
  recommended_actions: string[];
}

export interface Notification {
  notification_id: string;
  kind: string;
  params: Record<string, string | number>;
  link: string;
  created_at: string;
  read_at: string | null;
}

export interface ActivityEvent {
  kind: "report" | "action";
  at: string;
  issue_id: string;
  category: string;
  region_name: string | null;
  detail: string | null;
  action: string | null;
}

export interface Comment {
  comment_id: string;
  author_label: string;
  author_role: string;
  body: string;
  created_at: string;
}

export interface DirectoryOfficer {
  uid: string;
  email: string;
  role: string;
  region_id: string;
}

export type Grade = "A" | "B" | "C" | "D" | "E";
export type Scorecard =
  | { region_id: string; name: string; status: "insufficient_data"; min_required: number }
  | {
      region_id: string;
      name: string;
      state_id: string;
      status: "ok";
      issues: number;
      resolved: number;
      resolution_rate: number;
      avg_days_to_resolve: number | null;
      open_backlog: number;
      overdue_share: number;
      grade: Grade;
      points: number;
    };

export interface PublicIssue {
  issue_id: string;
  category: string;
  status: string;
  priority: Priority;
  report_count: number;
  support_count: number;
  region_name: string | null;
  lat: number;
  lng: number;
  first_reported_at: string;
  is_synthetic: boolean;
}

export interface Tracking {
  tracking_code: string;
  submitted_at: string;
  channel: string;
  processing: string;
  stage: "received" | "understood" | "verified" | "funded" | "fixed";
  stages: string[];
  category: string | null;
  issue_status: string | null;
  priority: Priority;
  other_reporters: number;
  project_stage: string | null;
  /** The work is marked done: this reporter is being asked whether it was really fixed. */
  awaiting_confirmation?: boolean;
  /** Times citizens rejected the fix and sent the work back. */
  reopened_count?: number;
}

export type Quadrant = "underserved" | "targeted" | "over_indexed" | "stable";

export interface NeedVsSpendRow {
  region_id: string;
  name: string;
  state_name: string | null;
  country_code: string;
  population: number;
  vulnerability: number | null;
  /** null on the public view when too few reports to print. */
  open_issues: number | null;
  waiting_reporters: number | null;
  demand_per_100k: number | null;
  investment: number;
  currency: string;
  investment_per_capita: number;
  need_index: number;
  spend_index: number;
  gap: number;
  quadrant: Quadrant;
  top_unmet_categories: { category: string; reporters: number }[];
}

export interface NeedVsSpend {
  region?: string;
  fiscal_years_from: string;
  districts: NeedVsSpendRow[];
  quadrants: Record<Quadrant, number>;
  alignment: number | null;
  verdict: "aligned" | "partly_aligned" | "misaligned" | "insufficient_data";
  underserved_people_waiting: number;
  underserved_population: number;
  min_public_count?: number;
}

export interface SchemePerformanceRow {
  scheme_id: string;
  short: string;
  name: string;
  ministry: string;
  priority: string;
  centre_share: number;
  projects: number;
  pipeline: { recommended: number; funded: number; in_progress: number; completed: number };
  committed_inr: number;
  central_inr: number;
  completed: number;
  delivery_rate: number | null;
  avg_days_to_fix: number | null;
  people_benefited: number;
  cost_per_person_inr: number | null;
  citizen_confirmation: number | null;
  reopened: number;
  categories: string[];
  signal: "delivering" | "slow" | "quality_concerns" | "early";
}

export interface SchemePerformance {
  region?: string;
  sample_data?: boolean;
  totals: { schemes: number; projects: number; committed_inr: number; central_inr: number; completed: number; people_benefited: number };
  schemes: SchemePerformanceRow[];
}

export interface PhotoSuggestion {
  shows_issue: boolean;
  category: string;
  subcategory: string;
  description: string;
  severity: "low" | "medium" | "high";
  safety_hazard: boolean;
  language: string;
}

export type DemoReply =
  | { kind: "report"; tracking_code: string; reply: string }
  | { kind: "status"; tracking_code: string; stage: string; reply: string }
  | { kind: "status_not_found"; reply: string };

export interface IssueQuery {
  region?: string;
  category?: string;
  status?: string;
  q?: string;
  sort?: "score" | "reports" | "recent";
  flagged?: boolean;
  assigned?: "me" | "unassigned";
  overdue?: boolean;
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
  updateMe: (body: { preferred_language: string }) => http<{ preferred_language: string }>("/me", { method: "PATCH", json: body }),
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
      `/issues${qs({ region: q.region, category: q.category, status: q.status, q: q.q, sort: q.sort, flagged: q.flagged, assigned: q.assigned, overdue: q.overdue ? "true" : undefined, limit: 500 })}`,
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

  // workflow
  directory: () => http<{ officers: DirectoryOfficer[] }>("/officers/directory"),
  assign: (id: string, officer_uid: string | null, due_in_days?: number) =>
    http<{ assigned_to_uid: string | null; assigned_to_label: string | null }>(`/issues/${id}/assign`, { method: "POST", json: { officer_uid, due_in_days } }),
  comments: (id: string) => http<{ comments: Comment[] }>(`/issues/${id}/comments`),
  addComment: (id: string, body: string) => http<Comment>(`/issues/${id}/comments`, { method: "POST", json: { body } }),
  notifications: () => http<{ notifications: Notification[]; unread: number }>("/notifications"),
  markRead: (ids?: string[]) => http<{ marked: number }>("/notifications/read", { method: "POST", json: { ids } }),
  activity: (region?: string) => http<{ events: ActivityEvent[] }>(`/activity${qs({ region })}`),

  // planning and funding
  schemes: () => http<{ schemes: Scheme[] }>("/schemes"),
  issueSchemes: (id: string, settlement?: "urban" | "rural") =>
    http<{ settlement: string; settlement_basis: string; budget_inr: number | null; matches: SchemeMatch[] }>(`/issues/${id}/schemes${qs({ settlement })}`),
  alignment: (region?: string) => http<Alignment>(`/schemes/alignment${qs({ region })}`),
  optimize: (body: { region?: string; budget_inr: number; min_vulnerable_share: number }) => http<OptimizeResult>("/planner/optimize", { method: "POST", json: body }),
  savePlan: (body: { region?: string; budget_inr: number; min_vulnerable_share: number; name: string }) => http<SavedPlan>("/planner/plans", { method: "POST", json: body }),
  plans: () => http<{ plans: SavedPlan[] }>("/planner/plans"),
  approvePlan: (id: string) => http<{ plan: SavedPlan; funded: number; skipped: { issue_id: string; reason: string }[] }>(`/planner/plans/${id}/approve`, { method: "POST", json: {} }),
  needVsSpend: (region?: string) => http<NeedVsSpend>(`/analytics/need-vs-spend${qs({ region })}`),
  schemePerformance: (region?: string) => http<SchemePerformance>(`/schemes/performance${qs({ region })}`),
  setProjectScheme: (projectId: string, scheme_id: string) => http<Project>(`/projects/${projectId}/scheme`, { method: "POST", json: { scheme_id } }),
  assistPhoto: (photo_url: string, language: string) => http<PhotoSuggestion>("/assist/photo", { method: "POST", json: { photo_url, language } }),
  simulateWeights: (body: { region?: string; demand: number; vulnerability: number; gap: number }) =>
    http<{ weights: { demand: number; vulnerability: number; gap: number }; ranking: WeightRow[] }>("/planner/simulate-weights", { method: "POST", json: body }),

  // reports
  briefing: (region?: string, lang?: string) =>
    http<{ facts: BriefingFacts; narrative: { text: string; source: "gemini" | "template" }; language: string }>(`/reports/briefing${qs({ region, lang })}`),
  impact: (region?: string) => http<ImpactLedger>(`/analytics/impact${qs({ region })}`),
  exportIssuesCsv: (region?: string) => httpBlob(`/export/issues.csv${qs({ region })}`),

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
  publicScorecards: (group: "district" | "state" = "district", country?: string) =>
    http<{ group: string; min_public_count: number; formula: { resolution: number; responsiveness: number; speed: number; speed_days_zero_score: number }; sample_data: boolean; scorecards: Scorecard[] }>(`/public/scorecards${qs({ group, country })}`, { auth: false }),
  publicImpact: () => http<ImpactLedger>("/public/impact", { auth: false }),
  publicIssues: (params: { country?: string; category?: string } = {}) => http<{ issues: PublicIssue[] }>(`/public/issues${qs(params)}`, { auth: false }),
  publicSchemes: () => http<{ schemes: Scheme[] }>("/public/schemes", { auth: false }),
  track: (code: string) => http<Tracking>(`/public/track/${encodeURIComponent(code)}`, { auth: false }),
  confirmByCode: (code: string, confirmed: boolean) =>
    http<{ completed: boolean; reopened: boolean }>(`/public/track/${encodeURIComponent(code)}/confirm`, { method: "POST", json: { confirmed }, auth: false }),
  nearby: (lat: number, lng: number) =>
    http<{ radius_m: number; issues: NearbyIssue[] }>(`/public/nearby${qs({ lat, lng })}`, { auth: false }),
  support: (issueId: string) => http<{ support_count: number; already_supported: boolean }>(`/issues/${issueId}/support`, { method: "POST", json: {} }),
  publicNeedVsSpend: (country?: string) => http<NeedVsSpend>(`/public/need-vs-spend${qs({ country })}`, { auth: false }),
  publicSchemePerformance: (country?: string) => http<SchemePerformance>(`/public/schemes/performance${qs({ country })}`, { auth: false }),
  demoMessage: (body: { channel: "sms" | "whatsapp"; text: string; location_text?: string; country_code?: string }) =>
    http<DemoReply>("/public/demo/message", { method: "POST", json: body, auth: false }),
  transparency: (state: string) => http<TransparencyStats>(`/public/transparency${qs({ state })}`, { auth: false }),
};

import type { CreateSubmissionInput } from "./client.js";

/** Submit a report with the signed-in citizen's token (if any) so it lands in their account. */
export function submitReportAuthed(input: CreateSubmissionInput, idempotencyKey: string) {
  return http<{ submission_id: string; status: string; tracking_code?: string | null }>("/submissions", {
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
