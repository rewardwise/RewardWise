/** @format */
/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

// Stub child components so this test only exercises VerdictCard's own rendering.
vi.mock("@/components/verdict/VerdictTopRow", () => ({
  default: ({ recommendationHeadline }: { recommendationHeadline: string }) => (
    <div data-testid="verdict-top-row">
      <p>{recommendationHeadline}</p>
      <button data-testid="listen-btn">Listen</button>
      <button data-testid="helpful-btn">Helpful</button>
      <button data-testid="needs-work-btn">Needs work</button>
    </div>
  ),
}));

vi.mock("@/components/verdict/FlightSection", () => ({
  __esModule: true,
  default: () => <div data-testid="flight-section-stub">FLIGHT DETAILS</div>,
}));

vi.mock("@/components/verdict/AwardDetailsSection", () => ({
  __esModule: true,
  default: () => <div data-testid="award-details-stub" />,
}));

vi.mock("@/components/verdict/MultiHandoffGrid", () => ({
  __esModule: true,
  default: () => <div data-testid="multi-handoff-stub" />,
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

const EXPLANATION = "Award redemption is stronger than cash on this route right now.";
const REASONING_COPY =
  "The award option is stronger than the cash fare right now, so using points protects cash.";

const baseVerdict = {
  verdict: "Use points",
  recommendation: "use_points" as const,
  winner: {
    program: "United",
    points: 35000,
    taxes: 5.6,
    cpp: 1.8,
    direct: true,
  },
  pay_cash: false,
  confidence: "high" as const,
  confidence_reason: REASONING_COPY,
  explanation: EXPLANATION,
  booking_note: "Confirm taxes at booking.",
  booking_link: {
    seats_aero_link: null,
    airline_link: null,
    preferred: "none" as const,
  },
  metrics: {
    cash_price: 800,
    points_cost: 35000,
    taxes: 5.6,
    estimated_savings: 200,
  },
};

function renderCard(verdictOverrides: Partial<typeof baseVerdict> = {}) {
  act(() => {
    root.render(
      <VerdictCard
        verdict={{ ...baseVerdict, ...verdictOverrides }}
        cashPrice={800}
        origin="SFO"
        destination="NRT"
        departDate="2026-06-15"
        travelers={1}
      />
    );
  });
}

describe("VerdictCard — surface cleanup contract", () => {
  it("renders the reasoning block unconditionally (no toggle gate)", () => {
    renderCard();
    const block = container.querySelector('[data-testid="verdict-reasoning-block"]');
    expect(block, "verdict-reasoning-block must be present in the DOM").not.toBeNull();
    expect(container.textContent).toContain(EXPLANATION);
    expect(container.textContent).toContain("Cash fare");
    expect(container.textContent).toContain("Best award");
    expect(container.textContent).toContain("Value preserved");
  });

  it("does not render a reasoning toggle button", () => {
    renderCard();
    const buttons = Array.from(container.querySelectorAll("button"));
    const hideToggle = buttons.find((b) => b.textContent?.includes("Hide reasoning"));
    const showToggle = buttons.find((b) => b.textContent?.includes("See how Zoe decided"));
    expect(hideToggle, "no Hide reasoning toggle should exist").toBeUndefined();
    expect(showToggle, "no See how Zoe decided toggle should exist").toBeUndefined();
  });

  it("does not render the MISSING DATA card even when missing_sources is populated", () => {
    renderCard({ missing_sources: ["taxes", "operating_airline"] } as Partial<typeof baseVerdict>);
    expect(container.textContent).not.toContain("Missing data");
    expect(container.textContent).not.toContain("We could not fully verify");
  });

  it("does not render the HowToBookSection (component removed)", () => {
    renderCard();
    // The HowToBookSection rendered an "How to book" uppercase eyebrow header.
    expect(container.textContent).not.toContain("How to book");
    // And no stub should be present since the import was removed from VerdictCard.
    expect(container.querySelector('[data-testid="how-to-book-stub"]')).toBeNull();
  });
});
