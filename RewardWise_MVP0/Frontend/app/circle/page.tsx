/** @format */

"use client";

import TropicalBackground from "@/components/TropicalBackground";
import CircleComingSoon from "@/components/CircleComingSoon";

export default function CirclePage() {
	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-cyan-950 relative">
			<TropicalBackground />

			<div className="relative z-10">
				<main className="max-w-3xl mx-auto px-6 py-8">
					<CircleComingSoon />
				</main>
			</div>
		</div>
	);
}
