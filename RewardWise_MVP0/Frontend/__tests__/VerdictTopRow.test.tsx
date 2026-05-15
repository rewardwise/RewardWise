/** @format */
/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
    from: () => ({ insert: async () => ({ error: null }) }),
  }),
}));

import VerdictTopRow from "../components/verdict/VerdictTopRow";

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

describe("VerdictTopRow — Partial data pill removed", () => {
  it("does not render a Partial data pill alongside the confidence badge", () => {
    act(() => {
      root.render(
        <VerdictTopRow
          recommendationHeadline="Use points"
          confidence="medium"
          speaking={false}
          onListenToggle={() => undefined}
          verdictId={null}
          publicPreview={true}
        />
      );
    });

    // Medium confidence badge stays (different dimension).
    expect(container.textContent).toContain("medium confidence");
    // Partial data pill must not appear.
    expect(container.textContent).not.toContain("Partial data");
  });
});
