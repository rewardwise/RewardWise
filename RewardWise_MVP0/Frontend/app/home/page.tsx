/** @format */

"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import TropicalBackground from "@/components/TropicalBackground";

import { useAuth } from "@/context/AuthProvider";
import { useSearchFill } from "@/context/SearchFillContext";
import { useABTest } from "@/context/ABTestContext";

import { MapPin, Calendar, Plane, User, Search, Loader2 } from "lucide-react";

export default function HomePage() {
	const router = useRouter();

	const { searchCount, setSearchCount } = useAuth();
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

	const [searchError, setSearchError] = useState("");
	const [verdict, setVerdict] = useState(null);
	/* Autofill from Zoe */
	useEffect(() => {
		if (!searchFill) return;

		if (searchFill.origin) setOrigin(searchFill.origin);
		if (searchFill.destination) setDestination(searchFill.destination);
		if (searchFill.cabin) setCabin(searchFill.cabin);
		if (searchFill.travelers) setTravelers(searchFill.travelers);
	}, [searchFill]);

	const runSearch = () => {
		if (!origin || !destination) return;

		setSearchCount(searchCount + 1);
		setSearching(true);

		setTimeout(() => {
			setSearching(false);
		}, 2500);
	};

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-cyan-950 relative">
			<TropicalBackground />

			<div className="relative z-10">
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
										: "bg-gray-800 text-gray-400 hover:bg-gray-700"
								}`}
							>
								{type === "roundtrip" ? "Round Trip" : "One Way"}
							</button>
						))}
					</div>

					{/* SEARCH GRID */}
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
						<div>
							<label className="block text-emerald-400 text-xs mb-1 flex items-center gap-1">
								<MapPin className="w-3 h-3" /> FROM
							</label>

							<input
								value={origin}
								onChange={(e) => setOrigin(e.target.value)}
								placeholder="City or airport"
								className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
							/>
						</div>

						<div>
							<label className="block text-emerald-400 text-xs mb-1 flex items-center gap-1">
								<MapPin className="w-3 h-3" /> TO
							</label>

							<input
								value={destination}
								onChange={(e) => setDestination(e.target.value)}
								placeholder="City or airport"
								className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
							/>
						</div>

						<div>
							<label className="block text-emerald-400 text-xs mb-1 flex items-center gap-1">
								<Calendar className="w-3 h-3" /> DEPART
							</label>

							<input
								type="date"
								min={new Date().toISOString().split("T")[0]}
								value={departDate}
								onChange={(e) => setDepartDate(e.target.value)}
								className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm [color-scheme:dark]"
							/>
						</div>
					</div>

					{/* SECOND ROW */}
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
						{tripType === "roundtrip" ? (
							<div>
								<label className="block text-emerald-400 text-xs mb-1 flex items-center gap-1">
									<Calendar className="w-3 h-3" /> RETURN
								</label>

								<input
									type="date"
									min={new Date().toISOString().split("T")[0]}
									value={returnDate}
									onChange={(e) => setReturnDate(e.target.value)}
									className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm [color-scheme:dark]"
								/>
							</div>
						) : (
							<div />
						)}

						<div>
							<label className="block text-emerald-400 text-xs mb-1 flex items-center gap-1">
								<User className="w-3 h-3" /> TRAVELERS
							</label>

							<select
								value={travelers}
								onChange={(e) => setTravelers(e.target.value)}
								className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white"
							>
								{[1, 2, 3, 4].map((n) => (
									<option key={n} value={n}>
										{n} Traveler{n > 1 ? "s" : ""}
									</option>
								))}
							</select>
						</div>

						<div>
							<label className="block text-emerald-400 text-xs mb-1 flex items-center gap-1">
								<Plane className="w-3 h-3" /> CABIN
							</label>

							<select
								value={cabin}
								onChange={(e) => setCabin(e.target.value)}
								className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white"
							>
								<option value="economy">Economy</option>
								<option value="premium">Premium</option>
								<option value="business">Business</option>
								<option value="first">First</option>
							</select>
						</div>
					</div>

					{/* SEARCH BUTTON */}
					<button
						onClick={() => {
							setVerdict(null);
							runSearch();
						}}
						disabled={searching}
						className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 mb-2"
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

					{searchError && (
						<p className="text-red-400 text-sm text-center mb-4">
							{searchError}
						</p>
					)}
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
