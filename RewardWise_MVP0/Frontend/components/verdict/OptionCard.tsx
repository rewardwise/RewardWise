/** @format */
"use client";

import { ExternalLink } from "lucide-react";
import { getProgramHandoffInfo } from "@/utils/airlines";

export interface OptionCardProps {
	/** seats.aero program slug. Resolves the deep-link href + display name via
	 *  getProgramHandoffInfo — the SAME resolver the handoff grid uses (PR #178),
	 *  reused so deep-links never drift between surfaces. */
	program: string;
	/** Optional flight descriptor under the program (e.g. "nonstop · 5h35m"). */
	detail?: string;
	cashPrice: number | null;
	/** Award points for this option; null/0 => no award space. */
	points: number | null;
	taxes?: number | null;
	/**
	 * Matched-scope cents-per-point straight from the verdict's `metrics.cpp`
	 * (_matched_cpp on the backend). DISPLAY ONLY — the card formats this value
	 * (1 decimal) and NEVER recomputes cpp from cash/points. Formatting is a
	 * display choice; recomputing would drift from the engine and break the reuse
	 * mandate. The vitest guard locks that the engine value is shown, not a derived
	 * one. (When mounted in PR 3, match the verdict card's cpp precision.)
	 */
	cpp?: number | null;
	/** Highlight as the recommended option (emerald border + tag). */
	isBest?: boolean;
	/** Tag for the highlight, e.g. "BEST VALUE · PAY CASH" / "BEST FOR YOU · USE POINTS". */
	bestTag?: string;
}

// Local mirrors of MultiHandoffGrid's trivial formatters, kept here to avoid
// touching that component in this PR. A later PR can hoist both to a shared util.
function fmtMoney(amount: number): string {
	return `$${amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)}`;
}

function domainFromUrl(url: string): string {
	return url
		.replace(/^https?:\/\//, "")
		.replace(/^www\./, "")
		.replace(/\/.*$/, "");
}

export default function OptionCard({
	program,
	detail,
	cashPrice,
	points,
	taxes,
	cpp,
	isBest = false,
	bestTag,
}: OptionCardProps) {
	const { url, displayName } = getProgramHandoffInfo(program);
	const hasAward = points != null && points > 0;
	const hasHref = url !== "#";
	const linkDomain = hasHref ? domainFromUrl(url) : null;

	return (
		<div
			data-testid="option-card"
			data-best={isBest ? "true" : "false"}
			className={[
				"font-mtw bg-mtw-bg rounded-mtw-lg p-5 shadow-mtw-ambient",
				isBest ? "border-2 border-mtw-emerald" : "border border-mtw-border",
			].join(" ")}
		>
			{isBest && bestTag ? (
				<span
					data-testid="best-tag"
					className="bg-mtw-emerald text-mtw-on-emerald text-mtw-label mb-3 inline-block rounded-mtw-pill px-3 py-1 uppercase"
				>
					{bestTag}
				</span>
			) : null}

			<div className="min-w-0">
				<p className="text-mtw-title text-mtw-ink">{displayName}</p>
				{detail ? <p className="text-mtw-small text-mtw-muted">{detail}</p> : null}
			</div>

			{/* cash + points on one row */}
			<div className="mt-3 flex items-baseline gap-4">
				{cashPrice != null ? (
					<span data-testid="option-cash" className="text-mtw-headline text-mtw-ink">
						{fmtMoney(cashPrice)}
					</span>
				) : null}
				{hasAward ? (
					<span data-testid="option-points" className="text-mtw-body text-mtw-emerald">
						{points!.toLocaleString()} pts
						{taxes != null && taxes > 0 ? ` + ${fmtMoney(taxes)}` : ""}
					</span>
				) : (
					<span data-testid="no-award" className="text-mtw-small text-mtw-muted">
						No award space
					</span>
				)}
			</div>

			{/* cents-per-point — the engine's matched cpp, rendered verbatim */}
			{cpp != null ? (
				<p data-testid="option-cpp" className="text-mtw-small text-mtw-muted mt-1">
					≈{cpp.toFixed(1)}¢/pt
				</p>
			) : null}

			{hasHref ? (
				<a
					data-testid="option-href"
					href={url}
					target="_blank"
					rel="noopener noreferrer"
					aria-label={`Open ${linkDomain || displayName} (opens in new tab)`}
					className="bg-mtw-emerald text-mtw-on-emerald text-mtw-small hover:bg-mtw-emerald-hover mt-4 inline-flex items-center gap-2 rounded-mtw px-4 py-2 font-semibold"
				>
					Open {linkDomain || displayName}
					<ExternalLink className="h-4 w-4" aria-hidden="true" />
				</a>
			) : null}
		</div>
	);
}
