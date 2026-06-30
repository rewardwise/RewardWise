/** @format */
"use client";

import OptionCard from "@/components/verdict/OptionCard";

interface CuratedAward {
	program: string;
	points: number;
	taxes: number | null;
	direct?: boolean;
}

interface CuratedOptionsProps {
	recommendation: "use_points" | "pay_cash" | "wait";
	/** Already deduped/selected by VerdictCard — we only cap + present. */
	awardOptions: CuratedAward[];
	/** The deterministic winner program from the verdict (highlighted). */
	winnerProgram?: string | null;
	cashPrice: number | null;
	/**
	 * Matched-scope `metrics.cpp` from the verdict. Shown ONLY on the recommended
	 * card — we have a matched cpp for the winner, not for the alternatives, so we
	 * never fabricate/recompute one for the others.
	 */
	matchedCpp: number | null;
	savings: number | null;
}

const MAX_OPTIONS = 3;

function fmtMoney(n: number): string {
	return `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;
}

export default function CuratedOptions({
	recommendation,
	awardOptions,
	winnerProgram,
	cashPrice,
	matchedCpp,
	savings,
}: CuratedOptionsProps) {
	if (!awardOptions || awardOptions.length === 0) return null;

	// Reuse the deterministic winner: float it to the top, keep existing order
	// otherwise (VerdictCard already deduped + selected — we only cap + present).
	const winnerKey = (winnerProgram ?? "").toLowerCase();
	const ordered = [...awardOptions].sort((a, b) => {
		const aw = a.program.toLowerCase() === winnerKey ? 0 : 1;
		const bw = b.program.toLowerCase() === winnerKey ? 0 : 1;
		return aw - bw;
	});
	const top = ordered.slice(0, MAX_OPTIONS);

	// Exactly one highlighted, matching the recommendation: the winner if it's in
	// the top set, otherwise the first (best) card.
	const winnerIdx = top.findIndex((o) => o.program.toLowerCase() === winnerKey);
	const bestIndex = winnerIdx >= 0 ? winnerIdx : 0;
	const bestTag =
		recommendation === "pay_cash" ? "BEST VALUE · PAY CASH" : "BEST FOR YOU · USE POINTS";

	const headline =
		recommendation === "use_points"
			? savings != null && savings > 0
				? `Use points — save ${fmtMoney(savings)}`
				: "Use points — the smarter way to pay"
			: recommendation === "pay_cash"
				? cashPrice != null
					? `Pay cash — ${fmtMoney(cashPrice)} beats burning points`
					: "Pay cash — keep your points"
				: "Compare your options";

	return (
		<section data-testid="curated-options" className="font-mtw mt-5">
			<p data-testid="curated-eyebrow" className="text-mtw-label text-mtw-muted uppercase">
				Best of {awardOptions.length} option{awardOptions.length !== 1 ? "s" : ""}
			</p>
			<h2 data-testid="curated-headline" className="text-mtw-headline text-mtw-ink mt-1">
				{headline}
			</h2>
			<div className="mt-4 flex flex-col gap-3">
				{top.map((o, i) => (
					<OptionCard
						key={o.program}
						program={o.program}
						detail={o.direct ? "nonstop" : undefined}
						cashPrice={cashPrice}
						points={o.points}
						taxes={o.taxes}
						cpp={i === bestIndex ? matchedCpp : null}
						isBest={i === bestIndex}
						bestTag={i === bestIndex ? bestTag : undefined}
					/>
				))}
			</div>
		</section>
	);
}
