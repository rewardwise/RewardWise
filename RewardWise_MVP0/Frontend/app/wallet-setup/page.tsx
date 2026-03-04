/** @format */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plane, Loader2, CheckCircle } from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
import { createClient } from "@/utils/supabase/client";
import { AVAILABLE_CARDS } from "@/data/cards";

export default function WalletSetupPage() {
	const router = useRouter();
	const { user, checkPortfolio } = useAuth();
	const [selectedCards, setSelectedCards] = useState<string[]>([]);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const toggleCard = (cardId: string) => {
		setSelectedCards((prev) =>
			prev.includes(cardId)
				? prev.filter((id) => id !== cardId)
				: [...prev, cardId],
		);
	};

	const handleSave = async () => {
		if (!user) {
			setError("User not authenticated.");
			return;
		}

		if (selectedCards.length === 0) return;

		setSaving(true);
		setError(null);

		const supabase = createClient();

		// Look up reward_program_id for each selected card's program
		const selectedCardData = selectedCards.map(
			(cardId) => AVAILABLE_CARDS.find((c) => c.id === cardId)!,
		);

		const programNames = [...new Set(selectedCardData.map((c) => c.program))];

		const { data: programs, error: programError } = await supabase
			.from("reward_programs")
			.select("id, name")
			.in("name", programNames);

		if (programError || !programs) {
			setError(`Failed to load reward programs: ${programError?.message}`);
			setSaving(false);
			return;
		}

		const programMap = new Map(programs.map((p) => [p.name, p.id]));

		const missingPrograms = programNames.filter(
			(name) => !programMap.has(name),
		);

		if (missingPrograms.length > 0) {
			setError(
				`Reward programs not found in database: ${missingPrograms.join(", ")}`,
			);
			setSaving(false);
			return;
		}

		const cardsToInsert = selectedCardData.map((card) => ({
			user_id: user.id, // Safe because of guard at top
			card_name: card.name,
			reward_program_id: programMap.get(card.program)!,
		}));

		const { error: insertError } = await supabase
			.from("cards")
			.insert(cardsToInsert);

		if (insertError) {
			setError(`Failed to save cards: ${insertError.message}`);
			setSaving(false);
			return;
		}

		await checkPortfolio();
		router.push("/home");
	};

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-cyan-950">
			<div className="max-w-2xl mx-auto px-6 py-12">
				<div className="flex items-center gap-2 text-white mb-8">
					<Plane className="w-6 h-6" />
					<span className="font-bold text-lg">RewardWise</span>
				</div>

				<h1 className="text-2xl font-bold text-white mb-2">
					Set up your wallet
				</h1>
				<p className="text-gray-400 mb-8">
					Select the credit cards and loyalty programs you have. We'll use this
					to optimize your rewards.
				</p>

				{error && (
					<div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-6">
						<p className="text-red-300 text-sm">{error}</p>
					</div>
				)}

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
					{AVAILABLE_CARDS.map((card) => {
						const isSelected = selectedCards.includes(card.id);
						return (
							<button
								key={card.id}
								onClick={() => toggleCard(card.id)}
								className={`flex items-center gap-3 p-4 rounded-lg border text-left transition-colors ${
									isSelected
										? "border-emerald-500 bg-emerald-500/10"
										: "border-gray-700 bg-gray-800/50 hover:border-gray-500"
								}`}
							>
								<span className="text-2xl">{card.logo}</span>
								<div className="flex-1 min-w-0">
									<p className="text-white text-sm font-medium truncate">
										{card.name}
									</p>
									<p className="text-gray-400 text-xs truncate">
										{card.program}
									</p>
								</div>
								{isSelected && (
									<CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
								)}
							</button>
						);
					})}
				</div>

				<button
					onClick={handleSave}
					disabled={selectedCards.length === 0 || saving}
					className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
				>
					{saving ? (
						<>
							<Loader2 className="w-5 h-5 animate-spin" />
							Saving...
						</>
					) : (
						`Continue with ${selectedCards.length} card${selectedCards.length !== 1 ? "s" : ""}`
					)}
				</button>

				<button
					onClick={() => router.push("/home?skip=true")}
					className="w-full mt-4 text-gray-400 hover:text-white text-sm underline"
				>
					Skip for now
				</button>
			</div>
		</div>
	);
}
