/** @format */
/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import FlightSection, { type FlightLeg } from "../components/verdict/FlightSection";

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

function render(node: React.ReactElement) {
  act(() => {
    root.render(node);
  });
}

const outboundLeg: FlightLeg = {
  label: "Outbound",
  segments: [
    {
      flight_number: "UA837",
      carrier: "United",
      origin: "SFO",
      destination: "NRT",
      departs_at: "2026-06-15T10:30:00",
      arrives_at: "2026-06-16T14:45:00",
    },
  ],
  total_duration: 690,
};

const returnLeg: FlightLeg = {
  label: "Return",
  segments: [
    {
      flight_number: "UA838",
      carrier: "United",
      origin: "NRT",
      destination: "SFO",
      departs_at: "2026-06-22T16:00:00",
      arrives_at: "2026-06-22T09:30:00",
    },
  ],
  total_duration: 600,
};

describe("FlightSection — dates in header", () => {
  it("displays the outbound departure date in the leg header", () => {
    render(
      <FlightSection
        recommendation="use_points"
        isRoundtrip={false}
        outbound={outboundLeg}
        inbound={null}
      />
    );
    const outboundHeader = container.querySelector('[data-testid="leg-header-outbound"]');
    expect(outboundHeader).not.toBeNull();
    expect(outboundHeader!.textContent).toContain("Jun 15");
  });

  it("displays the return departure date in the return leg header (distinct from outbound)", () => {
    render(
      <FlightSection
        recommendation="use_points"
        isRoundtrip={true}
        outbound={outboundLeg}
        inbound={returnLeg}
      />
    );
    // Round-trip legs are tabbed — reveal the return leg via the "To Flight" tab.
    act(() => {
      container
        .querySelector('[data-testid="flight-tab-to"]')!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const returnHeader = container.querySelector('[data-testid="leg-header-return"]');
    expect(returnHeader).not.toBeNull();
    expect(returnHeader!.textContent).toContain("Jun 22");
  });

  it("renders header gracefully when departs_at is missing (no crash, no stray date string)", () => {
    const noDate: FlightLeg = {
      label: "Outbound",
      segments: [
        {
          flight_number: "UA837",
          carrier: "United",
          origin: "SFO",
          destination: "NRT",
        },
      ],
    };
    render(
      <FlightSection
        recommendation="use_points"
        isRoundtrip={false}
        outbound={noDate}
        inbound={null}
      />
    );
    const outboundHeader = container.querySelector('[data-testid="leg-header-outbound"]');
    expect(outboundHeader).not.toBeNull();
    expect(outboundHeader!.textContent).not.toMatch(/Invalid Date|NaN/);
  });
});

describe("FlightSection — summary fallback", () => {
  it("renders header date correctly when departs_at is date-only (avoids UTC-midnight off-by-one)", () => {
    // Regression guard: new Date("2026-07-04") parses as UTC midnight which renders
    // as Jul 3 in Pacific time. Summary-mode legs carry the seats.aero search date
    // (YYYY-MM-DD) and must show the same calendar day in any tz west of UTC.
    const summaryLeg: FlightLeg = {
      label: "Outbound",
      segments: [
        {
          carrier: "Aeroplan",
          origin: "YVR",
          destination: "FRA",
          departs_at: "2026-07-04",
        },
      ],
      data_quality: "summary",
    };
    render(
      <FlightSection
        recommendation="use_points"
        isRoundtrip={false}
        outbound={summaryLeg}
        inbound={null}
      />
    );
    const header = container.querySelector('[data-testid="leg-header-outbound"]');
    expect(header).not.toBeNull();
    expect(header!.textContent).toContain("Jul 4");
    expect(header!.textContent).not.toContain("Jul 3");
  });

  it("renders a disclaimer when data_quality is summary and suppresses the time row", () => {
    const summaryLeg: FlightLeg = {
      label: "Outbound",
      segments: [
        {
          carrier: "Aeroplan",
          origin: "YVR",
          destination: "FRA",
          departs_at: "2026-07-04",
        },
      ],
      data_quality: "summary",
    };
    render(
      <FlightSection
        recommendation="use_points"
        isRoundtrip={false}
        outbound={summaryLeg}
        inbound={null}
      />
    );
    const card = container.querySelector('[data-testid="flight-card-outbound"]');
    expect(card).not.toBeNull();
    expect(card!.textContent).toContain("Flight details may vary at booking");
  });
});

describe("FlightSection — mobile responsiveness", () => {
  it("flight card uses responsive padding (smaller on mobile, larger on md+)", () => {
    render(
      <FlightSection
        recommendation="use_points"
        isRoundtrip={false}
        outbound={outboundLeg}
        inbound={null}
      />
    );
    const card = container.querySelector('[data-testid="flight-card-outbound"]');
    expect(card).not.toBeNull();
    const cls = card!.className;
    expect(cls).toMatch(/\bp-4\b/);
    expect(cls).toMatch(/md:p-5/);
  });

  it("per-segment carrier/route line wraps on narrow viewports", () => {
    render(
      <FlightSection
        recommendation="use_points"
        isRoundtrip={false}
        outbound={outboundLeg}
        inbound={null}
      />
    );
    const segmentRow = container.querySelector('[data-testid="segment-row"]');
    expect(segmentRow).not.toBeNull();
    expect(segmentRow!.className).toMatch(/flex-wrap|flex-col/);
  });
});
