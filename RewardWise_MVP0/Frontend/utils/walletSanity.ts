// Per-program plausibility ceilings for wallet point balances.
//
// Sourcing: rough 99th-percentile holdings synthesized from public award-chart
// writeups (Frequent Miler, OneMileataTime, ThePointsGuy) and Reddit
// r/awardtravel ceiling threads. Numbers are deliberately high; the goal is to
// catch typos like an extra zero (5,000,000 instead of 500,000), not to
// second-guess legitimate hoarders. Anything at or below these values passes
// without a prompt.
//
// Hilton Honors and IHG One Rewards are intentionally NOT in this map. Both
// programs routinely run promotions that push power-user balances into the
// 8-figure range (Hilton FHR Hawaii at ~$50K/night burns ~10M pts; IHG free
// nights at top-tier properties make 5M+ stockpiles common), so a ceiling
// here would generate false-positive prompts and train users to dismiss them.
// If a card from one of those programs is added later, it falls through to
// DEFAULT_SANITY_CEILING; revisit then.

export const SANITY_CEILINGS: Record<string, number> = {
  "Chase Ultimate Rewards": 2_000_000,
  "Amex Membership Rewards": 3_000_000,
  "Citi ThankYou Points": 1_500_000,
  "Capital One Miles": 2_000_000,
  "United MileagePlus": 2_000_000,
  "Delta SkyMiles": 1_500_000,
  "American AAdvantage": 1_500_000,
  "Air Canada Aeroplan": 1_500_000,
  "Alaska Mileage Plan": 1_000_000,
  "ANA Mileage Club": 1_000_000,
  "Cathay Asia Miles": 1_000_000,
  "Marriott Bonvoy": 5_000_000,
};

export const DEFAULT_SANITY_CEILING = 2_000_000;

export function getCeilingFor(program: string): number {
  return SANITY_CEILINGS[program] ?? DEFAULT_SANITY_CEILING;
}

export function isAbsurdBalance(program: string, value: number): boolean {
  if (Number.isNaN(value) || value <= 0) return false;
  return value > getCeilingFor(program);
}
