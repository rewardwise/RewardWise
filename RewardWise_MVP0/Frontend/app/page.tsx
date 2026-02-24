/** @format */

"use client";

import { useState } from "react";
import { Plane, CheckCircle, ArrowRight, Sparkles } from "lucide-react";

export default function Page() {
	const [searchQuery, setSearchQuery] = useState("");
	const [showVerdict, setShowVerdict] = useState(true);

	return (
		<div className="min-h-screen bg-gradient-to-b from-orange-200 via-cyan-200 to-cyan-400 relative">
			<div
				className="absolute inset-0 bg-cover bg-center opacity-60"
				style={{
					backgroundImage: `url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80')`,
				}}
			/>

			<div className="relative z-10">
				<header className="flex justify-between items-center px-6 py-4">
					<div className="flex items-center gap-2 text-white">
						<Plane className="w-6 h-6" />
						<span className="font-bold text-lg">RewardWise</span>
					</div>
					<button className="text-emerald-400 hover:text-emerald-300 font-medium">
						Log In
					</button>
				</header>
			</div>
		</div>
	);
}
