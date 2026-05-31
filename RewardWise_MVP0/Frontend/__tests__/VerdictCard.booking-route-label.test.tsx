/** @format */
/** @vitest-environment jsdom */

// Pre-fix bug (live in prod 2026-05-30, BAY→SIN audit): the booking section
// route line rendered the raw query CSV "SFO,OAK,SJC → SIN" instead of the
// single IATA pair the verdict actually picked. Root cause: VerdictCard built
// `routeLabel` from raw `origin`/`destination` query params; the resolved
// fields `bestOutbound.origin_airport` (awards) and
// `bestCashFlight.legs[0].departure_iata` (cash) were never read.

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

// Stub the heavy children — keep MultiHandoffGrid real so we can inspect the
// rendered routeLabel.
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

const baseUsePoints = {
  verdict: "Use points",
  recommendation: "use_points" as const,
  winner: {
    program: "singapore",
    points: 95000,
    taxes: 120,
    cpp: 2.1,
    direct: false,
  },
  pay_cash: false,
  confidence: "medium" as const,
  explanation: "Award beats cash on this route.",
  booking_note: "",
  booking_link: {
    seats_aero_link: null,
    airline_link: null,
    preferred: "none" as const,
  },
  metrics: { cash_price: 2400, points_cost: 95000, taxes: 120 },
};

const basePayCash = {
  verdict: "Pay cash",
  recommendation: "pay_cash" as const,
  winner: null,
  pay_cash: true,
  confidence: "high" as const,
  explanation: "Cash fare is the right call.",
  booking_note: "",
  booking_link: {
    seats_aero_link: null,
    airline_link: "https://www.united.com",
    preferred: "airline" as const,
  },
};

