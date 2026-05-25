/** @format */
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import TropicalBackground from "@/components/TropicalBackground";
import ZoePricingCards from "@/components/ZoePricingCards";
import { createClient } from "@/utils/supabase/client";
import { CheckCircle, CreditCard, Loader2 } from "lucide-react";
import { Suspense } from "react";
import { PORTAL_OPEN_FAILED } from "@/utils/user-messages";
import { isInternalEmail } from "@/utils/auth/internal-accounts";

function SubscribeInner() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { subscription, setSubscription, user } = useAuth();
	const [error, setError] = useState("");
	const [hasActiveDayPass, setHasActiveDayPass] = useState(false);

	const success = searchParams.get("success") === "1";
	const canceled = searchParams.get("canceled") === "1";
	const pastDue = searchParams.get("past_due") === "1";
	const isInternal = isInternalEmail(user?.email);
	const [portalLoading, setPortalLoading] = useState(false);
	const searchId = searchParams.get("search_id");

	useEffect(() => {
		if (!user?.id) return;
		const supabase = createClient();
		void supabase
			.from("profiles")
			.select("day_pass_expires_at")
			.eq("user_id", user.id)
			.maybeSingle()
			.then(({ data }) => {
				const expiry = data?.day_pass_expires_at
					? new Date(data.day_pass_expires_at).getTime()
					: 0;
				setHasActiveDayPass(expiry > Date.now());
			});
	}, [user?.id, success, canceled, searchId]);

	useEffect(() => {
		if (!success) return;
		setSubscription("pro");
	}, [success, setSubscription]);

	const handleOpenPortal = async () => {
		setPortalLoading(true);
		const res = await fetch("/api/payments/portal", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
		});
		const data = await res.json();
		if (data.url) {
			window.location.href = data.url;
		} else {
			setError(PORTAL_OPEN_FAILED);
			setPortalLoading(false);
		}
	};

	if (pastDue) {
		return (
			<div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-cyan-950 relative">
				<TropicalBackground />
				<div className="relative z-10 flex items-center justify-center min-h-screen px-6">
					<div className="bg-gray-900/90 backdrop-blur rounded-xl p-8 text-center shadow-2xl max-w-md w-full">
						<div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
							<CreditCard className="w-8 h-8 text-amber-400" />
						</div>
						<h2 className="text-2xl font-bold text-white mb-2">
							Payment Issue
						</h2>
						<p className="text-gray-400 mb-6">
							We couldn&apos;t process your last subscription payment.
							Please update your payment method to continue using MyTravelWallet.
						</p>
						{error && (
							<p className="text-red-400 text-sm mb-4">{error}</p>
						)}
						<button
							type="button"
							onClick={handleOpenPortal}
							disabled={portalLoading}
							className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 mb-3"
						>
							{portalLoading ? (
								<>
									<Loader2 className="w-5 h-5 animate-spin" />
									Opening billing portal...
								</>
							) : (
								"Update Payment Method"
							)}
						</button>
						<p className="text-gray-500 text-xs">
							You&apos;ll be redirected to Stripe to update your card securely.
						</p>
					</div>
				</div>
			</div>
		);
	}

	if (success) {
		return (
			<div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-cyan-950 relative">
				<TropicalBackground />
				<div className="relative z-10 flex items-center justify-center min-h-screen px-6">
					<div className="bg-gray-900/90 backdrop-blur rounded-xl p-8 text-center shadow-2xl max-w-md w-full">
						<div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
							<CheckCircle className="w-8 h-8 text-emerald-400" />
						</div>
						<h2 className="text-2xl font-bold text-white mb-2">
							Monthly pass activated
						</h2>
						<p className="text-gray-400 mb-6">
							Your monthly access is active. You now have full access to Verdict Search and Zoe.
						</p>
						<div className="space-y-3">
							<button
								type="button"
								onClick={() => router.push("/home")}
								className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg"
							>
								Go to Home
							</button>
							<button
								type="button"
								onClick={() => router.push("/wallet-setup")}
								className="w-full border border-gray-700 text-white font-semibold py-3 rounded-lg hover:bg-gray-800"
							>
								Set up wallet
							</button>
						</div>
					</div>
				</div>
			</div>
		);
	}

	if (isInternal) {
		return (
			<div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-cyan-950 relative">
				<TropicalBackground />
				<div className="relative z-10 flex items-center justify-center min-h-screen px-6">
					<div className="bg-gray-900/90 backdrop-blur rounded-xl p-8 text-center shadow-2xl max-w-md w-full">
						<div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
							<CheckCircle className="w-8 h-8 text-emerald-400" />
						</div>
						<h2 className="text-2xl font-bold text-white mb-2">
							Internal account
						</h2>
						<p className="text-gray-400 mb-6">
							You have full access to MyTravelWallet. No payment required.
						</p>
						<button
							type="button"
							onClick={() => router.push("/home")}
							className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg"
						>
							Go to Home
						</button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-[#faf8f5]">
			<div className="max-w-6xl mx-auto px-4 py-10 sm:py-14">
				{hasActiveDayPass && (
					<p className="text-center text-emerald-800 text-sm mb-4 max-w-2xl mx-auto bg-emerald-50 border border-emerald-200/80 rounded-xl py-2 px-3">
						Need more time? You can buy a new Day Pass after this one expires or upgrade to Monthly now.
					</p>
				)}
				{canceled && (
					<p className="text-center text-amber-800 text-sm mb-6 max-w-lg mx-auto bg-amber-50 border border-amber-200/80 rounded-xl py-2 px-3">
						Checkout was canceled. You can choose a plan again anytime.
					</p>
				)}
				<ZoePricingCards
					searchId={searchId}
					showHeader
					className=""
					showDayPassCard={!hasActiveDayPass}
					showMonthlyCard={subscription !== "pro"}
					showConciergeCard
				/>
				<p className="text-center text-xs text-stone-500 mt-8 flex items-center justify-center gap-1.5">
					<span>Secured by Stripe.</span>
				</p>
			</div>
		</div>
	);
}

export default function SubscribePage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen bg-[#faf8f5] flex items-center justify-center text-stone-500 gap-2">
					<Loader2 className="w-5 h-5 animate-spin" />
					Loading...
				</div>
			}
		>
			<SubscribeInner />
		</Suspense>
	);
}
