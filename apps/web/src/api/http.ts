import { ApiClientError, BASE_URL } from "./client.js";

// Every authenticated call asks the auth layer for a token at request time, so an expired token
// is refreshed transparently instead of surfacing as a 401 in the middle of a task.
let tokenGetter: () => Promise<string | null> = async () => null;
export function setTokenGetter(fn: () => Promise<string | null>) {
  tokenGetter = fn;
}

export interface RequestOptions {
  method?: string;
  json?: unknown;
  body?: BodyInit;
  headers?: Record<string, string>;
  /** false for public endpoints: no Authorization header, no token refresh. */
  auth?: boolean;
  signal?: AbortSignal;
}

export async function http<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.json !== undefined) headers["content-type"] = "application/json";
  if (opts.auth !== false) {
    const token = await tokenGetter();
    if (token) headers.authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${BASE_URL}${path}`, {
    method: opts.method ?? (opts.json !== undefined || opts.body ? "POST" : "GET"),
    headers,
    body: opts.json !== undefined ? JSON.stringify(opts.json) : opts.body,
    signal: opts.signal,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: { code: string; message: string } } | null;
    throw new ApiClientError(
      response.status,
      body?.error?.code ?? "UNKNOWN_ERROR",
      body?.error?.message ?? `Request failed (${response.status})`,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

/** Fetches an authenticated binary (e.g. a report photo) as an object URL. */
export async function httpBlobUrl(path: string): Promise<string> {
  const token = await tokenGetter();
  const response = await fetch(`${BASE_URL}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  if (!response.ok) throw new ApiClientError(response.status, "MEDIA_ERROR", "Could not load the file.");
  return URL.createObjectURL(await response.blob());
}

/** An authenticated download (e.g. a CSV export) as a Blob. */
export async function httpBlob(path: string): Promise<Blob> {
  const token = await tokenGetter();
  const response = await fetch(`${BASE_URL}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  if (!response.ok) throw new ApiClientError(response.status, "DOWNLOAD_ERROR", "Could not download the file.");
  return response.blob();
}

export const getIdToken = () => tokenGetter();
