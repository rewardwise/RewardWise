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

const saudiaOption: AwardProgramOption = {
  program: "saudia",
  points: 30000,
  taxes: 50,
  cpp: 1.4,
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

  it("authed with native program (holds aeroplan): suppresses transfer line", () => {
    render(
      <AwardDetailsSection
        recommendation="use_points"
        operatingAirline="Air Canada"
        awardOptions={[aeroplanOption]}
        userPrograms={["aeroplan"]}
        travelers={1}
      />,
    );
    const text = container.textContent || "";
    expect(text).not.toContain("Transfer from");
  });

  it("authed without native (holds Chase UR only, verdict is aeroplan): shows Chase UR only", () => {
    render(
      <AwardDetailsSection
        recommendation="use_points"
        operatingAirline="Air Canada"
        awardOptions={[aeroplanOption]}
        userPrograms={["chase ultimate rewards"]}
        travelers={1}
      />,
    );
    const text = container.textContent || "";
    expect(text).toContain("Transfer from");
    expect(text).toContain("Chase UR");
    expect(text).not.toContain("Amex MR");
    expect(text).not.toContain("Cap1 Miles");
  });

  it("program with empty TRANSFER_PARTNERS entry (saudia): no transfer line", () => {
    render(
      <AwardDetailsSection
        recommendation="use_points"
        operatingAirline="Saudia"
        awardOptions={[saudiaOption]}
        userPrograms={[]}
        travelers={1}
      />,
    );
    const text = container.textContent || "";
    expect(text).not.toContain("Transfer from");
  });

  it("mobile viewport (375px): no horizontal scroll on transfer line", () => {
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
