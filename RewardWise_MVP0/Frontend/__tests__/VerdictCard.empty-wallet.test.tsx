/** @format */
/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Verdict } from "../types/verdict";

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
  router: { push: vi.fn() },
}));

vi.mock("@/context/AlertContext", () => ({
  useAlerts: () => mocks.alertState,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("@/components/verdict/VerdictTopRow", () => ({
  __esModule: true,
  default: () => <div data-testid="verdict-top-row" />,
}));

vi.mock("@/components/verdict/FlightSection", () => ({
  __esModule: true,
  default: () => <div data-testid="flight-section-stub" />,
}));

vi.mock("@/components/verdict/AwardDetailsSection", () => ({
  __esModule: true,
  default: () => <div data-testid="award-details-stub" />,
}));

vi.mock("@/components/verdict/MultiHandoffGrid", () => ({
  __esModule: true,
  default: () => <div data-testid="multi-handoff-stub" />,
}));

vi.mock("@/components/verdict/WalletFramingPreview", () => ({
  __esModule: true,
  default: () => <div data-testid="wallet-framing-stub" />,
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
  vi.clearAllMocks();
});

function buildVerdict(overrides: Partial<Verdict> = {}): Verdict {
  return {
    verdict: "Pay Cash",
    recommendation: "pay_cash",
    explanation: "Cash is the better option for this route.",
    winner: {
      program: "united",
      points: 60000,
      taxes: 50,
      cpp: 1.0,
      direct: true,
    },
    pay_cash: true,
    confidence: "high",
    booking_note: "",
    booking_link: {
      seats_aero_link: "https://seats.aero/search?route=SFO-NRT",
      airline_link: "",
      preferred: "seats_aero",
    },
    ...overrides,
  };
}

function renderCard(props: {
  userPrograms?: string[];
  userCards?: string[];
  publicPreview?: boolean;
  verdict?: Verdict;
}) {
  act(() => {
    root.render(
      <VerdictCard
        verdict={props.verdict ?? buildVerdict()}
        cashPrice={550}
        origin="SFO"
        destination="NRT"
        departDate="2026-09-15"
        travelers={1}
        userPrograms={props.userPrograms ?? []}
        userCards={props.userCards ?? []}
        publicPreview={props.publicPreview ?? false}
      />,
    );
  });
}

// PR-B (ticket 86b9tt6ez): logged-in users with an empty wallet used to
// get the full verdict card with broken/empty award sections. They now
// see a focused onboarding CTA on top of the cash flights.
describe("VerdictCard — empty-wallet onboarding branch", () => {
  it("logged-in + empty wallet → EmptyWalletCTA renders", () => {
    renderCard({ userPrograms: [], userCards: [] });
    expect(
      container.querySelector('[data-testid="empty-wallet-cta"]'),
      "empty-wallet CTA should mount",
    ).not.toBeNull();
    // The normal verdict header must not render in this branch.
    expect(
      container.querySelector('[data-testid="verdict-top-row"]'),
      "normal verdict header should not render",
    ).toBeNull();
  });

  it("cash flights still render alongside the empty-wallet CTA", () => {
    renderCard({ userPrograms: [], userCards: [] });
    expect(
      container.querySelector('[data-testid="empty-wallet-cta"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="flight-section-stub"]'),
      "flights should still render so user gets cash info",
    ).not.toBeNull();
  });

  it("logged-in + wallet has programs → empty-wallet branch is skipped", () => {
    renderCard({ userPrograms: ["united"], userCards: [] });
    expect(
      container.querySelector('[data-testid="empty-wallet-cta"]'),
      "empty-wallet CTA should NOT render when programs exist",
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="verdict-top-row"]'),
      "normal verdict should render",
    ).not.toBeNull();
  });

  it("logged-in + wallet has cards → empty-wallet branch is skipped", () => {
    renderCard({ userPrograms: [], userCards: ["chase-sapphire-reserve"] });
    expect(
      container.querySelector('[data-testid="empty-wallet-cta"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="verdict-top-row"]'),
    ).not.toBeNull();
  });

  it("public preview + empty wallet → empty-wallet branch does NOT fire", () => {
    renderCard({
      userPrograms: [],
      userCards: [],
      publicPreview: true,
    });
    expect(
      container.querySelector('[data-testid="empty-wallet-cta"]'),
      "preview path must keep marketing surface, not switch to onboarding",
    ).toBeNull();
  });
});
