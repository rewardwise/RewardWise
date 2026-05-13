import { fmtMoney, parsePointsInput } from "../utils/format";

describe("fmtMoney", () => {
  it("returns em-dash for null", () => {
    expect(fmtMoney(null)).toBe("—");
  });

  it("returns em-dash for undefined", () => {
    expect(fmtMoney(undefined)).toBe("—");
  });

  it("returns em-dash for NaN", () => {
    expect(fmtMoney(NaN)).toBe("—");
  });

  it("formats zero", () => {
    expect(fmtMoney(0)).toBe("$0");
  });

  it("formats a four-digit positive integer with thousands separator", () => {
    expect(fmtMoney(1000)).toBe("$1,000");
  });

  it("formats a seven-digit positive integer with thousands separators", () => {
    expect(fmtMoney(1234567)).toBe("$1,234,567");
  });

  // BEHAVIOR LOCK: minus sign currently renders after the dollar sign ($-500 vs the
  // more conventional -$500). Valid en-US locale output, but a UX wart — flag if
  // this surface starts displaying negative balances to users.
  it("formats negative integer with sign after dollar (current behavior)", () => {
    expect(fmtMoney(-500)).toBe("$-500");
  });

  // BEHAVIOR LOCK: same minus-sign placement as above, with digits=2.
  it("formats negative decimal with sign after dollar (current behavior)", () => {
    expect(fmtMoney(-1234.56, 2)).toBe("$-1,234.56");
  });

  it("formats decimal with explicit two-digit precision", () => {
    expect(fmtMoney(1000.5, 2)).toBe("$1,000.50");
  });

  it("rounds (not truncates) when digits=0", () => {
    expect(fmtMoney(1000.999, 0)).toBe("$1,001");
  });

  it("rounds very small positive to zero at digits=0", () => {
    expect(fmtMoney(0.001, 0)).toBe("$0");
  });

  it("preserves very small positive at digits=4", () => {
    expect(fmtMoney(0.001, 4)).toBe("$0.0010");
  });
});

describe("parsePointsInput — edge cases", () => {
  it("returns NaN for pure decimal with no integer part", () => {
    // Cleaned input '.50' has decimalIdx=0, so substring(0,0)='' → NaN guard fires.
    expect(parsePointsInput(".50")).toBeNaN();
  });

  it("strips currency symbol and commas to recover the integer value", () => {
    expect(parsePointsInput("€20,000")).toBe(20000);
  });

  it("handles large comma-separated integers", () => {
    expect(parsePointsInput("10,000,000")).toBe(10000000);
  });

  it("strips internal whitespace and preserves leading minus", () => {
    expect(parsePointsInput("- 1000")).toBe(-1000);
  });

  it("returns NaN for trailing-minus input (Number coercion fails)", () => {
    expect(parsePointsInput("1000-")).toBeNaN();
  });

  it("truncates at first decimal for multi-decimal input", () => {
    // '20.00.50' → cleaned unchanged → substring before first '.' → '20'
    expect(parsePointsInput("20.00.50")).toBe(20);
  });

  it("returns NaN for double-negative input", () => {
    // '--1000' → cleaned unchanged → Number('--1000') is NaN
    expect(parsePointsInput("--1000")).toBeNaN();
  });

  it("truncates negative decimals toward zero", () => {
    // Math.trunc(-20) === -20; substring drops the '.99' before Number() runs.
    expect(parsePointsInput("-20.99")).toBe(-20);
  });
});
