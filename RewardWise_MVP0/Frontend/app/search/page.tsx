/** @format */

"use client";
import { useState } from "react";
import SearchForm from "@/components/SearchForm";
import VerdictCard from "@/components/VerdictCard";

export default function SearchPage() {
	const [results, setResults] = useState<any>(null);
	const [loading, setLoading] = useState(false);

	return (
		<main className="min-h-screen bg-gray-50 flex flex-col items-center justify-start gap-8 p-10">
			<h1 className="text-3xl font-bold text-gray-900">RewardWise Search</h1>
			<SearchForm onResults={setResults} onLoading={setLoading} />
			{loading && (
				<p className="text-indigo-500 font-medium animate-pulse">
					Searching award availability...
				</p>
			)}
			{results && !loading && (
				<VerdictCard
					verdict={results.verdict}
					cashPrice={results.cash_price}
					origin={results.origin}
					destination={results.destination}
					departDate={results.depart_date}
					returnDate={results.return_date}
					cabin={results.cabin}
					travelers={results.travelers ?? 1}
					isRoundtrip={results.is_roundtrip}
					awardOptions={results.award_options}
					returnAwardOptions={results.return_award_options}
					flights={results.flights}
				/>
			)}
		</main>
	);
}
