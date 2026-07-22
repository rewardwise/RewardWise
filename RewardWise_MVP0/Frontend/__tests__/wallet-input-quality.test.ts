/**
 * Unit tests for wallet input quality helpers.
 *
 * Test infra note: as of this PR, Frontend/ has no jest/vitest configured
 * (npm scripts: dev, build, start, lint). These tests are written in
 * vitest/jest-compatible shape so they will execute once a runner is added.
 * Component tests (Save All UI behavior, row error rendering, etc.) are
 * intentionally skipped pending test-infra setup — see follow-up ticket.
 */

import {
  formatPointsForDisplay,
  parsePointsInput,
  validatePoints,
  MAX_POINTS_BALANCE,
} from "../utils/format";

describe("formatPointsForDisplay", () => {
  it("formats a positive integer with thousands separators", () => {
    expect(formatPointsForDisplay(20000)).toBe("20,000");
  });
  it("formats zero as '0'", () => {
    expect(formatPointsForDisplay(0)).toBe("0");
  });
  it("returns empty string for null", () => {
    expect(formatPointsForDisplay(null)).toBe("");
  });
  it("returns empty string for undefined", () => {
    expect(formatPointsForDisplay(undefined)).toBe("");
  });
  it("returns empty string for NaN", () => {
    expect(formatPointsForDisplay(NaN)).toBe("");
  });
  it("formats large values", () => {
    expect(formatPointsForDisplay(1234567)).toBe("1,234,567");
  });
});

describe("parsePointsInput", () => {
  it("parses comma-separated input", () => {
    expect(parsePointsInput("20,000")).toBe(20000);
  });
  it("strips dollar sign prefix", () => {
    expect(parsePointsInput("$20,000")).toBe(20000);
  });
  it("truncates decimal portion (20,000.00 → 20000, not 2000000)", () => {
    expect(parsePointsInput("20,000.00")).toBe(20000);
  });
  it("returns NaN for non-numeric strings", () => {
    expect(Number.isNaN(parsePointsInput("abc"))).toBe(true);
  });
  it("returns NaN for empty string", () => {
    expect(Number.isNaN(parsePointsInput(""))).toBe(true);
  });
  it("returns NaN for whitespace-only", () => {
    expect(Number.isNaN(parsePointsInput("   "))).toBe(true);
  });
  it("preserves negative sign", () => {
    expect(parsePointsInput("-1")).toBe(-1);
  });
  it("returns NaN for bare minus sign", () => {
    expect(Number.isNaN(parsePointsInput("-"))).toBe(true);
  });
  it("handles spaces around digits", () => {
    expect(parsePointsInput("  20000  ")).toBe(20000);
  });
});

describe("parsePointsInput — decimal handling", () => {
  it("truncates decimal portion on whole numbers", () => {
    expect(parsePointsInput("20,000.00")).toBe(20000);
    expect(parsePointsInput("20000.50")).toBe(20000);
    expect(parsePointsInput("$20,000.99")).toBe(20000);
    expect(parsePointsInput("100.999")).toBe(100);
  });
  it("handles partial decimal input gracefully", () => {
    expect(parsePointsInput("20000.")).toBe(20000);
    expect(Number.isNaN(parsePointsInput(".50"))).toBe(true);
    expect(Number.isNaN(parsePointsInput("."))).toBe(true);
  });
  it("still handles non-decimal cases correctly", () => {
    expect(parsePointsInput("20000")).toBe(20000);
    expect(parsePointsInput("20,000")).toBe(20000);
    expect(parsePointsInput("$20,000")).toBe(20000);
  });
});

describe("validatePoints", () => {
  it("rejects NaN", () => {
    expect(validatePoints(NaN).ok).toBe(false);
  });
  it("rejects negative numbers", () => {
    const r = validatePoints(-1);
    expect(r.ok).toBe(false);
    expect(r.reason).toBeTruthy();
  });
  it("allows zero", () => {
    expect(validatePoints(0).ok).toBe(true);
  });
  it("allows positive numbers", () => {
    expect(validatePoints(20000).ok).toBe(true);
  });
  it("returns a human-readable reason on failure", () => {
    expect(validatePoints(-5).reason).toBe("Cannot be negative");
    expect(validatePoints(NaN).reason).toBe("Please enter a number");
  });
  it("allows values below the cap (boundary is EXCLUSIVE)", () => {
    expect(validatePoints(250_000).ok).toBe(true);
    expect(validatePoints(MAX_POINTS_BALANCE - 1).ok).toBe(true);
  });
  it("rejects the cap itself and above (exactly-50M garbage was observed in prod)", () => {
    expect(validatePoints(MAX_POINTS_BALANCE).ok).toBe(false); // boundary bug fix
    expect(validatePoints(MAX_POINTS_BALANCE + 1).ok).toBe(false);
    expect(validatePoints(999_999_999).ok).toBe(false); // ~1B typo
    expect(validatePoints(1_902_000_000).ok).toBe(false); // the observed ~1.9B
    const r = validatePoints(999_999_999);
    expect(r.reason).toMatch(/too high/i);
    expect(r.reason).toMatch(/250000/); // guides toward correct entry
  });
});
