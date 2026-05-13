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

export function formatPointsForDisplay(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "";
  return n.toLocaleString("en-US");
}

export function parsePointsInput(s: string): number {
  if (!s || s.trim() === "") return NaN;
  const cleaned = s.replace(/[^\d-]/g, "");
  if (cleaned === "" || cleaned === "-") return NaN;
  return Number(cleaned);
}

export interface PointsValidationResult {
  ok: boolean;
  reason?: string;
}

export function validatePoints(value: number): PointsValidationResult {
  if (Number.isNaN(value)) return { ok: false, reason: "Please enter a number" };
  if (value < 0) return { ok: false, reason: "Cannot be negative" };
  return { ok: true };
}