describe("VerdictCard — booking-section routeLabel uses resolved IATA, not metro CSV", () => {
  it("use_points: BAY metro CSV resolves to bestOutbound.origin_airport (SFO → SIN, not 'SFO,OAK,SJC → SIN')", () => {
    act(() => {
      root.render(
        <VerdictCard
          verdict={baseUsePoints}
          cashPrice={2400}
          origin="SFO,OAK,SJC"
          destination="SIN"
          departDate="2026-06-05"
          winningDate="2026-06-05"
          travelers={1}
          isRoundtrip={false}
          awardOptions={[
            {
              program: "singapore",
              points: 95000,
              taxes: 120,
              cpp: 2.1,
              direct: false,
              origin_airport: "SFO",
              destination_airport: "SIN",
              date: "2026-06-05",
            },
          ]}
          userPrograms={["singapore"]}
        />,
      );
    });
    const text = container.textContent || "";
    // Falsifying assertion #1: the raw CSV string must NOT appear anywhere.
    expect(
      text,
      "BAY metro CSV leaked into booking section route line — should have resolved to SFO",
    ).not.toContain("SFO,OAK,SJC");
    // The resolved pair must appear.
    expect(text).toContain("SFO → SIN");
  });

  it("use_points: round-trip uses ⇄ between resolved IATAs", () => {
    act(() => {
      root.render(
        <VerdictCard
          verdict={baseUsePoints}
          cashPrice={2400}
          origin="SFO,OAK,SJC"
          destination="SIN"
          departDate="2026-06-05"
          returnDate="2026-06-19"
          winningDate="2026-06-05"
          winningReturnDate="2026-06-19"
          travelers={1}
          isRoundtrip={true}
          awardOptions={[
            {
              program: "singapore",
              points: 95000,
              taxes: 120,
              cpp: 2.1,
              direct: false,
              origin_airport: "SFO",
              destination_airport: "SIN",
              date: "2026-06-05",
            },
          ]}
          returnAwardOptions={[
            {
              program: "singapore",
              points: 95000,
              taxes: 120,
              cpp: 2.1,
              direct: false,
              origin_airport: "SIN",
              destination_airport: "SFO",
              date: "2026-06-19",
            },
          ]}
          userPrograms={["singapore"]}
        />,
      );
    });
    const text = container.textContent || "";
    expect(text).not.toContain("SFO,OAK,SJC");
    expect(text).toContain("SFO ⇄ SIN");
  });

  it("pay_cash: routeLabel uses bestCashFlight.legs[0].departure_iata, not raw CSV", () => {
    act(() => {
      root.render(
        <VerdictCard
          verdict={basePayCash}
          cashPrice={420}
          origin="SFO,OAK,SJC"
          destination="JFK,EWR,LGA"
          departDate="2026-06-05"
          travelers={1}
          isRoundtrip={false}
          awardOptions={[]}
          flights={[
            {
              price: 420,
              total_duration: 320,
              legs: [
                {
                  flight_number: "UA123",
                  airline: "United Airlines",
                  departure_iata: "SFO",
                  arrival_iata: "EWR",
                  departure_time: "2026-06-05T08:00:00",
                  arrival_time: "2026-06-05T16:20:00",
                  duration: 320,
                },
              ],
              booking_url: "https://www.united.com",
            },
          ]}
          userPrograms={["united"]}
        />,
      );
    });
    const text = container.textContent || "";
    // Falsifying assertion: neither raw CSV may appear.
    expect(text).not.toContain("SFO,OAK,SJC");
    expect(text).not.toContain("JFK,EWR,LGA");
    expect(text).toContain("SFO → EWR");
  });

  it("use_points: falls back to first CSV airport when bestOutbound.origin_airport is missing", () => {
    // Defensive: legacy backend payload without resolved airports.
    act(() => {
      root.render(
        <VerdictCard
          verdict={baseUsePoints}
          cashPrice={2400}
          origin="SFO,OAK,SJC"
          destination="SIN"
          departDate="2026-06-05"
          winningDate="2026-06-05"
          travelers={1}
          isRoundtrip={false}
          awardOptions={[
            {
              program: "singapore",
              points: 95000,
              taxes: 120,
              cpp: 2.1,
              direct: false,
              // No origin_airport / destination_airport.
              date: "2026-06-05",
            },
          ]}
          userPrograms={["singapore"]}
        />,
      );
    });
    const text = container.textContent || "";
    // Even without resolved fields, the CSV must not leak in full.
    expect(text).not.toContain("SFO,OAK,SJC");
    expect(text).toContain("SFO → SIN");
  });
});

describe("VerdictCard — booking section renders human program name and live deep-link", () => {
  it("singapore award: header reads 'Singapore KrisFlyer', CTA points at singaporeair.com", () => {
    act(() => {
      root.render(
        <VerdictCard
          verdict={baseUsePoints}
          cashPrice={2400}
          origin="SFO"
          destination="SIN"
          departDate="2026-06-05"
          winningDate="2026-06-05"
          travelers={1}
          isRoundtrip={false}
          awardOptions={[
            {
              program: "singapore",
              points: 95000,
              taxes: 120,
              cpp: 2.1,
              direct: false,
              origin_airport: "SFO",
              destination_airport: "SIN",
              date: "2026-06-05",
            },
          ]}
          userPrograms={["singapore"]}
        />,
      );
    });
    const text = container.textContent || "";
    // Falsifying assertion #1: the raw lowercase slug must NEVER appear on
    // its own. (The display name "Singapore KrisFlyer" contains "Singapore",
    // so we check the lowercase slug specifically.)
    expect(text).not.toMatch(/\bsingapore\b/);
    expect(text).toContain("Singapore KrisFlyer");
    // Falsifying assertion #2: there must be a navigable anchor, not a
    // dead "Book directly on …" span.
    const anchor =
      container.querySelector<HTMLAnchorElement>(
        'a[href*="singaporeair.com"]',
      );
    expect(
      anchor,
      "Bug D regression: 'Book directly on …' rendered as a dead span instead of an anchor",
    ).not.toBeNull();
    expect(anchor!.getAttribute("target")).toBe("_blank");
    expect(anchor!.getAttribute("rel")).toBe("noopener noreferrer");
  });
});
