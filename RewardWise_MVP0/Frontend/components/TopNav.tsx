/** @format */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
	Plane,
	Home,
	Globe,
	Clock,
	User,
	Info,
	Bell,
	AlertTriangle,
	Gift,
	TrendingUp,
} from "lucide-react";

export default function TopNav({ activeTab = "home" }) {
	const router = useRouter();
	const [showAlerts, setShowAlerts] = useState(false);

	const alerts = [
		{
			id: 1,
			icon: AlertTriangle,
			color: "amber",
			title: "45K Marriott points expiring",
			desc: "90 days left — transfer or book to save ~$540",
			action: "Fix this",
			page: "/health-check",
		},
		{
			id: 2,
			icon: Gift,
			color: "emerald",
			title: "Amex → BA: 30% transfer bonus",
			desc: "80,000 MR → 104,000 Avios. Ends Mar 15",
			action: "View",
			page: "/transfer-optimizer",
		},
		{
			id: 3,
			icon: TrendingUp,
			color: "blue",
			title: "Chase → Hyatt: 25% bonus",
			desc: "50,000 UR → 62,500 Hyatt points. Ends Mar 31",
			action: "View",
			page: "/transfer-optimizer",
		},
		{
			id: 4,
			icon: Plane,
			color: "purple",
			title: "SFO→NRT: 2 biz seats opened",
			desc: "ANA NH105 · 85K pts/person · usually gone in 48hrs",
			action: "Book",
			page: "/search",
		},
	];

	return (
		<nav className="bg-gray-900/95 backdrop-blur border-b border-gray-700 sticky top-0 z-40">
			<div className="flex items-center justify-between max-w-5xl mx-auto px-4">
				{/* Logo */}
				<div
					className="flex items-center gap-2 py-3 cursor-pointer"
					onClick={() => router.push("/home")}
				>
					<Plane className="w-5 h-5 text-blue-400" />
					<span className="font-bold text-white">RewardWise</span>
				</div>

				{/* Navigation Tabs */}
				<div className="flex items-center gap-1">
					{[
						{ id: "home", icon: Home, label: "Home", page: "/home" },
						{ id: "trip", icon: Plane, label: "Trips", page: "/trips" },
						{ id: "circle", icon: Globe, label: "Circle", page: "/circle" },
						{ id: "history", icon: Clock, label: "History", page: "/history" },
						{ id: "profile", icon: User, label: "Profile", page: "/profile" },
						{ id: "about", icon: Info, label: "About", page: "/about" },
					].map((tab) => (
						<button
							key={tab.id}
							onClick={() => router.push(tab.page)}
							className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
								activeTab === tab.id
									? "text-emerald-400 bg-emerald-500/10"
									: "text-gray-400 hover:text-white hover:bg-gray-800/50"
							}`}
						>
							<tab.icon className="w-4 h-4" />
							<span className="hidden sm:inline">{tab.label}</span>
						</button>
					))}

					{/* Alerts */}
					<div className="relative">
						<button
							onClick={() => setShowAlerts(!showAlerts)}
							className="relative px-3 py-2.5 text-gray-400 hover:text-white"
						>
							<Bell className="w-4 h-4" />
							<span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">
								{alerts.length}
							</span>
						</button>

						{showAlerts && (
							<div className="absolute right-0 top-full mt-2 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl">
								<div className="px-4 py-3 border-b border-gray-700 text-white font-semibold text-sm">
									Alerts
								</div>

								{alerts.map((alert) => (
									<button
										key={alert.id}
										onClick={() => {
											setShowAlerts(false);
											router.push(alert.page);
										}}
										className="w-full text-left px-4 py-3 hover:bg-gray-800 border-b border-gray-800"
									>
										<p className="text-white text-sm">{alert.title}</p>
										<p className="text-gray-400 text-xs">{alert.desc}</p>
									</button>
								))}
							</div>
						)}
					</div>
				</div>
			</div>
		</nav>
	);
}
