/** @format */

// HTML5 `<input type="date">` in Chrome and Safari accepts year segments up
// to 6 digits once the user types past the 4-char year. The raw value pipes
// through to Supabase / SerpAPI / seats.aero and crashes downstream calls.
// MAX_ISO_DATE caps the picker; isValidISODate + clampISODate gate the
// onChange path so 5+ digit years (and any other malformed input) never
// reach component state.

export const MAX_ISO_DATE = "2099-12-31";

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_YEAR = 2099;

export function isValidISODate(value: string): boolean {
  if (value === "") return true;
  const m = ISO_DATE_RE.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (year < 1 || year > MAX_YEAR) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  return true;
}

export function clampISODate(value: string, current: string): string {
  return isValidISODate(value) ? value : current;
}
