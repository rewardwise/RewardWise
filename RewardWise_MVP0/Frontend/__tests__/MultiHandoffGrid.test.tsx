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
