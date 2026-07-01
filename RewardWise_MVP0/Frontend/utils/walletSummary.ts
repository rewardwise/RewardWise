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

/** "80k Amex" style label for one wallet card. */
export function walletPillLabel(card: Pick<WalletCard, "points_balance" | "program_name">): string {
	return `${Math.round((card.points_balance || 0) / 1000)}k ${shortProgramName(card.program_name)}`.trim();
}

/**
 * Collapse cards into per-PROGRAM chips (points pool across cards in the same
 * program — e.g. two Amex MR cards sum, not "80k Amex · 50k Amex"), sorted by
 * total balance descending. Returns `{ key, label }` where key is the program.
 */
export function walletChips(
	cards: Array<Pick<WalletCard, "points_balance" | "program_name">>,
	limit = 2,
): Array<{ key: string; label: string }> {
	const byProgram = new Map<string, number>();
	for (const c of cards) {
		const key = shortProgramName(c.program_name) || "Points";
		byProgram.set(key, (byProgram.get(key) ?? 0) + (c.points_balance || 0));
	}
	return [...byProgram.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit)
		.map(([key, total]) => ({ key, label: `${Math.round(total / 1000)}k ${key}`.trim() }));
}
