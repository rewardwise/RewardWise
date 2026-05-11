/** @format */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAlerts } from "@/context/AlertContext";
import { createClient } from "@/utils/supabase/client";

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
	Menu,
	X,
} from "lucide-react";

export default function TopNav() {
	const router = useRouter();
	const pathname = usePathname();
	const { notifications, unreadCount, markNotificationRead, markAllRead } = useAlerts();
	const supabase = useMemo(() => createClient(), []);

	const [showAlerts, setShowAlerts] = useState(false);
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [dayPassExpiresAt, setDayPassExpiresAt] = useState<number | null>(null);
	const [timeNow, setTimeNow] = useState(Date.now());

	const hamburgerRef = useRef<HTMLButtonElement>(null);
	const firstTabRef = useRef<HTMLButtonElement>(null);
	const drawerHasOpened = useRef(false);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user || cancelled) return;
			const { data } = await supabase
				.from("profiles")
				.select("day_pass_expires_at")
				.eq("user_id", user.id)
				.maybeSingle();
			if (cancelled) return;
			const expiry = data?.day_pass_expires_at
				? new Date(data.day_pass_expires_at).getTime()
				: 0;
			setDayPassExpiresAt(expiry > 0 ? expiry : null);
		})();
		return () => {
			cancelled = true;
		};
	}, [supabase]);

	useEffect(() => {
		const timer = setInterval(() => setTimeNow(Date.now()), 30_000);
		return () => clearInterval(timer);
	}, []);

	useEffect(() => {
		setDrawerOpen(false);
	}, [pathname]);

	useEffect(() => {
		if (!drawerOpen) {
			if (drawerHasOpened.current) hamburgerRef.current?.focus();
			return;
		}
		drawerHasOpened.current = true;
		firstTabRef.current?.focus();
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setDrawerOpen(false);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [drawerOpen]);

	const dayPassTimeLeft = useMemo(() => {
		if (!dayPassExpiresAt) return null;
		const msLeft = dayPassExpiresAt - timeNow;
		if (msLeft <= 0) return null;
		const totalMinutes = Math.ceil(msLeft / 60_000);
		const hours = Math.floor(totalMinutes / 60);
		const minutes = totalMinutes % 60;
		return `${hours}h ${minutes}m`;
	}, [dayPassExpiresAt, timeNow]);

	const staticAlerts = [
		...(dayPassTimeLeft
			? [
					{
						id: "static-day-pass",
						icon: Gift,
						title: "Day pass active",
						desc: `Expires in ${dayPassTimeLeft}.`,
						page: "/subscribe",
					},
				]
			: []),
		{
			id: "static-1",
			icon: AlertTriangle,
			title: "Beta access is limited",
			desc: "Only approved testers can use Zoe during this preview.",
			page: "/home",
		},
		{
			id: "static-2",
			icon: Gift,
			title: "Feedback helps improve Zoe",
			desc: "After a verdict, use the History page to rate the answer.",
			page: "/history",
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
		<>
			<nav className="bg-gray-900/95 backdrop-blur border-b border-gray-700 sticky top-0 z-40">
				<div className="flex items-center justify-between max-w-5xl mx-auto px-4">
					<div className="flex items-center gap-1">
						<button
							type="button"
							ref={hamburgerRef}
							onClick={() => setDrawerOpen(true)}
							aria-label="Open navigation menu"
							aria-expanded={drawerOpen}
							className="sm:hidden inline-flex items-center justify-center min-h-11 min-w-11 p-2 -ml-2 text-gray-300 hover:text-white rounded-lg"
						>
							<Menu className="w-5 h-5" />
						</button>

						<div
							className="flex items-center gap-2 py-3 cursor-pointer"
							onClick={() => router.push("/home")}
						>
							<Plane className="w-5 h-5 text-blue-400" />
							<span className="font-bold text-white">MyTravelWallet</span>
						</div>
					</div>

					<div className="flex items-center gap-1">
						<div className="hidden sm:flex items-center gap-1">
							{tabs.map((tab) => {
								const active = pathname.startsWith(tab.page);

								return (
									<button
										key={tab.id}
										onClick={() => router.push(tab.page)}
										className={`inline-flex items-center justify-center gap-1.5 min-h-11 px-3 py-2.5 rounded-lg text-sm transition-colors ${
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
						</div>

						<div className="relative">
							<button
								onClick={() => setShowAlerts(!showAlerts)}
								aria-label="Notifications"
								className="relative inline-flex items-center justify-center min-h-11 min-w-11 px-3 py-2.5 text-gray-400 hover:text-white"
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

									{notifications.length > 0 && (
										<>
											{notifications.map((notif) => (
												<button
													key={notif.id}
													onClick={() => {
														markNotificationRead(notif.id);
														setShowAlerts(false);
														router.push("/trips");
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

									{notifications.length > 0 && (
										<div className="px-4 py-2 border-b border-gray-700">
											<span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">System Alerts</span>
										</div>
									)}

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

			<div
				className={`sm:hidden fixed inset-0 z-50 ${
					drawerOpen ? "" : "pointer-events-none"
				}`}
				aria-hidden={!drawerOpen}
			>
				<div
					onClick={() => setDrawerOpen(false)}
					className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
						drawerOpen ? "opacity-100" : "opacity-0"
					}`}
				/>
				<aside
					role="dialog"
					aria-modal="true"
					aria-label="Main navigation"
					className={`absolute inset-y-0 left-0 w-3/4 max-w-sm bg-gray-900 border-r border-gray-700 shadow-2xl flex flex-col transform transition-transform duration-200 ${
						drawerOpen ? "translate-x-0" : "-translate-x-full"
					}`}
				>
					<div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Plane className="w-5 h-5 text-blue-400" />
							<span className="font-bold text-white">MyTravelWallet</span>
						</div>
						<button
							type="button"
							onClick={() => setDrawerOpen(false)}
							aria-label="Close navigation menu"
							className="inline-flex items-center justify-center min-h-11 min-w-11 p-2 -mr-2 text-gray-400 hover:text-white rounded-lg"
						>
							<X className="w-5 h-5" />
						</button>
					</div>

					<nav className="flex-1 overflow-y-auto py-2">
						{tabs.map((tab, idx) => {
							const active = pathname.startsWith(tab.page);

							return (
								<button
									key={tab.id}
									ref={idx === 0 ? firstTabRef : undefined}
									onClick={() => {
										setDrawerOpen(false);
										router.push(tab.page);
									}}
									className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
										active
											? "text-emerald-400 bg-emerald-500/10"
											: "text-gray-300 hover:text-white hover:bg-gray-800/50"
									}`}
								>
									<tab.icon className="w-5 h-5" />
									<span>{tab.label}</span>
								</button>
							);
						})}
					</nav>
				</aside>
			</div>
		</>
	);
}
