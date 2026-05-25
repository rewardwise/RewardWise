import { describe, it, expect } from "vitest";
import { isValidISODate, clampISODate } from "../utils/dateInput";

describe("isValidISODate", () => {
  it("accepts empty string (clearing is allowed)", () => {
    expect(isValidISODate("")).toBe(true);
  });

  it("accepts a normal 4-digit year", () => {
    expect(isValidISODate("2026-06-15")).toBe(true);
  });

  it("rejects a 5-digit year (the bug-repro case)", () => {
    expect(isValidISODate("20269-06-15")).toBe(false);
  });

  it("rejects a 6-digit year (Chrome edge case)", () => {
    expect(isValidISODate("202690-06-15")).toBe(false);
  });

  it("rejects alphanumerics", () => {
    expect(isValidISODate("abcd-ef-gh")).toBe(false);
  });

  it("rejects an invalid month (13)", () => {
    expect(isValidISODate("2026-13-01")).toBe(false);
  });

  it("rejects a single-digit month", () => {
    expect(isValidISODate("2026-6-15")).toBe(false);
  });

  it("rejects a single-digit day", () => {
    expect(isValidISODate("2026-06-1")).toBe(false);
  });
});

describe("clampISODate", () => {
  it("rejects invalid input and returns current", () => {
    expect(clampISODate("20269-06-15", "2026-06-15")).toBe("2026-06-15");
  });

  it("accepts valid input and replaces current", () => {
    expect(clampISODate("2026-07-20", "2026-06-15")).toBe("2026-07-20");
  });
});
