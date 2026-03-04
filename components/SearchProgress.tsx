/** @format */

"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function SearchProgress({
	origin,
	destination,
	cabin,
	travelers,
	programs,
}: any) {
	const [visibleSteps, setVisibleSteps] = useState(0);

	const steps = [
		{
			icon: "🔍",
			text: `Checking award availability for ${origin} → ${destination}...`,
		},
		{
			icon: "🏦",
			text: `Scanning ${programs || "Chase UR, Amex MR"} transfer partners...`,
		},
		{ icon: "✈️", text: `Analyzing routing options via partner airlines...` },
		{ icon: "💰", text: `Comparing cash price vs points redemption value...` },
		{
			icon: "📊",
			text: `Calculating cpp across ${cabin || "economy"} class...`,
		},
		{
			icon: "💺",
			text: `Checking seat availability for ${travelers || 1} traveler${(travelers || 1) > 1 ? "s" : ""}...`,
		},
		{ icon: "🧠", text: `Running optimization engine...` },
		{ icon: "✅", text: `Generating your personalized verdict...` },
	];

	useEffect(() => {
		const timers = steps.map((_, i) =>
			setTimeout(() => setVisibleSteps(i + 1), 350 * (i + 1)),
		);

		return () => timers.forEach(clearTimeout);
	}, []);

	return (
		<div className="bg-gray-900/90 backdrop-blur rounded-xl p-6 shadow-2xl">
			<div className="flex items-center gap-3 mb-5">
				<Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
				<div>
					<p className="text-white font-semibold">Optimizing your wallet...</p>
					<p className="text-gray-400 text-xs">
						{origin} → {destination}
					</p>
				</div>
			</div>

			<div className="space-y-2">
				{steps.slice(0, visibleSteps).map((step, i) => {
					const isLast = i === visibleSteps - 1;
					const isDone = i < visibleSteps - 1;

					return (
						<div key={i} className="flex items-center gap-2.5">
							<span className="text-sm w-5 text-center">
								{isDone ? "✓" : step.icon}
							</span>

							<span
								className={`text-sm ${
									isDone ? "text-emerald-400" : "text-gray-300"
								}`}
							>
								{step.text}
							</span>

							{isLast && (
								<Loader2 className="w-3 h-3 text-emerald-400 animate-spin ml-auto" />
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
