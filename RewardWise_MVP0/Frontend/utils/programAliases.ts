/** @format */

// Single source of truth for seats.aero Source → reward_programs.name mapping.
// Frontend mirror — must stay in sync with Backend/app/program_aliases.py
// Drift detection: RewardWise_MVP0/scripts/check_alias_parity.sh
//
// Maps seats.aero "Source" string → list of reward_programs.name values that
// can book that source (transferable-points programs that route here, plus the
// program's own direct-loyalty name where the user holds it natively).
export const PROGRAM_ALIASES: Record<string, string[]> = {
    // ── Airline programs ──────────────────────────────────────────────
    united:         ["United MileagePlus"],
    delta:          ["Delta SkyMiles"],
    american:       ["Citi ThankYou Points", "Chase Ultimate Rewards", "American AAdvantage"],
    alaska:         ["Alaska Mileage Plan"],
    jetblue:        [],
    aeroplan:       ["Chase Ultimate Rewards", "Amex Membership Rewards", "Capital One Miles", "Air Canada Aeroplan"],
    virginatlantic: ["Chase Ultimate Rewards", "Capital One Miles"],
    flyingblue:     ["Chase Ultimate Rewards", "Amex Membership Rewards", "Capital One Miles"],
    british:        ["Chase Ultimate Rewards", "Amex Membership Rewards", "Capital One Miles"],
    singapore:      ["Chase Ultimate Rewards", "Amex Membership Rewards"],
    cathay:         ["Chase Ultimate Rewards", "Amex Membership Rewards", "Cathay Asia Miles"],
    emirates:       ["Chase Ultimate Rewards", "Amex Membership Rewards"],
    turkish:        ["Chase Ultimate Rewards"],
    qantas:         ["Chase Ultimate Rewards", "Amex Membership Rewards", "Capital One Miles"],
    avianca:        ["Capital One Miles"],
    lifemiles:      ["Capital One Miles"],
    etihad:         ["Amex Membership Rewards"],
    qatar:          ["Amex Membership Rewards"],
    saudia:         [],
    smiles:         [],
    azul:           [],
    korean:         [],
    ana:            ["Amex Membership Rewards", "ANA Mileage Club"],
    air_france:     ["Chase Ultimate Rewards", "Amex Membership Rewards", "Capital One Miles"],
    // ── Hotel programs ────────────────────────────────────────────────
    hyatt:          ["World of Hyatt"],
    marriott:       ["Marriott Bonvoy"],
};
