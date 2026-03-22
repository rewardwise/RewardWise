/** @format */

"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Plane, Mail, Loader2, CheckCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import TropicalBackground from "@/components/TropicalBackground";

function ForgotPasswordForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [sent, setSent] = useState(false);

	useEffect(() => {
		if (searchParams.get("error") === "expired") {
			setError(
				"Your reset link expired or was already used. Please request a new one.",
			);
		}
	}, [searchParams]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (loading) return;
		setError("");

		if (!email || !/\S+@\S+\.\S+/.test(email)) {
			setError("Please enter a valid email address");
			return;
		}

		setLoading(true);

		const supabase = createClient();
		const { error: resetError } = await supabase.auth.resetPasswordForEmail(
			email,
			{
				redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
			},
		);

		setLoading(false);

		if (resetError) {
			setError(resetError.message);
			return;
		}

		setSent(true);
	};

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-cyan-950 relative">
			<TropicalBackground />

			<div className="relative z-10 min-h-screen flex items-center justify-center p-6">
				<div className="bg-gray-900/90 backdrop-blur rounded-xl p-8 w-full max-w-md shadow-2xl">
					<button
						onClick={() => router.push("/login")}
						className="flex items-center gap-2 text-gray-400 hover:text-white mb-6"
					>
						<ArrowLeft className="w-4 h-4" /> Back to Login
					</button>

					<div className="flex items-center gap-2 mb-6">
						<Plane className="w-6 h-6 text-blue-400" />
						<span className="font-bold text-lg text-white">MyTravelWallet</span>
					</div>

					{sent ? (
						<div className="text-center py-4">
							<CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
							<h1 className="text-2xl font-bold text-white mb-2">
								Check your email
							</h1>
							<p className="text-gray-400 mb-6">
								We sent a password reset link to{" "}
								<span className="text-white">{email}</span>. Click the link in
								the email to reset your password.
							</p>
							<button
								onClick={() => router.push("/login")}
								className="text-emerald-400 hover:text-emerald-300 text-sm"
							>
								Back to Login
							</button>
						</div>
					) : (
						<>
							<h1 className="text-2xl font-bold text-white mb-2">
								Reset your password
							</h1>
							<p className="text-gray-400 mb-6">
								Enter your email and we'll send you a link to reset your
								password.
							</p>

							{error && (
								<div
									role="alert"
									className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4"
								>
									<p className="text-red-300 text-sm">{error}</p>
								</div>
							)}

							<form onSubmit={handleSubmit} className="space-y-4" noValidate>
								<div>
									<label className="block text-sm text-gray-300 mb-1">
										Email <span className="text-red-400">*</span>
									</label>
									<div className="relative">
										<Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
										<input
											type="email"
											value={email}
											onChange={(e) => setEmail(e.target.value)}
											placeholder="name@example.com"
											className="w-full bg-gray-800/80 border border-gray-700 rounded-lg py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
										/>
									</div>
								</div>

								<button
									type="submit"
									disabled={loading}
									className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
								>
									{loading ? (
										<>
											<Loader2 className="w-5 h-5 animate-spin" /> Sending...
										</>
									) : (
										"Send Reset Link"
									)}
								</button>
							</form>

							<p className="mt-4 text-gray-500 text-xs text-center">
								Signed up with Google? Your password is managed by Google —{" "}
								<a
									href="https://myaccount.google.com/security"
									target="_blank"
									rel="noopener noreferrer"
									className="text-gray-400 underline"
								>
									update it there
								</a>{" "}
								instead.
							</p>
						</>
					)}
				</div>
			</div>
		</div>
	);
}

export default function ForgotPasswordPage() {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<ForgotPasswordForm />
		</Suspense>
	);
}
