/** @format */
// Source guard (same pattern as light-surface-guard): every delivered-verdict
// render root in VerdictCard must mount ConfettiBurst. Fails-pre state: #253
// mounted it only in the use_points root, so pay_cash verdicts (the live-
// verified case) never fired. "wait"/partial verdicts are deliberately
// excluded — a degraded non-answer is nothing to celebrate.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("ConfettiBurst branch coverage in VerdictCard", () => {
	const src = readFileSync(join(__dirname, "../components/VerdictCard.tsx"), "utf8");

	it("mounts in BOTH the pay_cash early-return and the main use_points root", () => {
		const mounts = src.match(/<ConfettiBurst fireKey=\{verdictId \?\? searchId \?\? null\} \/>/g) ?? [];
		expect(mounts.length, "one mount per delivered-verdict root").toBe(2);
		// The pay_cash root is the one that renders EmptyWalletCTA — confetti
		// must sit in that same return block.
		const payCashRoot = src.slice(src.indexOf("<EmptyWalletCTA />") - 400, src.indexOf("<EmptyWalletCTA />"));
		expect(payCashRoot, "pay_cash root mounts confetti").toContain("<ConfettiBurst");
	});

	it("confetti roots are position:relative so the burst anchors to the card", () => {
		for (const m of src.matchAll(/className="([^"]*)"[^>]*>\s*(?:\{\/\*[\s\S]*?\*\/\}\s*)?<ConfettiBurst/g) as Iterable<RegExpMatchArray>) {
			expect(m[1], `root class "${m[1]}" must be relative`).toContain("relative");
		}
	});
});
