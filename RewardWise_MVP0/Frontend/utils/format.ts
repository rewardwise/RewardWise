/**
 * Format a numeric value as USD currency with thousands separators.
 * Used across verdict, wallet, concierge, and audio surfaces.
 */
export function fmtMoney(value?: number | null, digits = 0): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `$${Number(value).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}
