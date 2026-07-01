/** @format */
import type { WalletCard } from "@/context/WalletContext";

/**
 * Short display label for a rewards program (e.g. "Amex Membership Rewards" →
 * "Amex"). Shared by the /home header and the global nav wallet pill so both
 * render balances identically.
 */
export function shortProgramName(name?: string): string {
	const n = (name || "").trim();
	if (!n) return "";
	const map: Record<string, string> = {
		"Amex Membership Rewards": "Amex",
		"Chase Ultimate Rewards": "Chase",
		"Capital One Miles": "Cap1",
		"Citi ThankYou Points": "Citi",
		"Bilt Rewards": "Bilt",
		"Wells Fargo Rewards": "Wells Fargo",
	};
	return map[n] ?? n.split(" ")[0];
}

/**
 * Compact human balance for a raw points count, scaled by magnitude:
 * 300,000 → "300k", 1,902,000 → "1.9M", 1,902,000,000 → "1.9B".
 *
 * Single source of truth for the "k" suffix — the old per-chip label appended
 * "k" after only ever dividing by 1000, so a 1.9-billion balance rendered
 * "1902000k". Here the divisor tracks the magnitude, so there's no double-suffix.
 */
export function formatBalance(points?: number | null): string {
	const n = Math.max(0, Math.round(points || 0));
	const scale = (value: number, suffix: string) =>
		`${value >= 100 ? Math.round(value) : parseFloat(value.toFixed(1))}${suffix}`;
	if (n >= 1_000_000_000) return scale(n / 1_000_000_000, "B");
	if (n >= 1_000_000) return scale(n / 1_000_000, "M");
	if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
	return `${n}`;
}

/** "1.9M Amex" style label for one wallet card. */
export function walletPillLabel(card: Pick<WalletCard, "points_balance" | "program_name">): string {
	return `${formatBalance(card.points_balance)} ${shortProgramName(card.program_name)}`.trim();
}

/**
 * Collapse cards into per-PROGRAM chips (points pool across cards in the same
 * program — e.g. two Amex MR cards sum, not "80k Amex · 50k Amex"), sorted by
 * total balance descending. Returns `{ key, label }` where key is the program.
 */
export function walletChips(
	cards: Array<Pick<WalletCard, "points_balance" | "program_name">>,
	limit = 1,
): Array<{ key: string; label: string }> {
	const byProgram = new Map<string, number>();
	for (const c of cards) {
		const key = shortProgramName(c.program_name) || "Points";
		byProgram.set(key, (byProgram.get(key) ?? 0) + (c.points_balance || 0));
	}
	return [...byProgram.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit)
		.map(([key, total]) => ({ key, label: `${formatBalance(total)} ${key}`.trim() }));
}
