/** @format */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plane, Globe, X } from "lucide-react";

/**
 * Logged-out landing nav (8c) — sits on the dark island hero, so white type on a
 * transparent bar. Separate from the logged-in TopNav (do not merge): a guest has
 * no wallet/avatar/History/Profile. Logo · How it works (→ /about, which is the
 * "link programs → we find the path → book" narrative) · Globe (language stub) ·
 * Sign in.
 */
export default function LandingNav() {
	const router = useRouter();
	const [langOpen, setLangOpen] = useState(false);

	return (
		<>
			<nav className="font-mtw relative z-20 flex items-center justify-between px-6 py-4 sm:px-8">
				<Link href="/" className="flex items-center gap-2 text-white" aria-label="MyTravelWallet home">
					<Plane className="h-5 w-5" />
					<span className="font-semibold">MyTravelWallet</span>
				</Link>

				<div className="flex items-center gap-2 sm:gap-4">
					<Link
						href="/about"
						className="hidden text-mtw-small font-medium text-white/85 transition-colors hover:text-white sm:inline"
					>
						How it works
					</Link>
					<button
						type="button"
						onClick={() => setLangOpen(true)}
						aria-label="Language and region"
						data-testid="landing-globe"
						className="flex h-9 w-9 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white"
					>
						<Globe className="h-5 w-5" />
					</button>
					<button
						type="button"
						onClick={() => router.push("/login")}
						data-testid="landing-signin"
						className="rounded-mtw-pill bg-white px-4 py-1.5 text-mtw-small font-semibold text-mtw-emerald transition-transform hover:scale-105"
					>
						Sign in
					</button>
				</div>
			</nav>

			{/* Language stub modal (selectors deferred — footer/stub remains). */}
			{langOpen && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
					role="dialog"
					aria-modal="true"
					aria-labelledby="lang-modal-title"
				>
					<div className="font-mtw w-full max-w-sm rounded-2xl border border-mtw-border bg-white p-6 shadow-mtw-ambient">
						<div className="flex items-start justify-between">
							<h2 id="lang-modal-title" className="text-mtw-title font-semibold text-mtw-ink">
								Language & region
							</h2>
							<button
								type="button"
								onClick={() => setLangOpen(false)}
								aria-label="Close"
								className="text-mtw-muted hover:text-mtw-ink"
							>
								<X className="h-5 w-5" />
							</button>
						</div>
						<p className="mt-2 text-mtw-small leading-6 text-mtw-muted">
							Language and region selectors are coming soon. For now everything is in English (USD).
						</p>
						<button
							type="button"
							onClick={() => setLangOpen(false)}
							className="mt-5 w-full rounded-mtw bg-mtw-emerald px-4 py-2 text-mtw-small font-semibold text-white transition-opacity hover:opacity-90"
						>
							Got it
						</button>
					</div>
				</div>
			)}
		</>
	);
}
