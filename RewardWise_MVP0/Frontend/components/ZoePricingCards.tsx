/** @format */
"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
import {
	PAY_NO_CHECKOUT_URL,
	PAY_START_CHECKOUT,
	PAY_START_SUBSCRIPTION,
} from "@/utils/user-messages";

export type ZoePricingCardsProps = {
	searchId?: string | null;
	showHeader?: boolean;
	className?: string;
	onBeforeDayPassCheckout?: () => void;
	showDayPassCard?: boolean;
	showMonthlyCard?: boolean;
	showConciergeCard?: boolean;
};

export default function ZoePricingCards({
	searchId = null,
	showHeader = true,
	className = "",
	onBeforeDayPassCheckout,
	showDayPassCard = true,
	showMonthlyCard = true,
	showConciergeCard = true,
}: ZoePricingCardsProps) {
	const { user } = useAuth();
	const [loading, setLoading] = useState<"dayPass" | "sub" | null>(null);
	const [error, setError] = useState("");

	const startDayPass = async () => {
		if (!user) return;
		setError("");
		setLoading("dayPass");
		onBeforeDayPassCheckout?.();
		try {
			const res = await fetch("/api/payments/day-pass", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(searchId ? { searchId } : {}),
			});
			const data = (await res.json()) as { url?: string; error?: string };
			if (!res.ok) {
				setError(data.error || PAY_START_CHECKOUT);
				setLoading(null);
				return;
			}
			if (data.url) {
				window.location.href = data.url;
				return;
			}
			setError(PAY_NO_CHECKOUT_URL);
		} catch {
			setError(PAY_START_CHECKOUT);
		}
		setLoading(null);
	};

	const startSubscription = async () => {
		if (!user) return;
		setError("");
		setLoading("sub");
		try {
			const res = await fetch("/api/payments/subscribe", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
			});
			const data = (await res.json()) as { url?: string; error?: string };
			if (!res.ok) {
				setError(data.error || PAY_START_SUBSCRIPTION);
				setLoading(null);
				return;
			}
			if (data.url) {
				window.location.href = data.url;
				return;
			}
			setError(PAY_NO_CHECKOUT_URL);
		} catch {
			setError(PAY_START_SUBSCRIPTION);
		}
		setLoading(null);
	};

	const cardCount = [showDayPassCard, showMonthlyCard, showConciergeCard].filter(
		Boolean,
	).length;
	const gridColsClass =
		cardCount <= 1
			? "grid-cols-1 max-w-md"
			: cardCount === 2
				? "grid-cols-1 md:grid-cols-2 max-w-4xl"
				: "grid-cols-1 md:grid-cols-3 max-w-5xl";

	return (
		<div className={`text-stone-800 ${className}`}>
			{showHeader && (
				<div className="text-center mb-10">
					<h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight mb-2">
						Your search is ready
					</h1>
					<p className="text-stone-600 text-sm sm:text-base">
						Pick how you want to use Zoe for this trip.
					</p>
				</div>
			)}

			{error && (
				<p className="text-center text-red-600 text-sm mb-6 max-w-xl mx-auto">{error}</p>
			)}

			<div
				className={`grid ${gridColsClass} gap-6 lg:gap-8 mx-auto items-stretch`}
			>
				{showDayPassCard && (
					<div className="relative bg-white rounded-2xl border border-stone-200/80 shadow-sm p-6 flex flex-col">
					<span className="inline-flex self-start px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-900 mb-4">
						Day pass
					</span>
					<h2 className="text-lg font-semibold text-stone-900 mb-1">
						24-hour pass
					</h2>
					<p className="text-stone-600 text-sm mb-5 min-h-[40px]">
						Unlock Verdict Search + Zoe for 24 hours.
					</p>
					<div className="mb-5">
						<p className="text-3xl font-bold text-stone-900">$0.99</p>
						<p className="text-stone-500 text-xs mt-1">
							one time · 24-hour access
						</p>
					</div>
					<ul className="space-y-2.5 mb-8 flex-1 text-sm text-stone-700">
						<li className="flex gap-2 items-start">
							<Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
							<span>Unlimited verdict searches for 24 hours</span>
						</li>
						<li className="flex gap-2 items-start">
							<Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
							<span>Unlimited Zoe chat for 24 hours</span>
						</li>
						<li className="flex gap-2 items-start">
							<Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
							<span>No recurring billing</span>
						</li>
					</ul>
					<button
						type="button"
						onClick={startDayPass}
						disabled={loading !== null}
						className="w-full py-2.5 px-4 rounded-xl border border-stone-900/15 bg-white text-stone-900 text-sm font-semibold hover:bg-stone-50 disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-center gap-2"
					>
						{loading === "dayPass" ? (
							<>
								<Loader2 className="w-4 h-4 animate-spin" />
								Redirecting…
							</>
						) : (
							"Get 24h pass - $0.99"
						)}
					</button>
					<p className="text-xs text-stone-500 text-center mt-3">
						{searchId
							? "Pass starts now. Your verdict and Zoe stay available for the full 24 hours."
							: "Pass starts right after payment."}
					</p>
					</div>
				)}

				{showMonthlyCard && (
					<div className="relative md:-mt-2 md:mb-2">
					<div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
						<span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-emerald-800 text-white shadow-sm whitespace-nowrap">
							Most popular
						</span>
					</div>
					<div className="h-full bg-white rounded-2xl border-2 border-emerald-600/70 shadow-md p-6 pt-8 flex flex-col">
						<span className="inline-flex self-start px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-900 mb-4">
							Subscription
						</span>
						<h2 className="text-lg font-semibold text-stone-900 mb-1">
							Monthly membership
						</h2>
						<p className="text-stone-600 text-sm mb-5 min-h-[40px]">
							Ongoing access to Verdict Search + Zoe.
						</p>
						<div className="mb-5">
							<p className="text-3xl font-bold text-stone-900">
								$3.99
								<span className="text-lg font-semibold"> /month</span>
							</p>
							<p className="text-stone-500 text-xs mt-1">
								cancel anytime
							</p>
						</div>
						<ul className="space-y-2.5 mb-8 flex-1 text-sm text-stone-700">
							<li className="flex gap-2 items-start">
								<Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
								<span>Unlimited verdict search</span>
							</li>
							<li className="flex gap-2 items-start">
								<Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
								<span>Unlimited Zoe chat</span>
							</li>
							<li className="flex gap-2 items-start">
								<Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
								<span>Cancel from billing settings anytime</span>
							</li>
						</ul>
						<button
							type="button"
							onClick={startSubscription}
							disabled={loading !== null}
							className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
						>
							{loading === "sub" ? (
								<>
									<Loader2 className="w-4 h-4 animate-spin" />
									Redirecting…
								</>
							) : (
								"Subscribe - $3.99/mo"
							)}
						</button>
					</div>
					</div>
				)}

				{showConciergeCard && (
					<div className="relative bg-white rounded-2xl border border-stone-200/80 shadow-sm p-6 flex flex-col">
					<span className="inline-flex self-start px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-900 mb-4">
						Human expert
					</span>
					<h2 className="text-lg font-semibold text-stone-900 mb-1">
						Concierge service
					</h2>
					<p className="text-stone-600 text-sm mb-5 min-h-[40px]">
						Let our team research and plan it for you.
					</p>
					<div className="mb-5">
						<p className="text-3xl font-bold text-stone-900">From $19</p>
						<p className="text-stone-500 text-xs mt-1">
							per trip · 24hr turnaround
						</p>
					</div>
					<ul className="space-y-2.5 mb-8 flex-1 text-sm text-stone-700">
						<li className="flex gap-2 items-start">
							<Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
							<span>Expert handles all the research</span>
						</li>
						<li className="flex gap-2 items-start">
							<Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
							<span>30-min call + 24hr plan</span>
						</li>
						<li className="flex gap-2 items-start">
							<Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
							<span>Full refund if no match found</span>
						</li>
					</ul>
					<Link
						href="/concierge"
						className="w-full py-2.5 px-4 rounded-xl border border-stone-900/15 bg-white text-stone-900 text-sm font-semibold hover:bg-stone-50 flex items-center justify-center gap-2"
					>
						Request concierge
						<ExternalLink className="w-4 h-4 opacity-70" aria-hidden />
					</Link>
					</div>
				)}
			</div>

			{!user && (
				<p className="text-center text-sm text-stone-600 mt-10">
					already have an account?{" "}
					<Link
						href="/login"
						className="text-emerald-800 font-medium underline underline-offset-2 hover:text-emerald-900"
					>
						sign in
					</Link>
				</p>
			)}
		</div>
	);
}
