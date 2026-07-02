import type React from "react";

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
  let cleaned = s.replace(/[^\d.-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return NaN;
  const decimalIdx = cleaned.indexOf(".");
  if (decimalIdx >= 0) {
    cleaned = cleaned.substring(0, decimalIdx);
  }
  if (cleaned === "" || cleaned === "-") return NaN;
  const result = Number(cleaned);
  if (Number.isNaN(result)) return NaN;
  return Math.trunc(result);
}

export interface PointsValidationResult {
  ok: boolean;
  reason?: string;
}

/**
 * Max plausible per-card points balance. Anything above this is almost certainly
 * a data-entry mistake (e.g. an accidental ×1000 / extra zeros). Set to 50M:
 * comfortably above even the highest legitimate holdings (walletSanity.ts notes
 * Hilton/IHG power users routinely reach the 8-figure / ~10M+ range), yet far
 * below the ~1.9B inflated-data band this guard exists to prevent recurring.
 */
export const MAX_POINTS_BALANCE = 50_000_000;

export function validatePoints(value: number): PointsValidationResult {
  if (Number.isNaN(value)) return { ok: false, reason: "Please enter a number" };
  if (value < 0) return { ok: false, reason: "Cannot be negative" };
  if (value > MAX_POINTS_BALANCE) {
    return {
      ok: false,
      reason: `That looks too high (over ${MAX_POINTS_BALANCE.toLocaleString()}). Enter total points, e.g. 250000 for 250K.`,
    };
  }
  return { ok: true };
}

// Wires an integer-with-thousands-separators input to a controlled `number`
// value. Returns `{ value, onChange }` props to spread onto a text input.
// Display is always comma-formatted (no focus/blur split). On each keystroke
// the helper counts digits to the left of the cursor in the user's raw
// keystroke, then after re-formatting places the cursor after that same digit
// count in the new string, so commas appearing or disappearing don't make the
// cursor jump.
export function formatNumberInputProps(args: {
  value: number | undefined;
  onValueChange: (next: number) => void;
}): {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
} {
  const { value, onValueChange } = args;
  const display =
    value === undefined || Number.isNaN(value) ? "" : value.toLocaleString("en-US");

  return {
    value: display,
    onChange: (e) => {
      const input = e.target;
      const rawValue = input.value;
      const cursorBefore = input.selectionStart ?? rawValue.length;

      let digitsBefore = 0;
      for (let i = 0; i < cursorBefore; i++) {
        const ch = rawValue[i];
        if (ch >= "0" && ch <= "9") digitsBefore++;
      }

      const parsed = parsePointsInput(rawValue);
      onValueChange(parsed);

      const nextDisplay = Number.isNaN(parsed) ? "" : parsed.toLocaleString("en-US");
      let newCursor = 0;
      if (digitsBefore > 0) {
        let seen = 0;
        newCursor = nextDisplay.length;
        for (let i = 0; i < nextDisplay.length; i++) {
          const ch = nextDisplay[i];
          if (ch >= "0" && ch <= "9") seen++;
          if (seen === digitsBefore) {
            newCursor = i + 1;
            break;
          }
        }
      }

      requestAnimationFrame(() => {
        try {
          input.setSelectionRange(newCursor, newCursor);
        } catch {
          // setSelectionRange throws on inputs that have been unmounted or
          // detached between the change event and the next frame. Swallow.
        }
      });
    },
  };
}
