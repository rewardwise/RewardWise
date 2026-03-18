/** @format */

"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAlerts } from "@/context/AlertContext";

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
	Check,
} from "lucide-react";

export default function TopNav() {
	const router = useRouter();
	const pathname = usePathname();
	const { notifications, unreadCount, markNotificationRead, markAllRead } = useAlerts();

	const [showAlerts, setShowAlerts] = useState(false);

	// Static alerts (system-level) — always shown at the bottom
	const staticAlerts = [
		{
			id: "static-1",
			icon: AlertTriangle,
			title: "45K Marriott points expiring",
			desc: "90 days left — transfer or book to save ~$540",
			page: "/circle",
		},
		{
			id: "static-2",
			icon: Gift,
			title: "Amex → BA: 30% transfer bonus",
			desc: "80,000 MR → 104,000 Avios. Ends Mar 15",
			page: "/circle",
		},
		{
			id: "static-3",
			icon: TrendingUp,
			title: "Chase → Hyatt: 25% bonus",
			desc: "50,000 UR → 62,500 Hyatt points. Ends Mar 31",
			page: "/circle",
		},
	];

	const totalCount = unreadCount + staticAlerts.length;

	const tabs = [
		{ id: "home", icon: Home, label: "Home", page: "/home" },
		{ id: "trips", icon: Plane, label: "Trips", page: "/trips" },
		{ id: "circle", icon: Globe, label: "Circle", page: "/circle" },
		{ id: "history", icon: Clock, label: "History", page: "/history" },
		{ id: "profile", icon: User, label: "Profile", page: "/profile" },
		{ id: "about", icon: Info, label: "About", page: "/about" },
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
					<span className="font-bold text-white">MyTravelWallet</span>
				</div>

				{/* Tabs */}
				<div className="flex items-center gap-1">
					{tabs.map((tab) => {
						const active = pathname.startsWith(tab.page);

						return (
							<button
								key={tab.id}
								onClick={() => router.push(tab.page)}
								className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
									active
										? "text-emerald-400 bg-emerald-500/10"
										: "text-gray-400 hover:text-white hover:bg-gray-800/50"
								}`}
							>
								<tab.icon className="w-4 h-4" />
								<span className="hidden sm:inline">{tab.label}</span>
							</button>
						);
					})}

					{/* Alerts */}
					<div className="relative">
						<button
							onClick={() => setShowAlerts(!showAlerts)}
							className="relative px-3 py-2.5 text-gray-400 hover:text-white"
						>
							<Bell className="w-4 h-4" />

							{totalCount > 0 && (
								<span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">
									{totalCount > 9 ? "9+" : totalCount}
								</span>
							)}
						</button>

						{showAlerts && (
							<div className="absolute right-0 top-full mt-2 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-h-96 overflow-y-auto">
								<div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
									<span className="text-white font-semibold text-sm">
										Alerts
									</span>
									{unreadCount > 0 && (
										<button
											onClick={() => markAllRead()}
											className="text-xs text-emerald-400 hover:text-emerald-300"
										>
											Mark all read
										</button>
									)}
								</div>

								{/* User-created alerts (from watchlist) */}
								{notifications.length > 0 && (
									<>
										{notifications.map((notif) => (
											<button
												key={notif.id}
												onClick={() => {
													markNotificationRead(notif.id);
													setShowAlerts(false);
													router.push("/circle");
												}}
												className={`w-full text-left px-4 py-3 hover:bg-gray-800 border-b border-gray-800 ${
													!notif.read ? "bg-emerald-500/5" : ""
												}`}
											>
												<div className="flex items-start gap-2">
													{!notif.read && (
														<div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
													)}
													{notif.read && (
														<Check className="w-3 h-3 text-gray-600 mt-1 flex-shrink-0" />
													)}
													<div>
														<p className="text-white text-sm">{notif.title}</p>
														<p className="text-gray-400 text-xs">{notif.desc}</p>
													</div>
												</div>
											</button>
										))}
									</>
								)}

								{/* Divider if both types exist */}
								{notifications.length > 0 && (
									<div className="px-4 py-2 border-b border-gray-700">
										<span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">System Alerts</span>
									</div>
								)}

								{/* Static alerts */}
								{staticAlerts.map((alert) => (
									<button
										key={alert.id}
										onClick={() => {
											setShowAlerts(false);
											router.push(alert.page);
										}}
										className="w-full text-left px-4 py-3 hover:bg-gray-800 border-b border-gray-800"
									>
										<div className="flex items-start gap-2">
											<alert.icon className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
											<div>
												<p className="text-white text-sm">{alert.title}</p>
												<p className="text-gray-400 text-xs">{alert.desc}</p>
											</div>
										</div>
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
