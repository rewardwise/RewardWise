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

// Ticket 86ba262xj: when a partner program needs a transfer from a flex
// currency (e.g. Aeroplan ← Chase UR / Amex MR / Cap1 Miles), the booking
// card must make Step 1 — Transfer the primary action, not bury it.
function renderUsePoints(program: string, taxes: number | null = 80) {
  act(() => {
    root.render(
      <MultiHandoffGrid
        recommendation="use_points"
        programs={[{ program, points: 35000, taxes }]}
        bestDate="Jun 3"
        routeLabel="YYC → DEL"
        travelersLabel="1 traveler"
      />
    );
  });
}

describe("MultiHandoffGrid — use_points transfer-step clarity (Bug 86ba262xj)", () => {
  it("partner program (aeroplan): renders Step 1 — Transfer above the booking action", () => {
    renderUsePoints("aeroplan", 80);
    const step = container.querySelector('[data-testid="transfer-step"]');
    expect(step, "transfer-step block must render for partner programs").not.toBeNull();
    const text = step?.textContent || "";
    expect(text).toContain("Transfer to Aeroplan");
    expect(text).toContain("Chase UR");
    expect(text).toContain("Amex MR");
    expect(text).toContain("Cap1 Miles");
    expect(text).toContain("1:1");
  });

  it("partner program: Step 2 header references the booking domain (aircanada.com)", () => {
    renderUsePoints("aeroplan", 80);
    expect(container.textContent).toContain("Book on aircanada.com");
  });

  it("partner program: booking CTA label is rewritten to make the transfer prerequisite explicit", () => {
    renderUsePoints("aeroplan", 80);
    const cta = Array.from(container.querySelectorAll<HTMLAnchorElement>("a")).find(
      (a) => (a.getAttribute("href") || "").includes("aircanada.com"),
    );
    expect(cta, "booking anchor must point at aircanada.com").toBeTruthy();
    expect(cta?.textContent || "").toContain("Transfer, then open aircanada.com");
  });

  it("direct-only program (alaska — empty TRANSFER_PARTNERS): no transfer step, keeps original CTA", () => {
    renderUsePoints("alaska", 12);
    expect(container.querySelector('[data-testid="transfer-step"]'))
      .toBeNull();
    // The transfer-step block must not leak through.
    expect(container.textContent).not.toContain("Transfer to Alaska");
    // The CTA reverts to the original "Open <domain>" wording, no transfer chain.
    const cta = Array.from(container.querySelectorAll<HTMLAnchorElement>("a")).find(
      (a) => (a.getAttribute("href") || "").includes("alaskaair.com"),
    );
    expect(cta?.textContent || "").toContain("Open alaskaair.com");
    expect(cta?.textContent || "").not.toContain("Transfer, then open");
  });

  it("unknown slug (not in TRANSFER_PARTNERS): no transfer step, defensive fallback to single-step layout", () => {
    renderUsePoints("etihad_unknown_slug", 25);
    expect(container.querySelector('[data-testid="transfer-step"]'))
      .toBeNull();
    expect(container.textContent).not.toContain("Transfer to");
  });

  it("partner program: 'skip if miles already in {program}' hedge is visible", () => {
    renderUsePoints("aeroplan", 80);
    // We can't distinguish a user who holds Aeroplan miles directly from one
    // who needs to transfer (backend data limitation). The hedge keeps the
    // step honest for the direct-holder case.
    expect(container.textContent).toContain(
      "Skip this step if your miles are already in Aeroplan",
    );
  });
});
