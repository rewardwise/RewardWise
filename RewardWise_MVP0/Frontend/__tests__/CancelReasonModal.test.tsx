/** @format */
/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CancelReasonModal, {
  type CancelReasonPayload,
} from "@/components/billing/CancelReasonModal";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

function render(props: {
  open?: boolean;
  submitting?: boolean;
  onConfirm?: (payload: CancelReasonPayload) => void;
  onDismiss?: () => void;
}) {
  act(() => {
    root.render(
      <CancelReasonModal
        open={props.open ?? true}
        submitting={props.submitting ?? false}
        onConfirm={props.onConfirm ?? (() => {})}
        onDismiss={props.onDismiss ?? (() => {})}
      />,
    );
  });
}

function modal() {
  return container.querySelector('[data-testid="cancel-reason-modal"]');
}

function confirmButton() {
  return Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Confirm cancellation"),
  ) as HTMLButtonElement;
}

function radio(code: string) {
  return container.querySelector(
    `input[type="radio"][value="${code}"]`,
  ) as HTMLInputElement;
}

function clickRadio(code: string) {
  const input = radio(code);
  act(() => {
    input.click();
  });
}

describe("CancelReasonModal", () => {
  it("renders nothing when closed", () => {
    render({ open: false });
    expect(modal()).toBeNull();
  });

  it("disables the confirm button until a reason is selected", () => {
    render({});
    expect(confirmButton().disabled).toBe(true);
    clickRadio("too_expensive");
    expect(confirmButton().disabled).toBe(false);
  });

  it("calls onConfirm with the selected reason and null free_text", () => {
    const onConfirm = vi.fn();
    render({ onConfirm });
    clickRadio("not_using");
    act(() => {
      confirmButton().click();
    });
    expect(onConfirm).toHaveBeenCalledWith({
      reason_code: "not_using",
      free_text: null,
    });
  });

  it("requires non-empty free_text when 'other' is selected", () => {
    const onConfirm = vi.fn();
    render({ onConfirm });
    clickRadio("other");
    expect(confirmButton().disabled).toBe(true);

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    )!.set!;
    act(() => {
      nativeSetter.call(textarea, "  needed Hyatt support  ");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(confirmButton().disabled).toBe(false);
    act(() => {
      confirmButton().click();
    });
    expect(onConfirm).toHaveBeenCalledWith({
      reason_code: "other",
      free_text: "needed Hyatt support",
    });
  });

  it("dismisses on Escape when not submitting", () => {
    const onDismiss = vi.fn();
    render({ onDismiss });
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onDismiss).toHaveBeenCalled();
  });

  it("ignores Escape while submitting", () => {
    const onDismiss = vi.fn();
    render({ onDismiss, submitting: true });
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
