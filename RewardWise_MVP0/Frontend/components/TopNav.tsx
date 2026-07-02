/** @format */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useWallet } from "@/context/WalletContext";
import { useAuth } from "@/context/AuthProvider";
import { walletChips as computeWalletChips } from "@/utils/walletSummary";

import { Plane, Clock, User, LogOut } from "lucide-react";

/**
 * Global nav — the redesign's light contextual bar (03-verdict-loggedin.png):
 * brand (left) + wallet pill + avatar menu (right). Profile / History / Sign out
 * live in the avatar dropdown; there are no always-visible page tabs and no Bell.
 * The same avatar menu serves desktop and mobile, so there's no separate drawer
 * to drift out of sync with desktop (drawer-mirrors-desktop rule).
 */
export default function TopNav() {
	const router = useRouter();
	const pathname = usePathname();
	const { cards, hasWallet } = useWallet();
	const { user, signOut } = useAuth();

	const [menuOpen, setMenuOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const firstItemRef = useRef<HTMLButtonElement>(null);

	// Close the avatar menu on route change, outside click, or Escape.
	useEffect(() => {
		setMenuOpen(false);
	}, [pathname]);

	useEffect(() => {
		if (!menuOpen) return;
		// Move focus into the menu on open; return it to the trigger on close.
		firstItemRef.current?.focus();
		const onClick = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setMenuOpen(false);
				triggerRef.current?.focus();
			}
		};
		document.addEventListener("mousedown", onClick);
		window.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onClick);
			window.removeEventListener("keydown", onKey);
		};
	}, [menuOpen]);

	const walletChips = useMemo(
		() => computeWalletChips(hasWallet ? cards : []),
		[cards, hasWallet],
	);

	const initial = (user?.email?.[0] ?? "?").toUpperCase();

	const menuItems = [
		{ id: "profile", icon: User, label: "Profile", onClick: () => router.push("/profile") },
		{ id: "history", icon: Clock, label: "History", onClick: () => router.push("/history") },
		{
			id: "signout",
			icon: LogOut,
			label: "Sign out",
			// signOut() only clears the Supabase session; it does NOT navigate. Without
			// an explicit nav the /home client stays mounted (wallet pill vanishes but
			// the page never leaves) and middleware never re-runs to redirect. Send the
			// user to the public landing and refresh() so RSC/middleware re-evaluate
			// auth with the cleared cookies.
			onClick: async () => {
				await signOut();
				router.replace("/");
				router.refresh();
			},
		},
	];

	return (
		<nav className="sticky top-0 z-40 border-b border-black/5 bg-white/85 backdrop-blur">
			<div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6">
				{/* Brand */}
				<button
					type="button"
					onClick={() => router.push("/home")}
					className="font-mtw flex items-center gap-2 py-3 text-mtw-ink"
					aria-label="MyTravelWallet home"
				>
					<Plane className="h-5 w-5 text-mtw-emerald" />
					<span className="font-semibold">MyTravelWallet</span>
				</button>

				{/* Wallet pill + avatar */}
				<div className="flex items-center gap-2 sm:gap-3">
					{walletChips.length > 0 && (
						<div
							data-testid="nav-wallet-pill"
							className="font-mtw hidden items-center gap-x-2 rounded-mtw-pill border border-black/10 bg-white/70 px-3 py-1.5 text-mtw-small sm:inline-flex"
						>
							<span className="font-semibold text-mtw-emerald">Your wallet</span>
							{walletChips.map((c) => (
								<span key={c.key} className="text-mtw-muted">
									{c.label}
								</span>
							))}
						</div>
					)}

					<div className="relative" ref={menuRef}>
						<button
							type="button"
							ref={triggerRef}
							onClick={() => setMenuOpen((v) => !v)}
							aria-label="Account menu"
							aria-haspopup="menu"
							aria-expanded={menuOpen}
							data-testid="avatar-menu-button"
							className="flex h-9 w-9 items-center justify-center rounded-full bg-mtw-emerald text-sm font-semibold text-white ring-1 ring-black/5 transition-transform hover:scale-105"
						>
							{initial}
						</button>

						{menuOpen && (
							<div
								role="menu"
								data-testid="avatar-menu"
								className="font-mtw absolute right-0 top-full mt-2 w-52 overflow-hidden rounded-mtw border border-black/10 bg-white shadow-mtw-ambient"
							>
								{user?.email && (
									<div className="border-b border-black/5 px-4 py-2.5">
										<p className="truncate text-mtw-small text-mtw-muted">{user.email}</p>
									</div>
								)}
								{/* Wallet chips also appear here so mobile (pill hidden) still sees them. */}
								{walletChips.length > 0 && (
									<div className="flex flex-wrap gap-x-2 gap-y-1 border-b border-black/5 px-4 py-2.5 sm:hidden">
										<span className="text-mtw-small font-semibold text-mtw-emerald">Wallet</span>
										{walletChips.map((c) => (
											<span key={c.key} className="text-mtw-small text-mtw-muted">
												{c.label}
											</span>
										))}
									</div>
								)}
								{menuItems.map((item, idx) => (
									<button
										key={item.id}
										ref={idx === 0 ? firstItemRef : undefined}
										role="menuitem"
										onClick={() => {
											setMenuOpen(false);
											item.onClick();
										}}
										className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-mtw-body text-mtw-ink transition-colors hover:bg-mtw-surface"
									>
										<item.icon className="h-4 w-4 text-mtw-muted" />
										<span>{item.label}</span>
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
