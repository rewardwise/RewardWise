/** @format */
/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import FlightSection from "../components/verdict/FlightSection";
import {
  buildOutboundLeg,
  buildInboundLeg,
  type AwardOptionLike,
  type CashFlightLike,
} from "../utils/flightLegs";

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

function renderNode(node: React.ReactElement) {
  act(() => {
    root.render(node);
  });
}

// 3-viewport mandate: each scenario runs at 375px (iPhone SE / standard
// mobile), 430px (iPhone 15 Pro Max), and 1440px (desktop). jsdom has no
// real layout engine so the assertions check that the rendered DOM carries
// the responsive Tailwind classes that flip behavior at the md: breakpoint
// (768px) and below. Real layout is verified on the Vercel preview by Sabby.
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

const detailedReturnAward: AwardOptionLike = {
  program: "United",
  airlines: "United",
  origin_airport: "BAY",
  destination_airport: "SEA",
  date: "2026-06-09",
  trips: [
    {
      total_duration: 145,
      segments: [
        {
          flight_number: "UA1234",
          origin: "BAY",
          destination: "SEA",
          departs_at: "2026-06-09T15:00:00",
          arrives_at: "2026-06-09T17:25:00",
        },
      ],
    },
  ],
};

const summaryOnlyReturnAward: AwardOptionLike = {
  program: "Aeroplan",
  airlines: "Aeroplan",
  origin_airport: "BAY",
  destination_airport: "SEA",
  date: "2026-06-09",
  trips: [],
};

const detailedOutboundAward: AwardOptionLike = {
  program: "United",
  airlines: "United",
  origin_airport: "SEA",
  destination_airport: "BAY",
  date: "2026-05-22",
  trips: [
    {
      total_duration: 140,
      segments: [
        {
          flight_number: "UA9001",
          origin: "SEA",
          destination: "SFO",
          departs_at: "2026-05-22T09:00:00",
          arrives_at: "2026-05-22T11:20:00",
        },
      ],
    },
  ],
};

const cashFlightDetailedReturn: CashFlightLike = {
  total_duration: 140,
  legs: [
    {
      flight_number: "AS500",
      airline: "Alaska",
      departure_iata: "SEA",
      arrival_iata: "SFO",
      departure_time: "2026-05-22T08:00:00",
      arrival_time: "2026-05-22T10:20:00",
    },
  ],
  return_flight: {
    total_duration: 145,
    legs: [
      {
        flight_number: "AS501",
        airline: "Alaska",
        departure_iata: "SFO",
        arrival_iata: "SEA",
        departure_time: "2026-06-09T15:00:00",
        arrival_time: "2026-06-09T17:25:00",
      },
    ],
  },
};

const cashFlightNoReturn: CashFlightLike = {
  total_duration: 140,
  legs: [
    {
      flight_number: "AS500",
      airline: "Alaska",
      departure_iata: "SEA",
      arrival_iata: "SFO",
      departure_time: "2026-05-22T08:00:00",
      arrival_time: "2026-05-22T10:20:00",
    },
  ],
  return_flight: null,
};

