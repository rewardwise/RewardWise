/** @format */
/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import AwardDetailsSection, {
  type AwardProgramOption,
} from "../components/verdict/AwardDetailsSection";

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

const aeroplanOption: AwardProgramOption = {
  program: "aeroplan",
  points: 15000,
  taxes: 64,
  cpp: 1.8,
  remaining_seats: 4,
  direct: true,
};

const alaskaOption: AwardProgramOption = {
  program: "alaska",
  points: 25000,
  taxes: 12,
  cpp: 1.6,
  remaining_seats: 3,
  direct: true,
};

const unknownProgramOption: AwardProgramOption = {
  program: "etihad_guest_xyz_unknown_slug",
  points: 30000,
  taxes: 25,
  cpp: 1.3,
  remaining_seats: 2,
  direct: true,
};

describe("AwardDetailsSection transfer-path clarity", () => {
  it("guest with no wallet: shows top 3 transfer paths for aeroplan", () => {
    render(
      <AwardDetailsSection
        recommendation="use_points"
        operatingAirline="Air Canada"
        awardOptions={[aeroplanOption]}
        userPrograms={[]}
        travelers={1}
      />,
    );
    const text = container.textContent || "";
    expect(text).toContain("Transfer from");
    expect(text).toContain("Chase UR");
    expect(text).toContain("Amex MR");
    expect(text).toContain("Cap1 Miles");
    expect(text).not.toContain("Bilt"); // 4th in list, sliced to top 3
  });

  it("authed user (any userPrograms): wallet-agnostic, still shows top 3", () => {
    // user_programs is a list of seats.aero airline slugs (e.g. "aeroplan",
    // "united") — NOT flex-currency holdings. The transfer line is therefore
    // shown wallet-agnostically here; wallet-aware framing is a follow-up PR.
    render(
      <AwardDetailsSection
        recommendation="use_points"
        operatingAirline="Air Canada"
        awardOptions={[aeroplanOption]}
        userPrograms={["aeroplan", "united"]}
        travelers={1}
      />,
    );
    const text = container.textContent || "";
    expect(text).toContain("Transfer from");
    expect(text).toContain("Chase UR");
    expect(text).toContain("Amex MR");
    expect(text).toContain("Cap1 Miles");
  });

  it("program with empty TRANSFER_PARTNERS entry (alaska): shows no-transfers fallback", () => {
    render(
      <AwardDetailsSection
        recommendation="use_points"
        operatingAirline="Alaska Airlines"
        awardOptions={[alaskaOption]}
        userPrograms={[]}
        travelers={1}
      />,
    );
    const text = container.textContent || "";
    expect(text).not.toContain("Transfer from");
    expect(text).toContain("doesn’t accept point transfers");
    expect(text).toContain("earn miles by flying or buy them directly");
    expect(text).toContain("Alaska");
  });

  it("unknown program slug (not in TRANSFER_PARTNERS map): no transfer line, no fallback", () => {
    render(
      <AwardDetailsSection
        recommendation="use_points"
        operatingAirline="Etihad"
        awardOptions={[unknownProgramOption]}
        userPrograms={[]}
        travelers={1}
      />,
    );
    const text = container.textContent || "";
    expect(text).not.toContain("Transfer from");
    expect(text).not.toContain("doesn’t accept point transfers");
  });

  it("mobile viewport (375px): transfer line renders without nowrap or overflow scroll", () => {
    Object.defineProperty(window, "innerWidth", { value: 375, configurable: true });
    render(
      <AwardDetailsSection
        recommendation="use_points"
        operatingAirline="Air Canada"
        awardOptions={[aeroplanOption]}
        userPrograms={[]}
        travelers={1}
      />,
    );
    const transferP = Array.from(container.querySelectorAll("p")).find((p) =>
      (p.textContent || "").startsWith("Transfer from"),
    );
    expect(transferP).toBeTruthy();
    if (transferP) {
      const style = window.getComputedStyle(transferP);
      // jsdom doesn't compute layout, so we verify the paragraph relies on
      // browser-default wrapping (no white-space: nowrap, no overflow-x: scroll).
      expect(style.whiteSpace === "nowrap").toBe(false);
      expect(style.overflowX === "scroll").toBe(false);
    }
  });
});
