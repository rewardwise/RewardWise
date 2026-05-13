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
  it("strips decimals (digit-only filter)", () => {
    // Spec note: "20,000.00" should parse to 2000000 because the regex
    // strips all non-digit characters including the decimal point.
    expect(parsePointsInput("20,000.00")).toBe(2000000);
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
});