describe("Verdict round-trip return flight rendering — 86ba2ze48", () => {
  VIEWPORTS.forEach(({ name, width }) => {
    describe(`viewport ${name}`, () => {
      beforeEach(() => setViewport(width));

      // Case 1: use_points round-trip, bestReturn.trips empty, top-level fields
      // present. Pre-fix this rendered outbound only. Post-fix Tier 3 fires.
      it("case 1: use_points renders inbound summary card when bestReturn trips is empty", () => {
        const inbound = buildInboundLeg({
          recommendation: "use_points",
          isRoundtrip: true,
          bestOutbound: detailedOutboundAward,
          bestReturn: summaryOnlyReturnAward,
          origin: "SEA",
          destination: "BAY",
          returnDate: "2026-06-04",
          winningReturnDate: "2026-06-09",
        });
        expect(inbound).not.toBeNull();
        expect(inbound!.label).toBe("Return");
        expect(inbound!.data_quality).toBe("summary");
        expect(inbound!.segments[0].carrier).toBe("Aeroplan");
        expect(inbound!.segments[0].origin).toBe("BAY");
        expect(inbound!.segments[0].destination).toBe("SEA");

        const outbound = buildOutboundLeg({
          recommendation: "use_points",
          bestOutbound: detailedOutboundAward,
          origin: "SEA",
          destination: "BAY",
          departDate: "2026-05-22",
          winningDate: "2026-05-22",
        });
        renderNode(
          <FlightSection
            recommendation="use_points"
            isRoundtrip={true}
            outbound={outbound}
            inbound={inbound}
          />
        );
        const returnCard = container.querySelector('[data-testid="flight-card-return"]');
        expect(returnCard).not.toBeNull();
        expect(returnCard!.textContent).toContain("Aeroplan");
      });

      // Case 2: use_points round-trip, both detailed. Existing Tier 1 path
      // must still win after the refactor.
      it("case 2: use_points renders detailed inbound when bestReturn.trips populated (regression guard)", () => {
        const inbound = buildInboundLeg({
          recommendation: "use_points",
          isRoundtrip: true,
          bestOutbound: detailedOutboundAward,
          bestReturn: detailedReturnAward,
          origin: "SEA",
          destination: "BAY",
          returnDate: "2026-06-04",
          winningReturnDate: "2026-06-09",
        });
        expect(inbound).not.toBeNull();
        expect(inbound!.data_quality).toBe("detailed");
        expect(inbound!.segments[0].flight_number).toBe("UA1234");
        expect(inbound!.total_duration).toBe(145);
      });

      // Case 3: use_points round-trip, bestReturn null entirely, but search
      // params populated. Tier 4 fires with placeholder carrier.
      it("case 3: use_points synthesizes Tier 4 inbound from search params when bestReturn is null", () => {
        const inbound = buildInboundLeg({
          recommendation: "use_points",
          isRoundtrip: true,
          bestOutbound: detailedOutboundAward,
          bestReturn: null,
          origin: "SEA",
          destination: "BAY",
          returnDate: "2026-06-04",
          winningReturnDate: "2026-06-09",
        });
        expect(inbound).not.toBeNull();
        expect(inbound!.data_quality).toBe("summary");
        expect(inbound!.segments[0].carrier).toBe("Return flight");
        // Search-param synthesis: destination -> origin swap for the return leg
        expect(inbound!.segments[0].origin).toBe("BAY");
        expect(inbound!.segments[0].destination).toBe("SEA");
        expect(inbound!.segments[0].departs_at).toBe("2026-06-09");
      });

      // Case 4: pay_cash round-trip, return_flight missing. Tier 4 fires.
      // This is the 86b9ymp3j sister bug closed by the same fix.
      it("case 4: pay_cash synthesizes Tier 4 inbound from search params when return_flight missing", () => {
        const inbound = buildInboundLeg({
          recommendation: "pay_cash",
          isRoundtrip: true,
          bestCashFlight: cashFlightNoReturn,
          origin: "SEA",
          destination: "BAY",
          returnDate: "2026-06-04",
          winningReturnDate: "2026-06-09",
        });
        expect(inbound).not.toBeNull();
        expect(inbound!.data_quality).toBe("summary");
        expect(inbound!.segments[0].carrier).toBe("Return flight");
        expect(inbound!.segments[0].origin).toBe("BAY");
        expect(inbound!.segments[0].destination).toBe("SEA");
      });

      // Case 5: pay_cash round-trip, return_flight populated. Tier 1 still
      // wins after the refactor (regression guard).
      it("case 5: pay_cash renders detailed inbound when return_flight populated (regression guard)", () => {
        const inbound = buildInboundLeg({
          recommendation: "pay_cash",
          isRoundtrip: true,
          bestCashFlight: cashFlightDetailedReturn,
          origin: "SEA",
          destination: "BAY",
          returnDate: "2026-06-09",
        });
        expect(inbound).not.toBeNull();
        expect(inbound!.data_quality).toBe("detailed");
        expect(inbound!.segments[0].flight_number).toBe("AS501");
        expect(inbound!.total_duration).toBe(145);
      });

      // Case 6: one-way. Inbound must remain null. The previous summary tiers
      // for outbound must still fire correctly.
      it("case 6: one-way leaves inbound null and renders outbound only (regression guard)", () => {
        const inbound = buildInboundLeg({
          recommendation: "use_points",
          isRoundtrip: false,
          bestOutbound: detailedOutboundAward,
          bestReturn: detailedReturnAward,
          origin: "SEA",
          destination: "BAY",
          returnDate: "2026-06-09",
        });
        expect(inbound).toBeNull();

        const outbound = buildOutboundLeg({
          recommendation: "use_points",
          bestOutbound: detailedOutboundAward,
          origin: "SEA",
          destination: "BAY",
          departDate: "2026-05-22",
          winningDate: "2026-05-22",
        });
        renderNode(
          <FlightSection
            recommendation="use_points"
            isRoundtrip={false}
            outbound={outbound}
            inbound={inbound}
          />
        );
        const returnCard = container.querySelector('[data-testid="flight-card-return"]');
        expect(returnCard).toBeNull();
        const outboundCard = container.querySelector('[data-testid="flight-card-outbound"]');
        expect(outboundCard).not.toBeNull();
      });

      // 3-viewport responsive guard: at this viewport, the rendered card
      // must carry the responsive classes that prevent horizontal scroll on
      // narrow mobiles and use the 2-col grid layout on desktop md+.
      it(`viewport guard at ${name}: responsive grid + card classes present`, () => {
        const outbound = buildOutboundLeg({
          recommendation: "use_points",
          bestOutbound: detailedOutboundAward,
          origin: "SEA",
          destination: "BAY",
          departDate: "2026-05-22",
        });
        const inbound = buildInboundLeg({
          recommendation: "use_points",
          isRoundtrip: true,
          bestOutbound: detailedOutboundAward,
          bestReturn: summaryOnlyReturnAward,
          origin: "SEA",
          destination: "BAY",
          returnDate: "2026-06-09",
        });
        renderNode(
          <FlightSection
            recommendation="use_points"
            isRoundtrip={true}
            outbound={outbound}
            inbound={inbound}
          />
        );
        const section = container.querySelector("section");
        expect(section).not.toBeNull();
        // Two-col grid kicks in at md: (>= 768px). Mobile collapses to single col.
        const grid = section!.querySelector(".grid");
        expect(grid).not.toBeNull();
        expect(grid!.className).toMatch(/md:grid-cols-2/);
        // No fixed-width class on the card that would overflow at 375px
        const cards = section!.querySelectorAll('[data-testid^="flight-card-"]');
        expect(cards.length).toBe(2);
        cards.forEach((card) => {
          expect(card.className).not.toMatch(/\bw-\[\d{3,}px\]/);
        });
      });
    });
  });
});
