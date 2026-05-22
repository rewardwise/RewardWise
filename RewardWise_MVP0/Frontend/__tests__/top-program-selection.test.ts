/** @format */
import { describe, expect, it } from "vitest";

import {
  selectTopProgram,
  WALLET_FIT_MULTIPLIER,
} from "../utils/topProgramSelection";
import type { TransferPartner } from "../utils/transferPartners";

const PARTNERS: Record<string, TransferPartner[]> = {
  united: [
    { sourceCard: "Chase Ultimate Rewards", short: "Chase UR", ratio: "1:1", speed: "instant" },
  ],
  aeroplan: [
    { sourceCard: "Chase Ultimate Rewards", short: "Chase UR", ratio: "1:1", speed: "instant" },
    { sourceCard: "Amex Membership Rewards", short: "Amex MR", ratio: "1:1", speed: "instant" },
  ],
  delta: [
    { sourceCard: "Amex Membership Rewards", short: "Amex MR", ratio: "1:1", speed: "instant" },
  ],
};

describe("selectTopProgram", () => {
  it("returns null when there are no awards", () => {
    expect(selectTopProgram([], [], [], PARTNERS)).toBeNull();
  });

  it("returns null when every award has null/zero cpp", () => {
    const awards = [
      { program: "united", cpp: null },
      { program: "delta", cpp: 0 },
    ];
    expect(selectTopProgram(awards, ["united"], [], PARTNERS)).toBeNull();
  });

  it("picks the highest cpp when no wallet is provided (empty wallet)", () => {
    const awards = [
      { program: "aeroplan", cpp: 1.6 },
      { program: "delta", cpp: 1.7 },
      { program: "united", cpp: 1.5 },
    ];
    const top = selectTopProgram(awards, [], [], PARTNERS);
    expect(top?.program).toBe("delta");
  });

  it("prefers a reachable lower-cpp program over an unreachable higher-cpp program", () => {
    // Aeroplan 1.6 reachable via Chase UR; Delta 1.7 unreachable (Amex MR not in wallet).
    // 1.6 * 1.0 = 1.60 vs 1.7 * 0.7 = 1.19 → Aeroplan wins.
    const awards = [
      { program: "aeroplan", cpp: 1.6 },
      { program: "delta", cpp: 1.7 },
    ];
    const top = selectTopProgram(awards, [], ["Chase Ultimate Rewards"], PARTNERS);
    expect(top?.program).toBe("aeroplan");
  });

  it("picks the unreachable program when its cpp clears the multiplier threshold", () => {
    // Aeroplan 1.6 reachable, Delta 2.5 unreachable → Delta wins.
    // 1.6 * 1.0 = 1.60 vs 2.5 * 0.7 = 1.75 → Delta wins.
    const awards = [
      { program: "aeroplan", cpp: 1.6 },
      { program: "delta", cpp: 2.5 },
    ];
    const top = selectTopProgram(awards, [], ["Chase Ultimate Rewards"], PARTNERS);
    expect(top?.program).toBe("delta");
  });

  it("uses direct-hold reachability when wallet program slug is set", () => {
    const awards = [
      { program: "delta", cpp: 1.4 },
      { program: "aeroplan", cpp: 1.7 },
    ];
    // Direct-hold delta beats higher-cpp unreachable aeroplan.
    // 1.4 * 1.0 = 1.40 vs 1.7 * 0.7 = 1.19 → Delta wins.
    const top = selectTopProgram(awards, ["delta"], [], PARTNERS);
    expect(top?.program).toBe("delta");
  });

  it("tiebreak prefers the reachable program at equal score", () => {
    // Construct equal scores: reachable A 1.0 vs unreachable B (1.0 / 0.7) = 1.428...
    const awards = [
      { program: "delta", cpp: 1.0 / WALLET_FIT_MULTIPLIER },
      { program: "united", cpp: 1.0 },
    ];
    const top = selectTopProgram(awards, [], ["Chase Ultimate Rewards"], PARTNERS);
    // United is reachable via Chase UR. Delta is not. Scores equal → reachable wins.
    expect(top?.program).toBe("united");
  });

  it("tiebreak falls back to original index when reachability and score are equal", () => {
    const awards = [
      { program: "aeroplan", cpp: 1.5 },
      { program: "united", cpp: 1.5 },
    ];
    // Both reachable via Chase UR, equal cpp → first one wins.
    const top = selectTopProgram(awards, [], ["Chase Ultimate Rewards"], PARTNERS);
    expect(top?.program).toBe("aeroplan");
  });

  it("preserves pass-through fields on the selected award", () => {
    const awards = [
      { program: "delta", cpp: 1.7, points: 30000, taxes: 5.6 },
      { program: "aeroplan", cpp: 1.6, points: 35000, taxes: 22.4 },
    ];
    const top = selectTopProgram(awards, [], ["Chase Ultimate Rewards"], PARTNERS);
    expect(top?.program).toBe("aeroplan");
    expect(top?.points).toBe(35000);
    expect(top?.taxes).toBe(22.4);
  });

  it("WALLET_FIT_MULTIPLIER is exported and documents the tunable", () => {
    expect(WALLET_FIT_MULTIPLIER).toBeGreaterThan(0);
    expect(WALLET_FIT_MULTIPLIER).toBeLessThanOrEqual(1);
  });
});
