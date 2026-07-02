/** @format */
import type { Verdict, Ownership } from "@/types/verdict";

/**
 * Deterministic Zoe narration for the verdict — NOT LLM output. The lead message
 * and chips are templates populated from the verdict + ownership fork, so Zoe's
 * narration can never drift from the verdict. The free-form Xpectrum chat lives
 * separately and never sees these strings, so it can't contradict them either.
 *
 * CONSISTENCY INVARIANT (asserted below + in vitest): `recommendation` here is
 * the EFFECTIVE fork recommendation, and when it's "pay_cash" the lead text
 * never tells the user to book on points. Period.
 */
export type NarrationRec = "use_points" | "pay_cash" | "wait";

export interface ZoeChip {
	id: "why" | "points_anyway" | "cheaper_dates" | "welcome_how" | "welcome_ask";
	label: string;
	/** Deterministic templated reply appended on click (no LLM). */
	reply: string;
}

/** Empty-state welcome for the docked Zoe pane (no verdict yet). */
export interface ZoeWelcome {
	lead: string;
	chips: ZoeChip[];
}

export interface ZoeNarration {
	recommendation: NarrationRec;
	forkReason: Ownership["fork_reason"] | null;
	lead: string;
	chips: ZoeChip[];
}

function rec(verdict: Verdict, ownership?: Ownership | null): NarrationRec {
	// Match what the OwnershipFork UI (PR 5) actually DISPLAYS: can_afford → use
	// points; any short state → pay cash. This is deliberately the displayed call,
	// NOT the backend `fork_recommendation` — for short_buy_worth_it the backend
	// says use_points but the fork UI shows pay-cash (PR 5 defers buying), so Zoe
	// must say pay cash too or it contradicts the panel the user is looking at.
	if (ownership && ownership.applicable) return ownership.can_afford ? "use_points" : "pay_cash";
	if (verdict.recommendation === "use_points" || verdict.recommendation === "pay_cash" || verdict.recommendation === "wait") {
		return verdict.recommendation;
	}
	return verdict.pay_cash ? "pay_cash" : "use_points";
}

const money = (n: number | null | undefined) =>
	n == null ? "—" : `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;
const pts = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString());
const cpp = (n: number | null | undefined) => (n == null ? "—" : `${n.toFixed(1)}¢/pt`);

export function zoeNarration(verdict: Verdict, ownership?: Ownership | null): ZoeNarration {
	const r = rec(verdict, ownership);
	const m = verdict.metrics ?? {};
	const o = ownership && ownership.applicable ? ownership : null;
	const program = o?.program_label || verdict.winner?.program || "the program";
	const cash = m.cash_price ?? null;
	const savings = m.estimated_savings ?? null;
	const redemptionCpp = m.cpp ?? null;

	let lead: string;
	if (r === "use_points") {
		lead =
			o && o.can_afford
				? `🎯 Use your points. ${program} at ${cpp(redemptionCpp)} beats ${money(cash)} cash — and you've got them: ${pts(o.points_needed)} from your ${pts(o.owned_balance)}.`
				: `🎯 Use your points. ${program} at ${cpp(redemptionCpp)} beats ${money(cash)} cash — that's the better deal here.`;
	} else if (r === "pay_cash") {
		lead =
			o && !o.can_afford
				? `🪙 Real talk — points win on value, but you're ${pts(o.shortfall)} short for ${program}. Pay the ${money(cash)} cash and keep your points for a trip where they go further.`
				: `💵 Pay cash — ${money(cash)}. The points option here is a weak ${cpp(redemptionCpp)} redemption; save them for a stronger trip.`;
	} else {
		lead = `🤔 The pricing came back thin here — try the search again, or check nearby dates.`;
	}

	const whyLabel = r === "pay_cash" ? "Why cash?" : r === "use_points" ? "Why points?" : "What now?";
	const whyReply =
		r === "use_points"
			? `${program} redeems at ${cpp(redemptionCpp)} — above the bar where points beat cash${savings != null ? `, saving about ${money(savings)}` : ""}.`
			: r === "pay_cash"
				? o && !o.can_afford
					? `You can reach ${pts(o.owned_balance)} but need ${pts(o.points_needed)} for ${program} — ${pts(o.shortfall)} short. Cash is the honest call; your points keep their value.`
					: `At ${cpp(redemptionCpp)} the redemption is below the line where points beat cash, so cash keeps more value in your pocket.`
				: `The live pricing was incomplete — re-running the search usually surfaces a real fare.`;

	const pointsAnywayReply =
		r === "use_points"
			? `Go for it — book ${program} for ${pts(o?.points_needed ?? verdict.winner?.points)} pts (~${cpp(redemptionCpp)}). 👍`
			: o && !o.can_afford
				? `You can't quite — you're ${pts(o.shortfall)} pts short for ${program}. You'd have to buy or earn the gap first, and buying usually isn't worth it.`
				: `You can, but it's a weak ${cpp(redemptionCpp)} redemption — you'd spend points to save only ${money(savings)} vs cash. Your call, but cash keeps more value.`;

	const chips: ZoeChip[] = [
		{ id: "why", label: whyLabel, reply: whyReply },
		{ id: "points_anyway", label: "Use my points anyway?", reply: pointsAnywayReply },
		{
			id: "cheaper_dates",
			label: "Cheaper dates?",
			reply: `Flexible dates (±7 days) often surface better award space and lower cash fares — toggle "Flexible" and search again.`,
		},
	];

	const narration: ZoeNarration = {
		recommendation: r,
		forkReason: o?.fork_reason ?? null,
		lead,
		chips,
	};
	assertNarrationConsistent(narration);
	return narration;
}

