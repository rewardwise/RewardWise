/** @format */
/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ConfettiBurst from "../components/verdict/ConfettiBurst";

let container: HTMLDivElement;
let root: Root;
const setMotion = (reduced: boolean) => {
	window.matchMedia = vi.fn().mockReturnValue({ matches: reduced }) as any;
};

beforeEach(() => {
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
});
afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

describe("ConfettiBurst — once per verdict, motion-respecting", () => {
	it("fires on a fresh key and self-removes after the animation window", async () => {
		vi.useFakeTimers();
		setMotion(false);
		act(() => root.render(<ConfettiBurst fireKey="v-fresh-1" />));
		expect(container.querySelector('[data-testid="confetti-burst"]')).not.toBeNull();
		expect(container.querySelectorAll(".mtw-confetti").length).toBe(24);
		act(() => { vi.advanceTimersByTime(1700); });
		expect(container.querySelector('[data-testid="confetti-burst"]'), "cleans up").toBeNull();
		vi.useRealTimers();
	});

	it("does NOT refire for a key that already fired (re-render / re-mount)", () => {
		setMotion(false);
		act(() => root.render(<ConfettiBurst fireKey="v-once-2" />));
		act(() => root.unmount());
		root = createRoot(container);
		act(() => root.render(<ConfettiBurst fireKey="v-once-2" />));
		expect(container.querySelector('[data-testid="confetti-burst"]'), "no replay").toBeNull();
	});

	it("renders nothing under prefers-reduced-motion", () => {
		setMotion(true);
		act(() => root.render(<ConfettiBurst fireKey="v-reduced-3" />));
		expect(container.querySelector('[data-testid="confetti-burst"]')).toBeNull();
	});

	it("null key never fires", () => {
		setMotion(false);
		act(() => root.render(<ConfettiBurst fireKey={null} />));
		expect(container.querySelector('[data-testid="confetti-burst"]')).toBeNull();
	});
});
