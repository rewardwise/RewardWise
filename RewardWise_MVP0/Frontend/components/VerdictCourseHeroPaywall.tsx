/** @format */
"use client";

import { useRouter } from "next/navigation";
import { Check, Lock } from "lucide-react";

type VerdictTeaser = {
	headline?: string;
	explanation?: string;
	verdict?: string;
	verdict_label?: string;
};

function formatDate(d: string) {
	const [y, m, day] = d.split("-").map(Number);
	if (!y || !m || !day) return d;
	return new Date(y, m - 1, day).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

const BLUR_PLACEHOLDER =
	"Program-by-program points value, taxes, and transfer options appear here. Confidence drivers and next steps are included in the full report.";

type VerdictCourseHeroPaywallProps = {
	verdict: VerdictTeaser;
	origin: string;
	destination: string;
	departDate: string;
	searchId?: string | null;
	/** Save full search result before navigating (e.g. return from Stripe). */
	onPersistPendingSearch?: () => void;
};

export default function VerdictCourseHeroPaywall({
	verdict,
	origin,
	destination,
	departDate,
	searchId = null,
	onPersistPendingSearch,
}: VerdictCourseHeroPaywallProps) {
	const router = useRouter();

	const headlineSrc = (verdict.headline || verdict.verdict_label || "").trim();
	const explanationSrc = (verdict.explanation || verdict.verdict || "").trim();

	const routeLine = `${origin} → ${destination} · ${formatDate(departDate)}`;
	const verdictParts = [headlineSrc, explanationSrc].filter(Boolean);
	/** Route/date row is sharp; verdict narrative stays blurred until pay. */
	const blurredVerdictText =
		verdictParts.length > 0
			? [...verdictParts, BLUR_PLACEHOLDER].join("\n\n")
			: `${BLUR_PLACEHOLDER}\n\n${BLUR_PLACEHOLDER}`;

	const goToPlans = () => {
		onPersistPendingSearch?.();
		const q = new URLSearchParams();
		q.set("from", "home");
		if (searchId) {
			q.set("search_id", searchId);
		}
		router.push(`/subscribe?${q.toString()}`);
	};

	return (
		<div className="rounded-2xl border border-white/10 bg-slate-900/95 overflow-hidden shadow-2xl max-w-3xl mx-auto">
			{/* Sharp route line + Preview chip; verdict body blurred */}
			<div className="relative px-5 sm:px-7 pt-6 sm:pt-7 pb-4">
				<div className="flex items-center justify-between gap-2 mb-3">
					<p className="text-xs font-medium text-emerald-400/95 uppercase tracking-wide min-w-0">
						{routeLine}
					</p>
					<span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-200">
						<Lock className="h-3 w-3" aria-hidden />
						Preview
					</span>
				</div>
				<div className="relative min-h-[140px] sm:min-h-[160px] rounded-xl border border-white/5 bg-slate-950/40 overflow-hidden">
					<div
						className="select-none pointer-events-none whitespace-pre-wrap p-4 sm:p-5 text-sm text-slate-200 leading-relaxed blur-[12px] sm:blur-[16px] opacity-[0.42]"
						aria-hidden
					>
						{blurredVerdictText}
					</div>
					<div
						className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/55 via-slate-950/75 to-slate-950"
						aria-hidden
					/>
				</div>
			</div>

			{/* CTA band - emerald to match flight search + subscribe pricing */}
			<div className="relative bg-emerald-600 px-4 sm:px-8 py-5 sm:py-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
				<span
					className="absolute left-2 top-2 h-6 w-10 rounded-full bg-white/10 rotate-[-8deg]"
					aria-hidden
				/>
				<span
					className="absolute right-3 bottom-2 h-5 w-8 rounded-full bg-emerald-300/25 rotate-[12deg]"
					aria-hidden
				/>
				<p className="relative text-lg sm:text-xl font-bold text-white">
					Want to see your full verdict?
				</p>
				<p className="relative mt-2 text-sm text-emerald-50 max-w-md mx-auto leading-snug">
					Previewing your trip summary - unlock for the full points vs cash breakdown,
					confidence score, and Zoe follow-ups for this route.
				</p>

				<button
					type="button"
					onClick={goToPlans}
					className="relative mt-4 inline-flex items-center justify-center rounded-lg bg-white px-8 py-2.5 text-sm font-semibold text-emerald-900 shadow-md transition hover:bg-emerald-50"
				>
					Get 24h pass - $0.99
				</button>
				<p className="relative mt-2 text-xs text-emerald-100/95">
					$0.99 one time - Verdict Search + Zoe for 24 hours
				</p>
			</div>

			{/* Feature bullets + footer copy */}
			<div className="px-5 sm:px-7 py-4 bg-slate-950/80 border-t border-white/5">
				<ul className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-x-6 sm:gap-y-2 justify-center text-xs text-slate-400">
					<li className="flex items-center gap-1.5 justify-center sm:justify-start">
						<Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" aria-hidden />
						Full points vs cash breakdown
					</li>
					<li className="flex items-center gap-1.5 justify-center sm:justify-start">
						<Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" aria-hidden />
						Confidence score
					</li>
					<li className="flex items-center gap-1.5 justify-center sm:justify-start">
						<Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" aria-hidden />
						Zoe follow-ups for this trip
					</li>
				</ul>
				<p className="mt-4 text-center text-[11px] sm:text-xs text-slate-500 leading-relaxed max-w-lg mx-auto">
					Use the button above to open{" "}
					<span className="text-slate-400">
						Your search is ready - pick 24-hour pass ($0.99), monthly ($3.99/mo),
						or Concierge.
					</span>
				</p>
			</div>
		</div>
	);
}
