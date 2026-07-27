/** @format */
/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import MultiHandoffGrid from "../components/verdict/MultiHandoffGrid";

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

function renderPayCash(bookingUrl: string | null = "https://www.united.com/en/us/") {
  act(() => {
    root.render(
      <MultiHandoffGrid
        recommendation="pay_cash"
        cashAirline={{
          airline: "United",
          cashPrice: 412,
          bookingUrl,
        }}
        bestDate="Jun 15"
        routeLabel="SFO → NRT"
        travelersLabel="1 traveler"
      />
    );
  });
}

describe("MultiHandoffGrid — pay_cash airline card", () => {
  it("renders the card as a clickable anchor that opens in a new tab", () => {
    renderPayCash("https://www.united.com/en/us/");
    const anchor = container.querySelector<HTMLAnchorElement>('a[href*="united.com"]');
    expect(anchor, "airline card must be wrapped in an anchor tag").not.toBeNull();
    expect(anchor!.getAttribute("target")).toBe("_blank");
    expect(anchor!.getAttribute("rel")).toBe("noopener noreferrer");
    expect(anchor!.getAttribute("aria-label")).toMatch(/opens in new tab/i);
    // The card body (linkDomain + cash fare + route line) must be inside the anchor.
    expect(anchor!.textContent).toContain("Visit united.com");
    expect(anchor!.textContent).toContain("Cash fare around $412");
  });

  it("does not render a 'Book direct with the airline' header label", () => {
    renderPayCash("https://www.united.com/en/us/");
    expect(container.textContent).not.toContain("Book direct with the airline");
    expect(container.textContent).not.toContain("BOOK DIRECT WITH THE AIRLINE");
  });
});

// Ticket 86ba25kaa: when bookingUrl is missing, fall back to a real
// homepage URL via KNOWN_AIRLINE_DOMAINS override (for US carriers
// whose canonical domain isn't {slug}.com) or slug synthesis (for
// the rest). Hide the card entirely when neither resolves.
function renderPayCashWithAirline(airline: string, bookingUrl: string | null = null) {
  act(() => {
    root.render(
      <MultiHandoffGrid
        recommendation="pay_cash"
        cashAirline={{
          airline,
          cashPrice: 2503,
          bookingUrl,
        }}
        bestDate="Jun 15"
        routeLabel="ADL → YYZ"
        travelersLabel="1 traveler"
      />
    );
  });
}

describe("MultiHandoffGrid — cash link order (homepage ELIMINATED, 2026-07-27)", () => {
  function renderCash(airline: string, bookingUrl: string | null, googleFlightsUrl: string | null, returnDateLabel: string | null = null) {
    act(() => {
      root.render(
        <MultiHandoffGrid
          recommendation="pay_cash"
          cashAirline={{ airline, cashPrice: 1005, bookingUrl, googleFlightsUrl }}
          bestDate="2027-03-15"
          returnDateLabel={returnDateLabel}
          routeLabel="SEA ⇄ NRT"
          travelersLabel="1 traveler, economy"
        />
      );
    });
  }

  it("canonical google_flights_url is primary when bookingUrl is null (the live case)", () => {
    renderCash("China Airlines", null, "https://www.google.com/travel/flights?tfs=ENCODED", "2027-03-30");
    const anchor = container.querySelector<HTMLAnchorElement>("a")!;
    expect(anchor.getAttribute("href")).toBe("https://www.google.com/travel/flights?tfs=ENCODED");
    expect(anchor.textContent).toContain("See this fare on Google Flights");
    // NEVER the carrier homepage — chinaairlines.com must not appear anywhere.
    expect(anchor.getAttribute("href")).not.toContain("chinaairlines");
    expect(container.textContent).not.toContain("chinaairlines.com");
  });

  it("a real per-itinerary bookingUrl still wins over the canonical link", () => {
    renderCash("United", "https://www.united.com/deep/link?itin=abc", "https://www.google.com/travel/flights?tfs=X");
    const anchor = container.querySelector<HTMLAnchorElement>("a")!;
    expect(anchor.getAttribute("href")).toBe("https://www.united.com/deep/link?itin=abc");
    expect(anchor.textContent).toContain("Visit united.com");
  });

  it("absent canonical URL -> labeled best-effort ?q= link with BOTH dates, never a homepage", () => {
    renderCash("China Airlines", null, null, "2027-03-30");
    const anchor = container.querySelector<HTMLAnchorElement>("a")!;
    const href = anchor.getAttribute("href")!;
    expect(href.startsWith("https://www.google.com/travel/flights?q=")).toBe(true);
    expect(decodeURIComponent(href)).toContain("2027-03-15");
    expect(decodeURIComponent(href)).toContain("2027-03-30");
    expect(href).not.toContain("chinaairlines");
    expect(anchor.textContent).toContain("Search this route on Google Flights");
  });

  it("sub-label shows BOTH dates on round trips", () => {
    renderCash("China Airlines", null, "https://www.google.com/travel/flights?tfs=Y", "2027-03-30");
    expect(container.textContent).toContain("2027-03-15 – 2027-03-30");
  });

  it("one-way keeps the single date", () => {
    renderCash("Alaska", null, "https://www.google.com/travel/flights?tfs=Z", null);
    expect(container.textContent).toContain("2027-03-15");
    expect(container.textContent).not.toContain("–");
  });

  it("anchor preserves target=_blank and rel=noopener noreferrer", () => {
    renderCash("China Airlines", null, "https://www.google.com/travel/flights?tfs=W");
    const anchor = container.querySelector<HTMLAnchorElement>("a")!;
    expect(anchor.getAttribute("target")).toBe("_blank");
    expect(anchor.getAttribute("rel")).toBe("noopener noreferrer");
  });
});
