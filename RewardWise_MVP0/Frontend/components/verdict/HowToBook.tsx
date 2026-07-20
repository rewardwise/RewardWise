/** @format */
"use client";

import { ArrowRight } from "lucide-react";
import { getProgramHandoffInfo } from "@/utils/airlines";
import { TRANSFER_PARTNERS } from "@/utils/transferPartners";
import { fmtMoney } from "@/utils/format";

export interface HowToBookLeg {
	legLabel: "Outbound" | "Return";
	program: string;
	points: number;
	taxes: number | null;
	date: string;
}

type Props = {
	legs: HowToBookLeg[];
	verifyNote?: string | null;
};

/**
 * Single "How to book" block for use_points verdicts (verdict card v3).
 *
 * Replaces the old per-leg MultiHandoffGrid pair, which (a) duplicated the
 * transfer instructions verbatim in both cards and (b) overlapped: each card's
 * content was wider than its md:grid-cols-2 column (grid children default
 * min-width:auto, so the cards could not shrink and bled across columns and
 * out of the container).
 *
 * Structure: one transfer note per UNIQUE program, then one line per leg with
 * its deep link (both deep links stay). Light-native styling — no dependence
 * on the .mtw-light remap.
 */
export default function HowToBook({ legs, verifyNote = null }: Props) {
	const valid = legs.filter((l) => l.program && l.points > 0);
	if (valid.length === 0) return null;

	// One transfer note per unique program, in first-appearance order.
	const uniquePrograms = Array.from(new Set(valid.map((l) => l.program.toLowerCase().trim())));

	return (
		<section data-testid="how-to-book" className="mt-4">
			<p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
				How to book
			</p>
			<div className="flex flex-col gap-2.5 rounded-2xl border border-emerald-300 bg-emerald-50/60 p-3">
				{uniquePrograms.map((key) => {
					const { displayName } = getProgramHandoffInfo(key);
					const partners = (TRANSFER_PARTNERS[key] ?? []).slice(0, 3);
					if (partners.length === 0) return null;
					return (
						<div
							key={`transfer-${key}`}
							data-testid="transfer-note"
							className="rounded-xl border border-amber-300 bg-amber-50 p-2.5"
						>
							<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800">
								Transfer to {displayName}
							</p>
							<p className="mt-1 text-xs leading-5 text-gray-700">
								From{" "}
								{partners.map((p, i) => (
									<span key={p.short}>
										<span className="font-semibold text-gray-900">{p.short}</span>{" "}
										<span className="text-gray-500">({p.ratio})</span>
										{i < partners.length - 1 ? ", " : ""}
									</span>
								))}
								. Skip this step if your miles are already in {displayName}.
							</p>
						</div>
					);
				})}

				{valid.map((leg) => {
					const { url, displayName } = getProgramHandoffInfo(leg.program);
					const hasHref = url !== "#";
					const cost = `${leg.points.toLocaleString()} pts${
						leg.taxes != null && leg.taxes > 0 ? ` + ${fmtMoney(leg.taxes, 2)}` : ""
					}`;
					const row = (
						<div className="flex flex-wrap items-center justify-between gap-2">
							<p className="min-w-0 text-sm text-gray-800">
								<span className="font-semibold text-gray-900">{leg.legLabel}</span>
								{" · "}
								{displayName} · {cost}
								{leg.date ? <span className="text-gray-500"> · {leg.date}</span> : null}
							</p>
							{hasHref ? (
								<span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">
									Book {leg.legLabel.toLowerCase()} <ArrowRight className="h-3.5 w-3.5" />
								</span>
							) : null}
						</div>
					);
					return hasHref ? (
						<a
							key={leg.legLabel}
							href={url}
							target="_blank"
							rel="noopener noreferrer"
							data-testid={`book-${leg.legLabel.toLowerCase()}`}
							className="block rounded-xl border border-gray-200 bg-white p-3 transition-colors hover:border-emerald-400"
						>
							{row}
						</a>
					) : (
						<div key={leg.legLabel} className="rounded-xl border border-gray-200 bg-white p-3">
							{row}
						</div>
					);
				})}
			</div>
			{verifyNote ? (
				<p className="mt-2 text-xs text-gray-500">{verifyNote}</p>
			) : null}
		</section>
	);
}
