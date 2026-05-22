/** @format */
// Top-1 program selection for verdict handoff cards.
//
// Bug fix for 86ba2ze4e: round-trip Use Points verdicts were showing every
// in-wallet program (Sabby's screenshot showed 5 cards for a single leg).
// Spec is one program per leg, chosen by wallet-fit-adjusted cpp.

import type { TransferPartner } from "@/utils/transferPartners";
import { TRANSFER_PARTNERS } from "@/utils/transferPartners";
import { isReachable } from "@/utils/walletReachability";

export interface AwardOptionInput {
  program: string;
  cpp?: number | null;
}

// Soft penalty for unreachable programs. TUNABLE.
//
// Calibration: with cpp 1.6 reachable vs cpp 1.7 unreachable, multiplier 0.7
// gives 1.60 vs 1.19 — reachable wins. Equivalent: any multiplier <= 0.94
// keeps reachable Aeroplan 1.6 ahead of unreachable Delta 1.7. For an
// unreachable program to override a reachable one, its cpp must exceed
// (reachable cpp / multiplier) — at 0.7 that's a ~43% cpp gap.
//
// If smoke / A-B testing shows users complaining about a too-strong wallet
// bias, lower the multiplier toward 0.9. If unreachable programs are winning
// too often, raise it toward 0.5.
export const WALLET_FIT_MULTIPLIER = 0.7;

export function selectTopProgram<T extends AwardOptionInput>(
  awards: T[],
  walletPrograms: string[],
  walletCards: string[],
  transferPartners: Record<string, TransferPartner[]> = TRANSFER_PARTNERS,
): T | null {
  const scored = awards
    .map((award, idx) => ({ award, idx }))
    .filter(({ award }) => award.cpp != null && (award.cpp as number) > 0)
    .map(({ award, idx }) => {
      const reachable = isReachable(
        award.program,
        walletPrograms,
        walletCards,
        transferPartners,
      );
      const score = (award.cpp as number) * (reachable ? 1 : WALLET_FIT_MULTIPLIER);
      return { award, score, reachable, idx };
    });

  if (scored.length === 0) return null;

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.reachable !== b.reachable) return a.reachable ? -1 : 1;
    return a.idx - b.idx;
  });

  return scored[0].award;
}
