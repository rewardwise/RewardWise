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

// Stub child components so this test only exercises the reasoning-toggle scope.
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

vi.mock("@/components/verdict/HowToBookSection", () => ({
  __esModule: true,
  default: () => <div data-testid="how-to-book-stub" />,
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

function renderCard() {
  act(() => {
    root.render(
      <VerdictCard
        verdict={baseVerdict}
        cashPrice={800}
        origin="SFO"
        destination="NRT"
        departDate="2026-06-15"
        travelers={1}
      />
    );
  });
}

function clickHideReasoning() {
  const buttons = Array.from(container.querySelectorAll("button"));
  const toggle = buttons.find((b) => b.textContent?.includes("Hide reasoning"));
  expect(toggle, "Hide reasoning toggle must be present when reasoning is open").toBeTruthy();
  act(() => {
    toggle!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("VerdictCard — hide reasoning scope", () => {
  it("collapses the description paragraph when reasoning is hidden", () => {
    renderCard();
    // Open state: description is rendered.
    expect(container.textContent).toContain(EXPLANATION);

    clickHideReasoning();

    // Collapsed state: description paragraph is gone with the rest of the reasoning block.
    expect(container.querySelector('[data-testid="verdict-reasoning-block"]')).toBeNull();
    expect(container.textContent).not.toContain(EXPLANATION);
  });

  it("collapses the metrics row when reasoning is hidden", () => {
    renderCard();
    expect(container.textContent).toContain("Cash fare");
    expect(container.textContent).toContain("Best award");
    expect(container.textContent).toContain("Value preserved");

    clickHideReasoning();

    expect(container.textContent).not.toContain("Cash fare");
    expect(container.textContent).not.toContain("Best award");
    expect(container.textContent).not.toContain("Value preserved");
  });

  it("collapses the live-cash reasoning blurb when reasoning is hidden", () => {
    renderCard();
    expect(container.textContent).toContain(REASONING_COPY);

    clickHideReasoning();

    expect(container.textContent).not.toContain(REASONING_COPY);
  });

  it("keeps the action buttons (Listen / Helpful / Needs work) visible in both states", () => {
    renderCard();
    expect(container.querySelector('[data-testid="listen-btn"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="helpful-btn"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="needs-work-btn"]')).not.toBeNull();

    clickHideReasoning();

    expect(container.querySelector('[data-testid="listen-btn"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="helpful-btn"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="needs-work-btn"]')).not.toBeNull();
  });

  it("keeps the flight details section visible in both states", () => {
    renderCard();
    expect(container.querySelector('[data-testid="flight-section-stub"]')).not.toBeNull();

    clickHideReasoning();

    expect(container.querySelector('[data-testid="flight-section-stub"]')).not.toBeNull();
  });
});
