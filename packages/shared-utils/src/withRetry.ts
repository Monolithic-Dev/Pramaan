// Every external call (Gemini, Translation, STT, BigQuery, WhatsApp, Identity
// Toolkit, Pub/Sub) goes through this — no bare fetch/SDK calls without retry/backoff.
export interface WithRetryOptions {
  attempts?: number;
  baseDelayMs?: number;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  { attempts = 3, baseDelayMs = 200 }: WithRetryOptions = {},
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt));
      }
    }
  }
  throw lastError;
}
