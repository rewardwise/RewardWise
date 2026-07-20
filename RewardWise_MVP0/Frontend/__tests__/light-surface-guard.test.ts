/** @format */
/**
 * Guard for the recurring missed-remap disease: every dark bg utility
 * (bg-gray/slate-800/900/950 incl. opacity variants) used anywhere in the
 * app must have a matching .mtw-light remap rule in globals.css, so wrapping
 * any surface in mtw-light fully lightens it. Also bans NEW inline dark hex
 * in components (allowlisted legacy files only).
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
const CSS = readFileSync(join(ROOT, "app/globals.css"), "utf8");

function walk(dir: string, out: string[] = []): string[] {
	for (const f of readdirSync(dir)) {
		const p = join(dir, f);
		if (f === "node_modules" || f.startsWith(".")) continue;
		if (statSync(p).isDirectory()) walk(p, out);
		else if (/\.(tsx|ts)$/.test(f) && !/\.test\./.test(f)) out.push(p);
	}
	return out;
}

const FILES = [...walk(join(ROOT, "app")), ...walk(join(ROOT, "components"))];
const DARK_BG = /\bbg-(?:gray|slate)-(?:800|900|950)(?:\/(?:\[[\d.]+\]|\d+))?/g;

function cssEscape(cls: string): string {
	return cls.replace(/\//g, "\\/").replace(/\[/g, "\\[").replace(/\]/g, "\\]").replace(/\./g, "\\.");
}

describe("light-surface guard", () => {
	it("every dark bg utility in the app has a .mtw-light remap", () => {
		const used = new Set<string>();
		for (const f of FILES) {
			const src = readFileSync(f, "utf8");
			for (const m of src.matchAll(DARK_BG)) used.add(m[0]);
		}
		const missing = [...used].filter((cls) => !CSS.includes(`.mtw-light .${cssEscape(cls)}`));
		expect(missing, `add .mtw-light remaps to globals.css for: ${missing.join(", ")}`).toEqual([]);
	});

	it("no new inline dark hex in components (legacy allowlist only)", () => {
		const ALLOW = new Set<string>([
			join(ROOT, "app/layout.tsx"), // themeColor meta (browser chrome), not a surface style
			join(ROOT, "components/CircleComingSoon.tsx"), // intentionally dark full-bleed teaser panel
		]);
		const offenders: string[] = [];
		for (const f of FILES) {
			if (ALLOW.has(f)) continue;
			const src = readFileSync(f, "utf8");
			if (/#(?:0f172a|1e293b|111827)\b/i.test(src)) offenders.push(f.replace(ROOT, ""));
		}
		expect(offenders, "inline dark hex on potential light surfaces").toEqual([]);
	});
});
