/** @format */
/** @vitest-environment jsdom */
//
// PR #2b integration test. Verifies the VerdictCard → MultiHandoffGrid
// wiring produces exactly one program card per leg, picked via
// selectTopProgram's wallet-fit-adjusted cpp.
//
// Bug 86ba2ze4e: round-trip Use Points verdicts previously rendered up to
// 5 cards (every wallet-matching program). Spec is one card per leg —
// outbound + return (when round-trip), 1 + 0 (when one-way).
//
// Children other than MultiHandoffGrid are stubbed so the assertions hit
// the actual grid component. The 3-viewport mandate is per the sprint
// rule: jsdom has no real layout engine so we lean on responsive Tailwind
// classes; live layout is verified on the Vercel preview by Sabby.

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// React 18+ requires this flag for act() to work without console nags.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  alertState: {
    watchlist: [] as unknown[],
    notifications: [] as unknown[],
    unreadCount: 0,
    loading: false,
    addToWatchlist: vi.fn(),
    removeFromWatchlist: vi.fn(async () => undefined),
    isWatching: vi.fn(() => false),
    markNotificationRead: vi.fn(),
    markAllRead: vi.fn(),
    clearNotification: vi.fn(),
  },
}));

vi.mock("@/context/AlertContext", () => ({
  useAlerts: () => mocks.alertState,
}));

vi.mock("@/components/verdict/VerdictTopRow", () => ({
  __esModule: true,
  default: () => <div data-testid="verdict-top-row-stub" />,
}));

vi.mock("@/components/verdict/FlightSection", () => ({
  __esModule: true,
  default: () => <div data-testid="flight-section-stub" />,
}));

vi.mock("@/components/verdict/AwardDetailsSection", () => ({
  __esModule: true,
  default: () => <div data-testid="award-details-stub" />,
}));

vi.mock("@/components/verdict/ErrorStateCard", () => ({
  __esModule: true,
  default: () => <div data-testid="error-state-stub" />,
}));

import VerdictCard from "../components/VerdictCard";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

const VIEWPORTS = [
  { name: "mobile-375px", width: 375 },
  { name: "mobile-430px", width: 430 },
  { name: "desktop-1440px", width: 1440 },
] as const;

