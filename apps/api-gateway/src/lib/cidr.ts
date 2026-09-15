// IPv4-only CIDR containment check — the demo-day allowlist only ever needs
// to cover one venue WiFi range (docs/phases/phase-8-fraud-impact-crossborder.md
// §8.1: "a room of judges shares one WiFi IP"), so IPv6 support isn't worth
// the extra code here.
function ipToInt(ip: string): number | null {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return null;
  return parts.reduce((acc, part) => (acc << 8) + part, 0) >>> 0;
}

export function isIpInCidr(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split("/");
  const bits = Number(bitsStr ?? 32);
  const ipInt = ipToInt(ip);
  const rangeInt = ipToInt(range);
  if (ipInt === null || rangeInt === null || Number.isNaN(bits)) return false;
  if (bits === 0) return true;
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

export function isIpAllowlisted(ip: string, allowlist: string[]): boolean {
  return allowlist.some((cidr) => isIpInCidr(ip, cidr));
}
