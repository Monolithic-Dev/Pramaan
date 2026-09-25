/** Indian digit grouping: 4,50,000 shows as "₹4.5 L", 1,20,00,000 as "₹1.2 Cr". Pass currency "BRL" for reais. */
export function money(amount: number, currency: "INR" | "BRL" = "INR"): string {
  const symbol = currency === "BRL" ? "R$" : "₹";
  if (currency === "BRL") {
    if (amount >= 1_000_000) return `${symbol}${trim(amount / 1_000_000)} M`;
    if (amount >= 1_000) return `${symbol}${trim(amount / 1_000)} K`;
    return `${symbol}${Math.round(amount)}`;
  }
  if (amount >= 10_000_000) return `${symbol}${trim(amount / 10_000_000)} Cr`;
  if (amount >= 100_000) return `${symbol}${trim(amount / 100_000)} L`;
  if (amount >= 1_000) return `${symbol}${trim(amount / 1_000)} K`;
  return `${symbol}${Math.round(amount)}`;
}

const trim = (n: number) => String(Number(n.toFixed(n >= 100 ? 0 : n >= 10 ? 1 : 2)));

/** 12,345 -> "12.3K", 4,500,000 -> "4.5M": for tiles where a full number would not fit. */
export function compact(n: number): string {
  if (n >= 10_000_000) return `${trim(n / 10_000_000)} Cr`;
  if (n >= 100_000) return `${trim(n / 100_000)} L`;
  if (n >= 1_000) return `${trim(n / 1_000)}K`;
  return String(Math.round(n));
}

export const fullNumber = (n: number) => n.toLocaleString("en-IN");

export const pct = (n: number | null | undefined, digits = 0) => (n === null || n === undefined ? "-" : `${(n * 100).toFixed(digits)}%`);

/** Downloads a Blob as a file: used for CSV exports. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
