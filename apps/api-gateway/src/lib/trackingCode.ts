import { randomBytes } from "node:crypto";

// Crockford-style alphabet without the characters people misread over a phone line or SMS
// (no 0/O, 1/I/L). 31^8 is roughly 8.5e11, which together with the per-IP lookup rate limit
// makes guessing a live code impractical.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** "PR" for Pramaan. Codes issued before the rename start with "JS" and must keep working. */
const PREFIX = "PR";
const LEGACY_PREFIXES = ["JS"];

export function newTrackingCode(): string {
  const bytes = randomBytes(8);
  let code = "";
  for (const b of bytes) code += ALPHABET[b % ALPHABET.length];
  return `${PREFIX}-${code}`;
}

/** Accepts what a citizen actually types ("pr 7k3m9qpd", "PR-7K3M-9QPD", an old "JS-…" code) and returns the stored form, or null. */
export function normalizeTrackingCode(input: string): string | null {
  const compact = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  // The prefix is optional. A body may itself begin with "PR" or "JS", so strip it only when it is extra.
  const prefix = [PREFIX, ...LEGACY_PREFIXES].find((p) => compact.length === 10 && compact.startsWith(p));
  const body = prefix ? compact.slice(prefix.length) : compact;
  if (body.length !== 8 || ![...body].every((c) => ALPHABET.includes(c))) return null;
  return `${prefix ?? PREFIX}-${body}`;
}

/** Every stored form a normalized code could have: typed without a prefix, it may be an old "JS-" code. */
export function trackingCodeCandidates(code: string): string[] {
  const body = code.slice(3);
  return [code, ...[PREFIX, ...LEGACY_PREFIXES].map((p) => `${p}-${body}`).filter((c) => c !== code)];
}

/** Looks a normalized code up under each form it could be stored in. */
export async function findByTrackingCode<T>(
  store: { getSubmissionByTrackingCode(code: string): Promise<T | null> },
  code: string,
): Promise<T | null> {
  for (const candidate of trackingCodeCandidates(code)) {
    const found = await store.getSubmissionByTrackingCode(candidate);
    if (found) return found;
  }
  return null;
}