function setViewport(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
  window.matchMedia = (query: string) => {
    const match = /\(min-width:\s*(\d+)px\)/.exec(query);
    const breakpoint = match ? parseInt(match[1], 10) : 0;
    return {
      matches: width >= breakpoint,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  };
}

const baseVerdict = {
  verdict: "Use points",
  recommendation: "use_points" as "use_points" | "pay_cash" | "wait",
  winner: { program: "united", points: 35000, taxes: 5.6, cpp: 1.8, direct: true },
  pay_cash: false,
  confidence: "high" as const,
  confidence_reason: "Award beats cash on this route.",
  explanation: "Award redemption is strong here.",
  booking_note: "",
  booking_link: { seats_aero_link: null, airline_link: null, preferred: "none" as const },
  metrics: { cash_price: 800, points_cost: 35000, taxes: 5.6, estimated_savings: 200 },
};

const unitedAward = {
  program: "united",
  points: 35000,
  taxes: 5.6,
  cpp: 1.8,
  direct: true,
  remaining_seats: 4,
};
const aeroplanAward = {
  program: "aeroplan",
  points: 30000,
  taxes: 22.4,
  cpp: 1.6,
  direct: true,
  remaining_seats: 2,
};
const deltaAward = {
  program: "delta",
  points: 40000,
  taxes: 5.6,
  cpp: 1.7,
  direct: true,
  remaining_seats: 3,
};

interface RenderOpts {
  awardOptions: typeof unitedAward[];
  returnAwardOptions: typeof unitedAward[];
  isRoundtrip: boolean;
  userPrograms?: string[];
  userCards?: string[];
}

function renderCard({
  awardOptions,
  returnAwardOptions,
  isRoundtrip,
  userPrograms = [],
  userCards = [],
}: RenderOpts) {
  act(() => {
    root.render(
      <VerdictCard
        verdict={baseVerdict}
        cashPrice={800}
        origin="SFO"
        destination="NRT"
        departDate="2026-06-15"
        returnDate={isRoundtrip ? "2026-06-22" : null}
        winningDate="2026-06-15"
        winningReturnDate={isRoundtrip ? "2026-06-22" : null}
        travelers={1}
        isRoundtrip={isRoundtrip}
        awardOptions={awardOptions}
        returnAwardOptions={returnAwardOptions}
        userPrograms={userPrograms}
        userCards={userCards}
      />
    );
  });
}

function handoffSections(): Element[] {
  return Array.from(container.querySelectorAll("section")).filter((s) => {
    const header = s.querySelector("p");
    return (header?.textContent || "").includes("Book ");
  });
}

describe("VerdictCard top-1 per leg (86ba2ze4e)", () => {
  VIEWPORTS.forEach(({ name, width }) => {
    describe(`viewport ${name}`, () => {
      beforeEach(() => setViewport(width));

      // Case 1: One-way Use Points. Single grid, no return leg, no
      // "Outbound"/"Return" labels.
      it("case 1: one-way renders exactly one handoff grid with the unlabeled header", () => {
        renderCard({
          awardOptions: [unitedAward],
          returnAwardOptions: [],
          isRoundtrip: false,
          userPrograms: ["united"],
        });
        const grids = handoffSections();
        expect(grids.length).toBe(1);
        const header = grids[0].querySelector("p")?.textContent || "";
        expect(header).toBe("Book through your program");
        expect(header).not.toMatch(/outbound|return/i);
      });

      // Case 2: Round-trip, same program both legs. Two grids, each labeled
      // with its leg and each showing the same program.
      it("case 2: round-trip same program both legs renders two grids labeled outbound + return", () => {
        renderCard({
          awardOptions: [unitedAward],
          returnAwardOptions: [unitedAward],
          isRoundtrip: true,
          userPrograms: ["united"],
        });
        const grids = handoffSections();
        expect(grids.length).toBe(2);
        const headers = grids.map((g) => g.querySelector("p")?.textContent || "");
        expect(headers[0].toLowerCase()).toContain("outbound");
        expect(headers[1].toLowerCase()).toContain("return");
        const united = container.textContent || "";
        expect(united.toLowerCase().split("united").length - 1).toBeGreaterThanOrEqual(2);
      });

      // Case 3: Round-trip, different best programs per leg. Two grids, each
      // selects the leg-local highest score.
      it("case 3: round-trip different programs per leg picks each leg independently", () => {
        // Outbound: united cpp 1.8 wins. Return: aeroplan only option.
        renderCard({
          awardOptions: [unitedAward, aeroplanAward],
          returnAwardOptions: [aeroplanAward],
          isRoundtrip: true,
          userCards: ["Chase Ultimate Rewards"],
        });
        const grids = handoffSections();
        expect(grids.length).toBe(2);
        const outboundText = grids[0].textContent?.toLowerCase() || "";
        const returnText = grids[1].textContent?.toLowerCase() || "";
        expect(outboundText).toContain("united");
        expect(returnText).toContain("aeroplan");
      });

      // Case 4: Empty wallet falls back to pure highest cpp.
      it("case 4: empty wallet picks the highest-cpp program (pure cpp tiebreak)", () => {
        // Highest cpp here is united 1.8 — no wallet, no penalty applied.
        renderCard({
          awardOptions: [aeroplanAward, unitedAward, deltaAward],
          returnAwardOptions: [],
          isRoundtrip: false,
          userPrograms: [],
          userCards: [],
        });
        const grids = handoffSections();
        expect(grids.length).toBe(1);
        expect(grids[0].textContent?.toLowerCase()).toContain("united");
      });

      // Case 5: Reachable via transfer only (no direct hold). selectTopProgram
      // honors card-based reachability through TRANSFER_PARTNERS.
      it("case 5: reachable via transfer-only beats unreachable higher-cpp", () => {
        // delta cpp 1.7 unreachable (no Amex MR in wallet).
        // united cpp 1.8 reachable via Chase UR.
        // Even without the wallet-fit penalty, united would still win on cpp,
        // so use an inverted setup: aeroplan 1.6 reachable vs delta 1.9 unreachable.
        const deltaHigh = { ...deltaAward, cpp: 1.9 };
        renderCard({
          awardOptions: [deltaHigh, aeroplanAward],
          returnAwardOptions: [],
          isRoundtrip: false,
          userCards: ["Chase Ultimate Rewards"],
        });
        const grids = handoffSections();
        expect(grids.length).toBe(1);
        // 1.6 * 1.0 = 1.60 vs 1.9 * 0.7 = 1.33 → aeroplan wins.
        expect(grids[0].textContent?.toLowerCase()).toContain("aeroplan");
      });

      // Case 6 / viewport guard: no horizontal-overflow class at 375px, and
      // the single-card grid does not switch to md:grid-cols-2 (it only does
      // so when items.length > 1, which can't happen post-PR-2b).
      it(`viewport guard at ${name}: no fixed-width overflow class on the handoff card`, () => {
        renderCard({
          awardOptions: [unitedAward],
          returnAwardOptions: [aeroplanAward],
          isRoundtrip: true,
          userCards: ["Chase Ultimate Rewards"],
        });
        const grids = handoffSections();
        expect(grids.length).toBe(2);
        grids.forEach((grid) => {
          const inner = grid.querySelector(".grid");
          expect(inner).not.toBeNull();
          // Top-1 always renders a single card, so the grid stays single-column
          // — md:grid-cols-2 must NOT be on either grid.
          expect(inner!.className).not.toMatch(/md:grid-cols-2/);
          // No fixed-pixel-width classes that would overflow at 375px.
          expect(grid.innerHTML).not.toMatch(/\bw-\[\d{3,}px\]/);
        });
      });
    });
  });
});
