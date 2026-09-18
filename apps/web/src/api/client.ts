// Thin fetch wrapper over the real api-gateway (docs/API_SPEC.md). No
// dashboard-side jurisdiction filtering here — the officer's JWT already
// scopes every response server-side (senior-frontend skill).
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/v1";

export interface ApiError {
  error: { code: string; message: string };
}

export class ApiClientError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;
    throw new ApiClientError(
      response.status,
      body?.error.code ?? "UNKNOWN_ERROR",
      body?.error.message ?? `Request to ${path} failed with ${response.status}`,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export interface CreateSubmissionInput {
  channel: "web" | "voice";
  text?: string;
  photo_url?: string | null;
  lat?: number;
  lng?: number;
  location_text?: string;
  consent_version: string;
  country_code?: string;
}

export interface CreateSubmissionResult {
  submission_id: string;
  status: string;
}

export function submitReport(
  input: CreateSubmissionInput,
  idempotencyKey: string,
): Promise<CreateSubmissionResult> {
  return request("/submissions", {
    method: "POST",
    headers: { "idempotency-key": idempotencyKey },
    body: JSON.stringify(input),
  });
}

export function createAgentSession(
  token: string,
  regionScope: string,
): Promise<{ session_id: string }> {
  return request("/agent/sessions", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify({ region_scope: regionScope }),
  });
}

export function getIssueScore(issueId: string) {
  return request(`/issues/${issueId}/score`);
}

/**
 * Streams the SSE response from POST /agent/sessions/{id}/messages. Browsers'
 * native EventSource only supports GET, so this reads the fetch Response body
 * stream directly — real streaming, not a polyfill.
 */
export async function streamAgentMessage(
  token: string,
  sessionId: string,
  text: string,
  onEvent: (event: string, data: unknown) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${BASE_URL}/agent/sessions/${sessionId}/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ text }),
    signal,
  });
  if (!response.ok || !response.body) {
    throw new ApiClientError(response.status, "STREAM_ERROR", "Failed to open the agent stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const eventLine = rawEvent.split("\n").find((l) => l.startsWith("event: "));
      const dataLine = rawEvent.split("\n").find((l) => l.startsWith("data: "));
      if (eventLine && dataLine) {
        onEvent(eventLine.slice("event: ".length), JSON.parse(dataLine.slice("data: ".length)));
      }
      boundary = buffer.indexOf("\n\n");
    }
  }
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

export interface ReportStatus {
  submission_status: string;
  issue_status: string | null;
  other_reporters: number;
  priority: "high" | "medium" | "low" | "pending";
  explanation: string | null;
  preferred_language: string | null;
}

export function getReportStatus(token: string, submissionId: string): Promise<ReportStatus> {
  return request(`/my-reports/${encodeURIComponent(submissionId)}/status`, { headers: bearer(token) });
}

export type TransparencyStats =
  | { state_id: string; status: "insufficient_data"; min_required: number }
  | {
      state_id: string;
      status: "ok";
      total_reported: number;
      pct_verified: number;
      pct_funded: number;
      pct_resolved: number;
      avg_days_to_resolved: number | null;
    };

export function getTransparency(stateId: string): Promise<TransparencyStats> {
  return request(`/public/transparency?state=${encodeURIComponent(stateId)}`);
}

export interface RiskForecast {
  forecast_id: string;
  geo_cluster_id: string;
  category: string;
  risk_level: "low" | "medium" | "high";
  predicted_window_start: string;
  predicted_window_end: string;
  contributing_factors: string[];
}

export function getForecasts(token: string, region: string) {
  return request<{ forecasts: RiskForecast[]; not_forecast: { category: string; reason: string }[] }>(
    `/forecasts?region=${encodeURIComponent(region)}`,
    { headers: bearer(token) },
  );
}

export interface EquityBand {
  vulnerability_band: "low" | "medium" | "high";
  avg_composite_score: number | null;
  funded_ratio: number | null;
  sample_size: number;
  status: "ok" | "insufficient_data";
}

export function getEquityAudit(token: string, state: string) {
  return request<{ bands: EquityBand[]; verdict: string }>(
    `/equity-audit?state=${encodeURIComponent(state)}`,
    { headers: bearer(token) },
  );
}

export function listStates(token: string) {
  return request<{ states: { state_id: string; name: string }[] }>("/states", { headers: bearer(token) });
}

export function addState(token: string, stateId: string, name: string) {
  return request<{ state_id: string }>("/admin/states", {
    method: "POST",
    headers: bearer(token),
    body: JSON.stringify({ state_id: stateId, name }),
  });
}
