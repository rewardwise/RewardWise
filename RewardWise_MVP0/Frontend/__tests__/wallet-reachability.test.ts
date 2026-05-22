/** @format */
import { describe, expect, it } from "vitest";

import { isReachable } from "../utils/walletReachability";
import type { TransferPartner } from "../utils/transferPartners";

const PARTNERS: Record<string, TransferPartner[]> = {
  united: [
    { sourceCard: "Chase Ultimate Rewards", short: "Chase UR", ratio: "1:1", speed: "instant" },
    { sourceCard: "Bilt Rewards", short: "Bilt", ratio: "1:1", speed: "instant" },
  ],
  aeroplan: [
    { sourceCard: "Chase Ultimate Rewards", short: "Chase UR", ratio: "1:1", speed: "instant" },
    { sourceCard: "Amex Membership Rewards", short: "Amex MR", ratio: "1:1", speed: "instant" },
  ],
  alaska: [],
};

describe("isReachable", () => {
  it("returns true when the user holds the program directly", () => {
    expect(isReachable("united", ["united"], [], PARTNERS)).toBe(true);
  });

  it("is case-insensitive on direct-hold matching", () => {
    expect(isReachable("United", ["UNITED"], [], PARTNERS)).toBe(true);
    expect(isReachable("UNITED", ["united"], [], PARTNERS)).toBe(true);
  });

  it("returns true when the user can transfer via a held card", () => {
    expect(
      isReachable("united", [], ["Chase Ultimate Rewards"], PARTNERS),
    ).toBe(true);
  });

  it("normalizes whitespace and case on transfer card matching", () => {
    expect(
      isReachable("united", [], ["  CHASE  ultimate   rewards  "], PARTNERS),
    ).toBe(true);
  });

  it("returns false when neither direct nor transfer path exists", () => {
    expect(isReachable("united", ["aeroplan"], ["Citi ThankYou Points"], PARTNERS)).toBe(false);
  });

  it("returns false for a slug with no transfer partners and no direct hold", () => {
    expect(isReachable("alaska", [], ["Chase Ultimate Rewards"], PARTNERS)).toBe(false);
  });

  it("returns false for an unknown program slug", () => {
    expect(isReachable("mystery_air", ["united"], ["Chase Ultimate Rewards"], PARTNERS)).toBe(false);
  });

  it("returns false when wallet is empty", () => {
    expect(isReachable("united", [], [], PARTNERS)).toBe(false);
  });
});
