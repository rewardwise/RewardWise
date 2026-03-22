/** @format */

"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import TopNav from "@/components/TopNav";
import { createClient } from "@/utils/supabase/client";

const supabase = createClient();
import {
	User,
	Wallet,
	BarChart3,
	Map,
	Coffee,
	Crown,
	Star,
	LogOut,
} from "lucide-react";
import TropicalBackground from "@/components/TropicalBackground";

export default function ProfilePage() {
	const router = useRouter();
	const { user, signOut, subscription } = useAuth();

	const tools = [
		{
			icon: Wallet,
			label: "My Wallet",
			desc: "Manage cards & balances",
			page: "/wallet-setup",
			color: "emerald",
		},
		{
			icon: BarChart3,
			label: "Health Check",
			desc: "Portfolio review",
			page: "/health-check",
			color: "blue",
		},
		{
			icon: Map,
			label: "Transfer Paths",
			desc: "Point optimizer",
			page: "/transfer-optimizer",
			color: "cyan",
		},
		{
			icon: Coffee,
			label: "Concierge",
			desc: "Flight booking · $39",
			page: "/concierge",
			color: "amber",
		},
		{
			icon: Crown,
			label: "Premium Concierge",
			desc: "White-glove · $199",
			page: "/concierge",
			color: "purple",
		},
		{
			icon: Star,
			label: "Trip Feedback",
			desc: "Rate your trips",
			page: "/history",
			color: "pink",
		},
	];

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-cyan-950">
			<TropicalBackground />
			<main className="max-w-2xl mx-auto px-6 py-8">
				<h1 className="text-3xl font-bold text-white mb-6 drop-shadow-lg">
					Profile
				</h1>
				<div className="space-y-4">
					{/* USER INFO */}
					<div className="bg-gray-900/90 backdrop-blur rounded-xl p-6">
						<div className="flex items-center gap-4 mb-4">
							<div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center">
								<User className="w-7 h-7 text-emerald-400" />
							</div>

							<div>
								<p className="text-white font-semibold">
									{user?.email || "User"}
								</p>

								<p className="text-gray-400 text-sm capitalize">
									{subscription || "Free"} Plan
								</p>
							</div>
						</div>

						<button
							onClick={() => router.push("/subscription")}
							className="w-full bg-gray-800/50 hover:bg-gray-800 text-emerald-400 py-2.5 rounded-lg text-sm font-medium border border-gray-700"
						>
							Manage Subscription
						</button>
					</div>

					{/* TOOLS GRID */}
					<div className="bg-gray-900/90 backdrop-blur rounded-xl p-6">
						<h2 className="text-lg font-semibold text-white mb-4">Tools</h2>

						<div className="grid grid-cols-2 gap-3">
							{tools.map((tool, i) => (
								<button
									key={i}
									onClick={() => router.push(tool.page)}
									className="bg-gray-800/50 hover:bg-gray-800 rounded-lg p-3 text-left transition-all border border-gray-700/50"
								>
									<tool.icon className="w-5 h-5 text-emerald-400 mb-2" />

									<p className="text-white text-sm font-medium">{tool.label}</p>

									<p className="text-gray-500 text-xs">{tool.desc}</p>
								</button>
							))}
						</div>
					</div>

					{/* SETTINGS */}
					<div className="bg-gray-900/90 backdrop-blur rounded-xl p-6">
						<h2 className="text-lg font-semibold text-white mb-4">Settings</h2>

						<div className="space-y-3">
							{[
								"Email alerts for watchlist",
								"Weekly portfolio summary",
								"Deal alerts",
								"Points expiry warnings",
							].map((item, i) => (
								<div key={i} className="flex items-center justify-between">
									<span className="text-gray-300 text-sm">{item}</span>

									<input
										type="checkbox"
										defaultChecked
										className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-emerald-500"
									/>
								</div>
							))}
						</div>
					</div>

					{/* LOGOUT */}
					<button
						onClick={async () => {
							await signOut();
							router.replace("/login");
						}}
						className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium py-3 rounded-xl border border-red-500/30 flex items-center justify-center gap-2"
					>
						<LogOut className="w-5 h-5" />
						Log Out
					</button>
					<button
						onClick={async () => {
							if (
								!confirm("This will permanently delete your account. Continue?")
							)
								return;

							const {
								data: { session },
							} = await supabase.auth.getSession();

							if (!session) {
								alert("Not authenticated");
								return;
							}

							await fetch("/api/delete-account", {
								method: "DELETE",
								headers: {
									Authorization: `Bearer ${session.access_token}`,
								},
							});

							await signOut();
							router.replace("/");
						}}
						className="w-full bg-red-900/20 hover:bg-red-900/30 text-red-500 font-medium py-3 rounded-xl border border-red-900/30 flex items-center justify-center gap-2"
					>
						Delete Account
					</button>
				</div>
			</main>
		</div>
	);
}
