/** @format */
// Wallet-reachability helper for verdict top-1 program selection.
//
// A seats.aero program slug is "reachable" if the user can book it from their
// wallet — either by holding the program natively (direct), or by transferring
// points from a card they hold (transfer). The transfer check matches against
// TRANSFER_PARTNERS[slug][i].sourceCard which is a brand string like
// "Chase Ultimate Rewards", so the comparison normalizes both sides.

import type { TransferPartner } from "@/utils/transferPartners";

const normalize = (s: string): string =>
  s.toLowerCase().trim().replace(/\s+/g, " ");

export function isReachable(
  programSlug: string,
  walletPrograms: string[],
  walletCards: string[],
  transferPartners: Record<string, TransferPartner[]>,
): boolean {
  const slug = programSlug.toLowerCase();

  // Direct hold: wallet program slug list includes this slug.
  if (walletPrograms.map((p) => p.toLowerCase()).includes(slug)) {
    return true;
  }

  // Transfer path: any partner's sourceCard matches a card brand the user holds.
  const normalizedWalletCards = walletCards.map(normalize);
  const partners = transferPartners[slug] ?? [];
  return partners.some((p) =>
    normalizedWalletCards.includes(normalize(p.sourceCard)),
  );
}
