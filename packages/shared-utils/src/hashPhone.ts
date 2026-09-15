import { createHash } from "node:crypto";

// Raw phone numbers never leave the auth provider (docs/SECURITY_PRIVACY.md §2) —
// every stored reference is this hash instead.
export function hashPhone(phone: string): string {
  return `sha256:${createHash("sha256").update(phone).digest("hex")}`;
}
