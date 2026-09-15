// Regex-only PII scrub, run inline on the citizen's request path (cheap).
// The Gemini-based pass that catches names/addresses a regex can't (docs/EDGE_CASES.md
// #19) runs later in the worker, never inline — see docs/phases/phase-3-ingestion.md §3.5.
const PATTERNS: RegExp[] = [
  /\+?\d[\d\s-]{8,14}\d/g, // phone numbers (E.164-ish or locally formatted)
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, // emails
  /\b[A-Z]{5}\d{4}[A-Z]\b/g, // PAN-style ID numbers
  /\b\d{4}\s?\d{4}\s?\d{4}\b/g, // Aadhaar-style 12-digit ID numbers
];

export function scrubPii(text: string): string {
  return PATTERNS.reduce((acc, pattern) => acc.replace(pattern, "[redacted]"), text);
}
