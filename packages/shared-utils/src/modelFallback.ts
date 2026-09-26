// Calling a hosted model whose individual versions come and go, get overloaded or silently hang
// (observed on the free Gemini tier: a model that answered in 1s would hang for 90s minutes later).
// A fixed fallback order with a long timeout turns one sick model into a 25s stall on every call,
// so this keeps per-process health: a model that just failed is skipped for a cooldown, the model
// that last worked is tried first, every attempt is cancelled at its timeout, and the whole call
// gives up at an overall deadline instead of walking the entire chain.

const RETRYABLE = /\b(429|500|502|503|504|404)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded|high demand|timed out|fetch failed|ECONNRESET|no longer available|not found|aborted/i;

/** How long a model is skipped after a failure of each kind. */
export const COOLDOWN_MS = {
  gone: 60 * 60_000, // 404 / retired model: not coming back soon
  timeout: 3 * 60_000, // hung: likely congested for a while
  busy: 60_000, // 429 / 503: usually short spikes
  other: 30_000,
} as const;

function classify(message: string): keyof typeof COOLDOWN_MS {
  if (/\b404\b|no longer available|not found/i.test(message)) return "gone";
  if (/timed out|aborted/i.test(message)) return "timeout";
  if (/\b(429|503)\b|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded|high demand/i.test(message)) return "busy";
  return "other";
}

export interface ModelCallOptions {
  /** Per-attempt timeout; the attempt's AbortSignal fires when it passes. */
  timeoutMs: number;
  /** Give up after this long in total, even if untried models remain. */
  deadlineMs?: number;
}

export class ModelPool {
  private readonly coolUntil = new Map<string, number>();
  private lastGood: string | null = null;

  constructor(private readonly now: () => number = Date.now) {}

  /** Healthy models first (the last one that worked leading), then cooling ones as a last resort. */
  order(models: string[]): string[] {
    const t = this.now();
    const healthy = models.filter((m) => (this.coolUntil.get(m) ?? 0) <= t);
    const cooling = models.filter((m) => (this.coolUntil.get(m) ?? 0) > t).sort((a, b) => this.coolUntil.get(a)! - this.coolUntil.get(b)!);
    if (this.lastGood && healthy.includes(this.lastGood)) healthy.unshift(...healthy.splice(healthy.indexOf(this.lastGood), 1));
    return [...healthy, ...cooling];
  }

  async call<T>(models: string[], attempt: (model: string, signal: AbortSignal) => Promise<T>, opts: ModelCallOptions): Promise<T> {
    const started = this.now();
    let lastError: unknown = new Error("no models configured");
    for (const model of this.order(models)) {
      if (opts.deadlineMs !== undefined && this.now() - started >= opts.deadlineMs) break;
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const result = await Promise.race([
          attempt(model, controller.signal),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              // Settle as a timeout first, then cancel: the attempt's own abort rejection must lose the race.
              reject(new Error(`${model} timed out after ${opts.timeoutMs}ms`));
              controller.abort();
            }, opts.timeoutMs);
          }),
        ]);
        this.lastGood = model;
        this.coolUntil.delete(model);
        return result;
      } catch (err) {
        lastError = err;
        const message = String((err as Error)?.message ?? err);
        // A real request error (bad schema, bad prompt) would fail identically on every model.
        if (!RETRYABLE.test(message)) throw err;
        this.coolUntil.set(model, this.now() + COOLDOWN_MS[classify(message)]);
        if (this.lastGood === model) this.lastGood = null;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError;
  }
}
