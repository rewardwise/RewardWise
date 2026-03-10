/** @format */

"use client";
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
	Plane,
	Search,
	Check,
	AlertTriangle,
	Gift,
	TrendingUp,
	RefreshCw,
	Loader2,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";
import TropicalBackground from "@/components/TropicalBackground";
import { useAuth } from "@/context/AuthProvider";
import { AVAILABLE_CARDS } from "@/data/cards";

export default function WalletSetupPage() {
	const router = useRouter();
	const { user, checkPortfolio } = useAuth();

	const [searchTerm, setSearchTerm] = useState("");
	const [selectedCards, setSelectedCards] = useState<string[]>([]);
	const [balances, setBalances] = useState<Record<string, number>>({});
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const supabase = createClient();

	const [showPortfolio, setShowPortfolio] = useState(false);
	type SavedCard = {
		id: string;
		name: string;
		program: string;
		balance: number;
		logo: string;
	};

	const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
	const [totalPoints, setTotalPoints] = useState(0);
	const [totalValue, setTotalValue] = useState(0);
	const filteredCards = AVAILABLE_CARDS.filter(
		(card) =>
			card.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
			card.program.toLowerCase().includes(searchTerm.toLowerCase()),
	);

	function toggleCard(cardId: string) {
		if (selectedCards.includes(cardId)) {
			setSelectedCards(selectedCards.filter((c) => c !== cardId));
		} else {
			if (selectedCards.length >= 10) return;
			setSelectedCards([...selectedCards, cardId]);
		}
	}

	async function handleSave() {
		if (!user) {
			setError("User not authenticated.");
			return;
		}

		setSaving(true);
		setError(null);

		const selectedCardData = selectedCards.map(
			(id) => AVAILABLE_CARDS.find((c) => c.id === id)!,
		);

		const programNames = [...new Set(selectedCardData.map((c) => c.program))];

		const { data: programs, error: programError } = await supabase
			.from("reward_programs")
			.select("id, name")
			.in("name", programNames);

		if (programError) {
			setError(programError.message);
			setSaving(false);
			return;
		}

		const programMap = new Map(programs.map((p) => [p.name, p.id]));

		const cardsToInsert = selectedCardData.map((card) => ({
			user_id: user.id,
			card_name: card.name,
			reward_program_id: programMap.get(card.program),
			points_balance: balances[card.id] || 0,
		}));

		const { error: insertError } = await supabase
			.from("cards")
			.insert(cardsToInsert);

		if (insertError) {
			setError(insertError.message);
			setSaving(false);
			return;
		}

		await loadPortfolio(user.id);
		setShowPortfolio(true);
		setSaving(false);
	}
	async function loadPortfolio(userId: string) {
		const { data } = await supabase
			.from("cards")
			.select(
				`
			id,
			card_name,
			points_balance,
			reward_programs(name)
		`,
			)
			.eq("user_id", userId);

		if (!data) return;

		const mapped = data.map((c: any) => ({
			id: c.id,
			name: c.card_name,
			program: c.reward_programs?.name ?? "",
			balance: c.points_balance,
			logo: "💳",
		}));

		setSavedCards(mapped);

		const pts = mapped.reduce((sum, c) => sum + (c.balance || 0), 0);

		setTotalPoints(pts);
		setTotalValue(Math.round(pts * 0.015));
	}

	return (
		<div className="relative min-h-screen flex items-center justify-center">
			{/* Background */}
			<div
				className="absolute inset-0 bg-cover bg-center opacity-30"
				style={{
					backgroundImage:
						"url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80')",
				}}
			/>
			<main className="w-full max-w-4xl mx-auto px-6 py-12">
				{showPortfolio ? (
					<div className="space-y-9">
						{/* PORTFOLIO VIEW */}
						<div className="flex justify-between items-center mb-2">
							<h1 className="text-3xl font-bold text-white drop-shadow-lg">
								Unified Wallet
							</h1>
							<span className="text-gray-400 text-sm">
								Last updated: Just now
							</span>
						</div>

						{/* Balances Table */}
						<div className="bg-gray-900/90 backdrop-blur rounded-xl p-6 shadow-2xl">
							<h2 className="text-lg font-semibold text-white mb-4">
								Your Portfolio
							</h2>
							<div className="space-y-3">
								{savedCards.map((card) => (
									<div
										key={card.id}
										className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3"
									>
										<div className="flex items-center gap-3">
											<span className="text-xl">{card.logo}</span>
											<div>
												<p className="text-white text-sm font-medium">
													{card.program}
												</p>
												<p className="text-gray-500 text-xs">{card.name}</p>
											</div>
										</div>
										<div className="text-right">
											<p className="text-white font-medium">
												{(card.balance || 0).toLocaleString()} pts
											</p>
											<p className="text-emerald-400 text-xs">
												{(card.balance || 0) * 0.015 >= 1
													? "~$" +
														Math.round(
															(card.balance || 0) * 0.015,
														).toLocaleString()
													: ""}
											</p>
										</div>
									</div>
								))}
								<div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 mt-2">
									<span className="text-emerald-400 font-semibold">Total</span>
									<div className="text-right">
										<p className="text-white font-bold">
											{totalPoints.toLocaleString()} pts
										</p>
										<p className="text-emerald-400 font-semibold">
											~${totalValue}
										</p>
									</div>
								</div>
							</div>
						</div>
						{/* Transfer Potential */}
						<div className="bg-gray-900/90 backdrop-blur rounded-xl p-6 shadow-2xl">
							<h2 className="text-lg font-semibold text-white mb-3">
								Transfer Potential
							</h2>
							<div className="grid grid-cols-2 gap-4 mb-4">
								<div className="bg-gray-800/50 rounded-lg p-3 text-center">
									<p className="text-gray-400 text-xs">Combined Buying Power</p>
									<p className="text-white font-bold text-xl">
										~${(totalPoints * 0.035).toLocaleString()}
									</p>
									<p className="text-gray-500 text-xs">
										at premium cabin rates
									</p>
								</div>
								<div className="bg-gray-800/50 rounded-lg p-3 text-center">
									<p className="text-gray-400 text-xs">Transfer Partners</p>
									<p className="text-white font-bold text-xl">14</p>
									<p className="text-gray-500 text-xs">
										airlines & hotels available
									</p>
								</div>
							</div>
						</div>

						{/* Alerts */}
						<div className="bg-gray-900/90 backdrop-blur rounded-xl p-6 shadow-2xl">
							<h2 className="text-lg font-semibold text-white mb-3">Alerts</h2>
							<div className="space-y-3">
								<div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
									<AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
									<div>
										<p className="text-white text-sm font-medium">
											Expiring Points
										</p>
										<p className="text-gray-400 text-xs">
											45,000 Marriott Bonvoy points expire in 90 days. Transfer
											or book to save ~$540.
										</p>
									</div>
								</div>
								<div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
									<Gift className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
									<div>
										<p className="text-white text-sm font-medium">
											Transfer Bonus: Amex → British Airways
										</p>
										<p className="text-gray-400 text-xs">
											30% bonus active until March 15. Your 80,000 MR → 104,000
											Avios.
										</p>
									</div>
								</div>
								<div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
									<TrendingUp className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
									<div>
										<p className="text-white text-sm font-medium">
											Transfer Bonus: Chase → Hyatt
										</p>
										<p className="text-gray-400 text-xs">
											25% bonus until March 31. 50,000 UR → 62,500 Hyatt points.
										</p>
									</div>
								</div>
							</div>
						</div>

						{/* Actions */}
						<div className="flex gap-3">
							<button
								onClick={() => setShowPortfolio(false)}
								className="flex-1 border border-gray-600 text-white py-3 rounded-lg hover:bg-gray-800/50 flex items-center justify-center gap-2"
							>
								<RefreshCw className="w-4 h-4" /> Update Balances
							</button>
							<button
								onClick={() => router.push("/search")}
								className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
							>
								<Search className="w-4 h-4" /> Run Search
							</button>
						</div>
					</div>
				) : (
					<>
						<div className="text-center mb-8">
							<h1 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">
								Select your Banks/Cards
							</h1>
							<p className="text-gray-200">
								Add your credit cards and loyalty programs to get personalized
								verdicts
							</p>
						</div>
						<div className="bg-gray-900/90 backdrop-blur rounded-xl p-6 shadow-2xl">
							<div className="mb-4">
								<div className="relative">
									<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
									<input
										type="text"
										value={searchTerm}
										onChange={(e) => setSearchTerm(e.target.value)}
										placeholder="Search cards or programs..."
										className="w-full bg-gray-800 border border-gray-700 rounded-lg py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
									/>
								</div>
							</div>
							<div className="flex justify-between items-center mb-4">
								<p className="text-gray-400 text-sm">
									{selectedCards.length}/10 cards selected
								</p>
								{selectedCards.length >= 10 && (
									<p className="text-amber-400 text-sm">
										Maximum cards reached
									</p>
								)}
							</div>
							<div className="grid md:grid-cols-2 gap-3 mb-6 max-h-96 overflow-y-auto">
								{filteredCards.map((card) => {
									const isSelected = selectedCards.includes(card.id);
									const bal = balances[card.id] || 0;

									return (
										<div
											key={card.id}
											onClick={() => toggleCard(card.id)}
											tabIndex={0}
											role="checkbox"
											aria-checked={isSelected}
											onKeyDown={(e) => {
												if (e.key === "Enter" || e.key === " ") {
													e.preventDefault();
													toggleCard(card.id);
												}
											}}
											className={`p-3 rounded-lg border cursor-pointer transition-all ${
												isSelected
													? "bg-emerald-500/20 border-emerald-500"
													: "bg-gray-800/50 border-gray-700 hover:border-gray-600"
											}`}
										>
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-3">
													<span className="text-xl">{card.logo}</span>

													<div>
														<p className="text-white text-sm font-medium">
															{card.name}
														</p>
														<p className="text-gray-500 text-xs">
															{card.program}
														</p>
													</div>
												</div>

												<div
													className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
														isSelected
															? "bg-emerald-500 border-emerald-500"
															: "border-gray-600"
													}`}
												>
													{isSelected && (
														<Check className="w-3 h-3 text-white" />
													)}
												</div>
											</div>

											{isSelected && (
												<div
													className="mt-3 flex items-center gap-2"
													onClick={(e) => e.stopPropagation()}
												>
													<input
														type="number"
														value={balances?.[card.id] || ""}
														onChange={(e) =>
															setBalances((prev) => ({
																...prev,
																[card.id]: Number(e.target.value),
															}))
														}
														placeholder="Points balance"
														className="flex-1 bg-gray-900 border border-gray-700 rounded py-2 px-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
													/>

													{bal > 0 && (
														<span className="text-emerald-400 text-xs font-medium bg-emerald-500/10 px-2 py-1 rounded flex-shrink-0">
															~${(bal * 0.015).toFixed(0)}
														</span>
													)}
												</div>
											)}
										</div>
									);
								})}
							</div>
							<div className="flex gap-3">
								<button
									onClick={() => router.push("/home")}
									className="flex-1 border border-gray-600 text-white py-3 rounded-lg hover:bg-gray-800/50"
								>
									Skip for now
								</button>

								<button
									onClick={() => setShowPortfolio(true)}
									className="flex-1 border border-emerald-500 text-emerald-400 py-3 rounded-lg hover:bg-emerald-500/10 font-medium"
								>
									View Portfolio
								</button>

								<button
									onClick={handleSave}
									disabled={selectedCards.length === 0}
									className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-3 rounded-lg"
								>
									Save & Continue
								</button>
							</div>
						</div>
					</>
				)}
			</main>
		</div>
	);
}
