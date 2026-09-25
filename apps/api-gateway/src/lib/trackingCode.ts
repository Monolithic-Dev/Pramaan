import { randomBytes } from "node:crypto";

// Crockford-style alphabet without the characters people misread over a phone line or SMS
// (no 0/O, 1/I/L). 31^8 is roughly 8.5e11, which together with the per-IP lookup rate limit
// makes guessing a live code impractical.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function newTrackingCode(): string {
  const bytes = randomBytes(8);
  let code = "";
  for (const b of bytes) code += ALPHABET[b % ALPHABET.length];
  return `JS-${code}`;
}

/** Accepts what a citizen actually types ("js 7k3m9qpd", "JS-7K3M-9QPD") and returns the stored form, or null. */
export function normalizeTrackingCode(input: string): string | null {
  const compact = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  // The prefix is optional. A body may itself begin with "JS", so strip it only when it is extra.
  const body = compact.length === 10 && compact.startsWith("JS") ? compact.slice(2) : compact;
  return body.length === 8 && [...body].every((c) => ALPHABET.includes(c)) ? `JS-${body}` : null;
}
