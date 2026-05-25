import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AWARD_HORIZON_DAYS,
  CASH_HORIZON_DAYS,
  getCashHorizonDate,
  getMaxSearchDate,
  isPastCashHorizon,
  todayPlusDays,
} from "../utils/dateInput";

// Fixed reference date used across deterministic tests. UTC midnight on
// 2026-05-25 (the day the partial-data series was scoped) so date math
// is timezone-agnostic.
const FIXED_TODAY = new Date("2026-05-25T00:00:00.000Z");

describe("AWARD_HORIZON_DAYS / CASH_HORIZON_DAYS defaults", () => {
  it("AWARD_HORIZON_DAYS defaults to 360 (seats.aero documented window)", () => {
    expect(AWARD_HORIZON_DAYS).toBe(360);
  });

  it("CASH_HORIZON_DAYS defaults to 329 (SerpAPI/Google Flights bound)", () => {
    expect(CASH_HORIZON_DAYS).toBe(329);
  });

  it("AWARD horizon is broader than CASH horizon (gap = partial-data zone)", () => {
    expect(AWARD_HORIZON_DAYS).toBeGreaterThan(CASH_HORIZON_DAYS);
  });
});

describe("todayPlusDays", () => {
  it("returns the same date for days=0", () => {
    expect(todayPlusDays(0, FIXED_TODAY)).toBe("2026-05-25");
  });

  it("advances by one day", () => {
    expect(todayPlusDays(1, FIXED_TODAY)).toBe("2026-05-26");
  });

  it("rolls over month boundary", () => {
    expect(todayPlusDays(7, FIXED_TODAY)).toBe("2026-06-01");
  });

  it("rolls over year boundary (329 days = SerpAPI horizon)", () => {
    expect(todayPlusDays(329, FIXED_TODAY)).toBe("2027-04-19");
  });

  it("rolls over year boundary (360 days = seats.aero horizon)", () => {
    expect(todayPlusDays(360, FIXED_TODAY)).toBe("2027-05-20");
  });

  it("handles negative offsets (past dates)", () => {
    expect(todayPlusDays(-1, FIXED_TODAY)).toBe("2026-05-24");
  });
});

describe("getMaxSearchDate", () => {
  it("equals today + AWARD_HORIZON_DAYS", () => {
    expect(getMaxSearchDate(FIXED_TODAY)).toBe(
      todayPlusDays(AWARD_HORIZON_DAYS, FIXED_TODAY),
    );
  });

  it("returns 2027-05-20 for the canonical reference date", () => {
    expect(getMaxSearchDate(FIXED_TODAY)).toBe("2027-05-20");
  });
});

describe("getCashHorizonDate", () => {
  it("equals today + CASH_HORIZON_DAYS", () => {
    expect(getCashHorizonDate(FIXED_TODAY)).toBe(
      todayPlusDays(CASH_HORIZON_DAYS, FIXED_TODAY),
    );
  });

  it("returns 2027-04-19 for the canonical reference date", () => {
    expect(getCashHorizonDate(FIXED_TODAY)).toBe("2027-04-19");
  });
});

describe("isPastCashHorizon", () => {
  it("returns false for the cash horizon date itself (boundary)", () => {
    expect(isPastCashHorizon("2027-04-19", FIXED_TODAY)).toBe(false);
  });

  it("returns true for the SEA→TYO repro date (2027-04-20, one day past horizon)", () => {
    // The bug-repro date that surfaced this whole series — inside the
    // seats.aero 360d window but past the SerpAPI 329d cash horizon.
    expect(isPastCashHorizon("2027-04-20", FIXED_TODAY)).toBe(true);
  });

  it("returns false for a date well within the cash horizon", () => {
    expect(isPastCashHorizon("2026-08-15", FIXED_TODAY)).toBe(false);
  });

  it("returns false for empty string (callers don't need to pre-validate)", () => {
    expect(isPastCashHorizon("", FIXED_TODAY)).toBe(false);
  });

  it("returns false for malformed input (callers don't need to pre-validate)", () => {
    expect(isPastCashHorizon("not-a-date", FIXED_TODAY)).toBe(false);
    expect(isPastCashHorizon("20269-06-15", FIXED_TODAY)).toBe(false);
  });
});

describe("env-var tunability", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    warnSpy.mockRestore();
  });

  it("AWARD_HORIZON_DAYS reads NEXT_PUBLIC_AWARD_HORIZON_DAYS when set", async () => {
    vi.stubEnv("NEXT_PUBLIC_AWARD_HORIZON_DAYS", "180");
    vi.resetModules();
    const mod = await import("../utils/dateInput");
    expect(mod.AWARD_HORIZON_DAYS).toBe(180);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("CASH_HORIZON_DAYS reads NEXT_PUBLIC_CASH_HORIZON_DAYS when set", async () => {
    vi.stubEnv("NEXT_PUBLIC_CASH_HORIZON_DAYS", "200");
    vi.resetModules();
    const mod = await import("../utils/dateInput");
    expect(mod.CASH_HORIZON_DAYS).toBe(200);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("falls back to default when env value is non-numeric", async () => {
    vi.stubEnv("NEXT_PUBLIC_AWARD_HORIZON_DAYS", "not-a-number");
    vi.resetModules();
    const mod = await import("../utils/dateInput");
    expect(mod.AWARD_HORIZON_DAYS).toBe(360);
  });

  it("falls back to default when env value is zero or negative", async () => {
    vi.stubEnv("NEXT_PUBLIC_CASH_HORIZON_DAYS", "0");
    vi.resetModules();
    const mod = await import("../utils/dateInput");
    expect(mod.CASH_HORIZON_DAYS).toBe(329);
  });

  it("floors fractional env values", async () => {
    vi.stubEnv("NEXT_PUBLIC_AWARD_HORIZON_DAYS", "359.9");
    vi.resetModules();
    const mod = await import("../utils/dateInput");
    expect(mod.AWARD_HORIZON_DAYS).toBe(359);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("warns when env IS SET but invalid (helps catch misconfigured deploys)", async () => {
    vi.stubEnv("NEXT_PUBLIC_AWARD_HORIZON_DAYS", "not-a-number");
    vi.resetModules();
    await import("../utils/dateInput");
    expect(warnSpy).toHaveBeenCalledWith(
      `[dateInput] ignoring invalid NEXT_PUBLIC_AWARD_HORIZON_DAYS="not-a-number", falling back to 360`,
    );
  });

  it("stays silent when env is UNSET (the common case)", async () => {
    vi.resetModules();
    await import("../utils/dateInput");
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
