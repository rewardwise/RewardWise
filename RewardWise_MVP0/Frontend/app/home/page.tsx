/** @format */

"use client";
import React from "react";
import { useState, useEffect, useContext } from "react";
import { useRouter } from "next/navigation";

import TropicalBackground from "@/components/TropicalBackground";
// import TopNav from "@/components/TopNav";

import { useAuth } from "@/context/AuthContext";
import { useSearchFill } from "@/context/SearchFillContext";
import { useABTest } from "@/context/ABTestContext";

import { MapPin, Calendar, Plane, User, Search, Loader2 } from "lucide-react";

export default function HomePage() {
	const router = useRouter();
	// const { incrementSearch } = useAuth();
	const { searchFill } = useSearchFill();
	const abTests = useABTest();

	const [origin, setOrigin] = useState("");
	const [destination, setDestination] = useState("");
	const [departDate, setDepartDate] = useState("");
	const [returnDate, setReturnDate] = useState("");
	const [travelers, setTravelers] = useState("2");
	const [cabin, setCabin] = useState("economy");
	const [tripType, setTripType] = useState("roundtrip");
	const [searching, setSearching] = useState(false);

	useEffect(() => {
		if (!searchFill) return;

		if (searchFill.origin) setOrigin(searchFill.origin);
		if (searchFill.destination) setDestination(searchFill.destination);
	}, [searchFill]);

	const runSearch = () => {
		if (!origin || !destination) return;

		// incrementSearch();
		setSearching(true);

		setTimeout(() => {
			setSearching(false);
		}, 2500);
	};

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-cyan-950 relative">
			<TropicalBackground />

			<div className="relative z-10">
				{/* <TopNav activeTab="home" /> */}

				<main className="max-w-5xl mx-auto px-6 py-6">
					{/* HEADER */}
					<div className="mb-6">
						<h1 className="text-2xl font-bold text-white mb-1">
							Let's optimize your wallet.
						</h1>

						<p className="text-gray-400 text-sm">
							Search a route or ask Zoe — we'll find the best decision for your
							rewards.
						</p>
					</div>

					{/* TRIP TYPE */}
					<div className="flex gap-2 mb-3">
						{["roundtrip", "oneway"].map((type) => (
							<button
								key={type}
								onClick={() => setTripType(type)}
								className={`px-4 py-1.5 rounded-lg text-xs font-medium ${
									tripType === type
										? "bg-emerald-500 text-white"
										: "bg-gray-800 text-gray-400"
								}`}
							>
								{type === "roundtrip" ? "Round Trip" : "One Way"}
							</button>
						))}
					</div>

					{/* SEARCH GRID */}
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
						<Field icon={<MapPin />} label="FROM">
							<input
								value={origin}
								onChange={(e) => setOrigin(e.target.value)}
								placeholder="City or airport"
								className="input"
							/>
						</Field>

						<Field icon={<MapPin />} label="TO">
							<input
								value={destination}
								onChange={(e) => setDestination(e.target.value)}
								placeholder="City or airport"
								className="input"
							/>
						</Field>

						<Field icon={<Calendar />} label="DEPART">
							<input
								type="date"
								value={departDate}
								onChange={(e) => setDepartDate(e.target.value)}
								className="input"
							/>
						</Field>
					</div>

					{/* SEARCH BUTTON */}
					<button
						onClick={runSearch}
						disabled={searching}
						className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
					>
						{searching ? (
							<>
								<Loader2 className="w-5 h-5 animate-spin" />
								Searching...
							</>
						) : (
							<>
								<Search className="w-5 h-5" />
								Search Flights
							</>
						)}
					</button>
				</main>
			</div>
		</div>
	);
}

/* FIELD WRAPPER */

function Field({
	icon,
	label,
	children,
}: {
	icon: React.ReactNode;
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div>
			<label className="text-emerald-400 text-xs mb-1 flex items-center gap-1">
				{icon} {label}
			</label>

			{children}
		</div>
	);
}
