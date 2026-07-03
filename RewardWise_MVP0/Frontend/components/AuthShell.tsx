/** @format */
"use client";

import Image from "next/image";
import { Loader2 } from "lucide-react";

/**
 * Shared auth-page island backdrop (island spec v2). Full-bleed hero-island
 * photo + a flat rgba(6,20,14,.50) scrim, behind a centered solid-white card.
 * The parent MUST be `relative isolate` so the -z-10 layers paint inside the
 * page's stacking context (without `isolate` they fall behind the page bg and
 * show nothing). Used by /login and /signup.
 */
export function AuthBackdrop() {
	return (
		<>
			<Image
				src="/hero-island.jpg"
				alt=""
				fill
				priority
				sizes="100vw"
				className="-z-10 object-cover object-center"
			/>
			<div className="absolute inset-0 -z-10 bg-[rgba(6,20,14,0.50)]" />
		</>
	);
}

/** Loading state for the auth pages — light chip on the island backdrop. */
export function AuthLoading() {
	return (
		<div className="font-mtw relative isolate min-h-screen overflow-hidden">
			<AuthBackdrop />
			<div className="relative z-10 flex min-h-screen items-center justify-center px-6">
				<div className="flex items-center gap-3 rounded-mtw-pill border border-mtw-border bg-white px-5 py-3 text-mtw-small text-mtw-ink shadow-mtw-ambient">
					<Loader2 className="h-4 w-4 animate-spin text-mtw-emerald" />
					Loading...
				</div>
			</div>
		</div>
	);
}