/**
 * Hard guarantee: when the recommendation is pay_cash, the lead must NEVER tell
 * the user to use/book points. Throws in dev/test if violated (caught by vitest
 * across every fork state). In prod it's a no-throw guard — the templates above
 * are structured so it can't trigger, this just makes the invariant explicit.
 */
export function assertNarrationConsistent(n: ZoeNarration): void {
	if (n.recommendation === "pay_cash") {
		// Catch both "points" and the "pts" abbreviation the templates can emit.
		const bad = /\b(use your points|book\b.*\bp(?:oin)?ts\b|use points)\b/i;
		if (bad.test(n.lead)) {
			const msg = `Zoe narration drift: pay_cash recommendation but lead says use/book points: "${n.lead}"`;
			if (process.env.NODE_ENV !== "production") throw new Error(msg);
		}
	}
}

/**
 * Deterministic empty-state welcome for the docked Zoe pane — NOT LLM output.
 * Shown before the user has an active verdict; once a verdict arrives, the
 * verdict narration replaces it (the welcome does not persist above the thread).
 */
export function zoeWelcome(): ZoeWelcome {
	const welcome: ZoeWelcome = {
		lead:
			"👋 Hey, I'm Zoe. Run a search above and I'll show you whether cash or points wins for that trip. You can also ask me about a specific program in your wallet.",
		chips: [
			{
				id: "welcome_how",
				label: "How does this work?",
				reply:
					"Tell me where and when you want to fly (or use the search above). I compare the cash fare against what your points would cost, then tell you which is the smarter play — and I won't tell you to burn points on a weak redemption.",
			},
			{
				id: "welcome_ask",
				label: "What can I ask?",
				reply:
					'Try things like "is it worth using my Amex points for this?" or "which of my programs is best for this route?" — I ground the answer in your wallet and the live prices.',
			},
		],
	};
	assertWelcomeConsistent(welcome);
	return welcome;
}

/**
 * Deterministic welcome for the GUEST (logged-out) verdict's floating Zoe FAB
 * (8c) — NOT LLM output. References the guest state and points to sign-in for
 * wallet-specific recs, without promising wallet features the guest doesn't have
 * or asserting a verdict. No em-dashes (product-copy rule).
 */
export function zoeWelcomeGuest(): ZoeWelcome {
	const welcome: ZoeWelcome = {
		lead:
			"👋 Hey, I'm Zoe. Run a search and I'll tell you whether cash or points wins for your trip. Sign in to unlock wallet-specific recs.",
		chips: [
			{
				id: "welcome_how",
				label: "How does this work?",
				reply:
					"Tell me where and when you're flying, or use the search above. I compare the cash fare against what points would cost and tell you which wins. No account needed.",
			},
			{
				id: "welcome_ask",
				label: "Why sign in?",
				reply:
					"Sign in and connect your wallet, and I'll tell you exactly which of your own programs get the best value on a trip. Personalized, not generic.",
			},
		],
	};
	assertWelcomeConsistent(welcome);
	return welcome;
}

/**
 * Hard guarantee: the welcome must stay in the "no verdict yet" state. It must
 * never assert a concrete verdict — a recommendation ("use your points" / "pay
 * cash"), a price, or a cpp. Throws in dev/test if it drifts.
 */
export function assertWelcomeConsistent(w: ZoeWelcome): void {
	const bad = /\b(use your points|pay cash|use points)\b|\$\d|¢\/pt/i;
	if (bad.test(w.lead)) {
		const msg = `Zoe welcome drift: welcome lead asserts a verdict: "${w.lead}"`;
		if (process.env.NODE_ENV !== "production") throw new Error(msg);
	}
}
