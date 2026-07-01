/** @format */
"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";

/**
 * Persistent light footer, matched to the redesign (01-search / 03-verdict):
 * brand · Localization · Currency · About · Privacy Policy · Terms · © notice,
 * dark text on the light app shell. Only About has a real page (/about) — the
 * rest are non-functional stubs until those pages exist, so we never link a 404.
 *
 * Gated to the logged-in app the same way as the nav (NavbarWrapper): the
 * logged-out landing/login pages are full-bleed DARK with their own hero, so the
 * light footer must not bleed onto them.
 */
export default function AppFooter() {
	const router = useRouter();
	const pathname = usePathname();
	const { user } = useAuth();

	const publicRoutes = ["/", "/login", "/forgot-password", "/reset-password"];
	if (!user || publicRoutes.includes(pathname)) return null;

	const Stub = ({ label }: { label: string }) => (
		<span className="cursor-default text-mtw-muted/60" title="Coming soon">
			{label}
		</span>
	);

	return (
		<footer className="mt-16 border-t border-mtw-border bg-mtw-surface">
			<div className="font-mtw mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-5 text-mtw-small">
				<button
					type="button"
					onClick={() => router.push("/home")}
					className="font-semibold text-mtw-ink transition-colors hover:text-mtw-emerald"
				>
					MyTravelWallet
				</button>
				<Stub label="Localization" />
				<Stub label="Currency" />
				<Link href="/about" className="text-mtw-muted transition-colors hover:text-mtw-ink">
					About
				</Link>
				<Stub label="Privacy Policy" />
				<Stub label="Terms" />
				<span className="ml-auto text-mtw-muted">
					© 2026 MyTravelWallet. All rights reserved.
				</span>
			</div>
		</footer>
	);
}
