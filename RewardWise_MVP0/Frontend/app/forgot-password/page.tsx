/** @format */

"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Plane, Mail, Loader2, CheckCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import TropicalBackground from "@/components/TropicalBackground";
import { isValidEmailFormat } from "@/utils/emailValidation";

function ForgotPasswordForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [sent, setSent] = useState(false);
	const [isGoogleOnly, setIsGoogleOnly] = useState(false);

	useEffect(() => {
		if (searchParams.get("error") === "expired") {
			setError(
				"Your reset link expired or was already used. Please request a new one.",
			);
		}
	}, [searchParams]);

	const checkProvider = async (emailValue: string) => {
		const clean = emailValue.trim();
		if (!clean || !isValidEmailFormat(clean)) return;

		try {
			const res = await fetch("/api/check-auth-provider", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: clean }),
			});
			const { isGoogleOnly: googleOnly } = await res.json();
			if (googleOnly) setIsGoogleOnly(true);
		} catch {
			// silently ignore — fall back to normal reset flow
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (loading) return;
		setError("");

		const cleanEmail = email.trim();

		if (!cleanEmail || !isValidEmailFormat(cleanEmail)) {
			setError("Please enter a valid email address");
			return;
		}
		setLoading(true);

		const supabase = createClient();
		const { error: resetError } = await supabase.auth.resetPasswordForEmail(
			cleanEmail,
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
								<span className="text-white">{email.trim()}</span>. Click the
								link in the email to reset your password.
							</p>
							<button
								onClick={() => router.push("/login")}
								className="text-emerald-400 hover:text-emerald-300 text-sm"
							>
								Back to Login
							</button>
						</div>
					) : isGoogleOnly ? (
						<div className="text-center py-4">
							<div className="w-12 h-12 mx-auto mb-4 flex items-center justify-center rounded-full bg-blue-500/20">
								<svg className="w-6 h-6" viewBox="0 0 24 24" aria-hidden="true">
									<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
									<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
									<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
									<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
								</svg>
							</div>
							<h1 className="text-2xl font-bold text-white mb-2">
								You signed up with Google
							</h1>
							<p className="text-gray-400 mb-6">
								Your password is managed by Google, not MyTravelWallet. To
								update it, visit your Google account security settings.
							</p>
							<a
								href="https://myaccount.google.com/security"
								target="_blank"
								rel="noopener noreferrer"
								className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors text-center mb-3"
							>
								Go to Google Account Security
							</a>
							<button
								onClick={() => setIsGoogleOnly(false)}
								className="text-gray-500 hover:text-gray-400 text-sm"
							>
								I didn&apos;t sign up with Google
							</button>
						</div>
					) : (
						<>
							<h1 className="text-2xl font-bold text-white mb-2">
								Reset your password
							</h1>
							<p className="text-gray-400 mb-6">
								Enter your email and we&apos;ll send you a link to reset your
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
											onBlur={(e) => checkProvider(e.target.value)}
											placeholder="name@example.com"
											className="w-full bg-gray-800/80 border border-gray-700 rounded-lg py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
										/>
									</div>
								</div>

								<button
									type="submit"
									disabled={loading || !email.trim()}
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
