/** @format */
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import TropicalBackground from "@/components/TropicalBackground";
import { CheckCircle, CreditCard, Loader2, Shield, Sparkles, Zap } from "lucide-react";
import { Suspense } from "react";

function SubscribeInner() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { user, subscription, setSubscription } = useAuth();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const success = searchParams.get("success") === "1";
	const canceled = searchParams.get("canceled") === "1";
	const pastDue = searchParams.get("past_due") === "1";
	const [portalLoading, setPortalLoading] = useState(false);

	useEffect(() => {
		if (success) {
			setSubscription("pro");
			const timer = setTimeout(() => {
				router.replace("/wallet-setup");
			}, 2000);
			return () => clearTimeout(timer);
		}
	}, [success, router, setSubscription]);

	useEffect(() => {
		if (subscription === "pro" && !success && !pastDue) {
			router.replace("/home");
		}
	}, [subscription, success, pastDue, router]);

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
			setError("Could not open billing portal. Please try again.");
			setPortalLoading(false);
		}
	};

	const handleSubscribe = async () => {
		if (!user) return;
		setError("");
		setLoading(true);

		const res = await fetch("/api/payments/subscribe", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
		});
		const data = (await res.json()) as { url?: string; error?: string };

		if (!res.ok) {
			setError(data.error || "Unable to start checkout. Please try again.");
			setLoading(false);
			return;
		}
		if (data.url) {
			window.location.href = data.url;
			return;
		}
		setError("No checkout URL returned.");
		setLoading(false);
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
							Welcome to MyTravelWallet Pro!
						</h2>
						<p className="text-gray-400 mb-4">
							Your subscription is active. Redirecting you to set up your wallet...
						</p>
						<Loader2 className="w-5 h-5 animate-spin text-emerald-400 mx-auto" />
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-cyan-950 relative">
			<TropicalBackground />
			<div className="relative z-10 flex items-center justify-center min-h-screen px-6">
				<div className="max-w-md w-full">
					<div className="text-center mb-8">
						<div className="w-16 h-16 bg-emerald-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
							<CreditCard className="w-8 h-8 text-emerald-400" />
						</div>
						<h1 className="text-3xl font-bold text-white mb-2">
							Unlock MyTravelWallet 
						</h1>
						<p className="text-gray-400">
							Get full access to maximize your credit card rewards
						</p>
					</div>

					<div className="bg-gray-900/90 backdrop-blur rounded-xl p-6 shadow-2xl mb-4">
						<div className="flex items-center justify-between mb-6">
							<div>
								<h3 className="text-white font-semibold text-lg">Pro Plan</h3>
								<p className="text-gray-400 text-sm">Everything you need</p>
							</div>
							<div className="text-right">
								<span className="text-3xl font-bold text-white">$9.99</span>
								<span className="text-gray-400 text-sm">/mo</span>
							</div>
						</div>

						<div className="space-y-3 mb-6">
							<div className="flex items-center gap-3">
								<Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0" />
								<span className="text-gray-300 text-sm">AI-powered points optimization</span>
							</div>
							<div className="flex items-center gap-3">
								<Zap className="w-4 h-4 text-emerald-400 flex-shrink-0" />
								<span className="text-gray-300 text-sm">Unlimited flight searches</span>
							</div>
							<div className="flex items-center gap-3">
								<CreditCard className="w-4 h-4 text-emerald-400 flex-shrink-0" />
								<span className="text-gray-300 text-sm">Track all your reward programs</span>
							</div>
							<div className="flex items-center gap-3">
								<Shield className="w-4 h-4 text-emerald-400 flex-shrink-0" />
								<span className="text-gray-300 text-sm">Personalized redemption advice</span>
							</div>
						</div>

						{canceled && (
							<p className="text-amber-400 text-sm mb-4 text-center">
								Payment was canceled. You can try again anytime.
							</p>
						)}
						{error && (
							<p className="text-red-400 text-sm mb-4 text-center">{error}</p>
						)}

						<button
							type="button"
							onClick={handleSubscribe}
							disabled={loading}
							className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
						>
							{loading ? (
								<>
									<Loader2 className="w-5 h-5 animate-spin" />
									Redirecting to secure checkout...
								</>
							) : (
								"Start Pro - $9.99/month"
							)}
						</button>
					</div>

					<div className="flex items-center justify-center gap-2 text-gray-500 text-xs">
						<Shield className="w-3 h-3" />
						<span>Secured by Stripe. Cancel anytime.</span>
					</div>
				</div>
			</div>
		</div>
	);
}

export default function SubscribePage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-cyan-950 flex items-center justify-center text-gray-400 gap-2">
					<Loader2 className="w-5 h-5 animate-spin" />
					Loading...
				</div>
			}
		>
			<SubscribeInner />
		</Suspense>
	);
}
