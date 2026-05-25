/** @format */

// HTML5 `<input type="date">` in Chrome and Safari accepts year segments up
// to 6 digits once the user types past the 4-char year. The raw value pipes
// through to Supabase / SerpAPI / seats.aero and crashes downstream calls.
// isValidISODate + clampISODate gate the onChange path so 5+ digit years
// (and any other malformed input) never reach component state.
//
// Horizon helpers (added 2026-05-25): the calendar picker also needs a
// forward cap aligned to provider data horizons, not the year 2099. The
// default award horizon (360 days) tracks seats.aero's documented window;
// the cash horizon (329 days) tracks FlightAPI / SerpAPI's GDS bound.
// Both are env-tunable at deploy time.

const DEFAULT_AWARD_HORIZON_DAYS = 360;
const DEFAULT_CASH_HORIZON_DAYS = 329;

function readHorizon(envName: string, fallback: number): number {
  const raw = process.env[envName];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(
      `[dateInput] ignoring invalid ${envName}="${raw}", falling back to ${fallback}`,
    );
    return fallback;
  }
  return Math.floor(parsed);
}

/**
 * Calendar picker forward cap (days from today). Aligns with seats.aero's
 * documented 360-day award window. Past this date, no provider returns
 * data. Override via `NEXT_PUBLIC_AWARD_HORIZON_DAYS`.
 *
 * Evaluated at module load — `NEXT_PUBLIC_*` env values are baked at
 * build time, so changes require a redeploy.
 */
export const AWARD_HORIZON_DAYS = readHorizon(
  "NEXT_PUBLIC_AWARD_HORIZON_DAYS",
  DEFAULT_AWARD_HORIZON_DAYS,
);

/**
 * Live cash-fare horizon (days from today). FlightAPI (~330d) and
 * SerpAPI/Google Flights (329d) are both bounded by GDS publishing
 * windows. Beyond this point cash queries return empty and the verdict
 * falls back to "awards only". Override via `NEXT_PUBLIC_CASH_HORIZON_DAYS`.
 *
 * Evaluated at module load (see {@link AWARD_HORIZON_DAYS}).
 */
export const CASH_HORIZON_DAYS = readHorizon(
  "NEXT_PUBLIC_CASH_HORIZON_DAYS",
  DEFAULT_CASH_HORIZON_DAYS,
);

/**
 * @deprecated Use {@link getMaxSearchDate} for picker `max` attributes.
 *   Held only for backward compat during the horizon-aware migration —
 *   PR 2/6 of the partial-data series rewires the two `home/page.tsx`
 *   call sites and removes this export.
 */
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

/**
 * Return `today + days` as an ISO date string (YYYY-MM-DD). Uses UTC so
 * results are stable across timezones. Production callers omit `today`;
 * tests pass a fixed Date for determinism.
 */
export function todayPlusDays(days: number, today: Date = new Date()): string {
  const d = new Date(today.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Calendar picker `max` attribute value — the broader of the two horizons
 * (award space). Users can select past the cash horizon, but the UI
 * surfaces a warning (PR 3) and the verdict gracefully degrades to
 * awards-only (PR 5).
 */
export function getMaxSearchDate(today: Date = new Date()): string {
  return todayPlusDays(AWARD_HORIZON_DAYS, today);
}

/**
 * The last date for which live cash fares are expected. Beyond this date,
 * cash providers (FlightAPI, SerpAPI) typically return empty.
 */
export function getCashHorizonDate(today: Date = new Date()): string {
  return todayPlusDays(CASH_HORIZON_DAYS, today);
}

/**
 * True if `date` (YYYY-MM-DD) is strictly after the cash horizon. Used
 * to gate the CashHorizonWarning UI (PR 3) and downstream verdict
 * messaging (PR 5). Returns false for empty / invalid input so callers
 * don't need to pre-validate.
 */
export function isPastCashHorizon(
  date: string,
  today: Date = new Date(),
): boolean {
  if (date === "" || !isValidISODate(date)) return false;
  return date > getCashHorizonDate(today);
}
