/** @format */

"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle, Loader2, Mail, Plane } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { isValidEmailFormat } from "@/utils/emailValidation";

function ForgotPasswordPageInner() {
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

		const cleanEmail = email.trim();

		if (!cleanEmail || !isValidEmailFormat(cleanEmail)) {
			setError("Please enter a valid email address.");
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
		<div className="relative min-h-screen overflow-hidden bg-[#080E1C] text-white">
			<div
				className="absolute inset-0 bg-cover bg-center"
				style={{ backgroundImage: "url('/beach-hero.png')" }}
			/>
			<div className="absolute inset-0 bg-[rgba(8,14,28,0.55)]" />
			<div className="absolute inset-0 bg-gradient-to-br from-[rgba(8,14,28,0.68)] via-[rgba(8,14,28,0.35)] to-[rgba(8,14,28,0.6)]" />

			<div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-10">
				<div className="w-full max-w-md rounded-[28px] border border-white/12 bg-[rgba(8,14,28,0.78)] p-7 shadow-2xl shadow-black/30 backdrop-blur-2xl sm:p-8">
					<button
						onClick={() => router.push("/login")}
						className="mb-6 inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white"
					>
						<ArrowLeft className="h-4 w-4" />
						Back to login
					</button>

					<div className="mb-6 flex items-center gap-2">
						<Plane className="h-5 w-5 text-white" />
						<span className="text-base font-semibold tracking-tight text-white">
							MyTravelWallet
						</span>
					</div>

					{sent ? (
						<div className="text-center">
							<div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(34,197,94,0.24)] bg-[rgba(34,197,94,0.08)]">
								<CheckCircle className="h-6 w-6 text-[#22C55E]" />
							</div>
							<h1 className="text-2xl font-bold tracking-tight text-white">
								Check your email
							</h1>
							<p className="mt-3 text-sm leading-6 text-white/68">
								We sent a password reset link to <span className="text-white">{email.trim()}</span>.
								 Open the email and follow the secure link to continue.
							</p>
							<button
								onClick={() => router.push("/login")}
								className="mt-6 inline-flex items-center justify-center rounded-xl bg-[#22C55E] px-5 py-3 text-sm font-semibold text-[#08111F] transition hover:bg-[#16A34A]"
							>
								Back to Login
							</button>
						</div>
					) : (
						<>
							<h1 className="text-3xl font-bold tracking-tight text-white">
								Reset your password
							</h1>
							<p className="mt-2 text-sm leading-6 text-white/65">
								Send a secure reset link to your approved team email.
							</p>

							{error ? (
								<div className="mt-5 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-100">
									{error}
								</div>
							) : null}

							<form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
								<div>
									<label
										htmlFor="email"
										className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#86EFAC]/80"
									>
										Email
									</label>
									<div className="relative">
										<Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
										<input
											id="email"
											type="email"
											value={email}
											onChange={(e) => setEmail(e.target.value)}
											placeholder="name@example.com"
											autoComplete="email"
											className="w-full rounded-xl border border-white/12 bg-white/7 py-3 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-white/24 focus:border-[rgba(34,197,94,0.45)] focus:bg-white/10"
										/>
									</div>
								</div>

								<button
									type="submit"
									disabled={loading}
									className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#22C55E] px-5 py-3.5 text-sm font-semibold text-[#08111F] transition hover:bg-[#16A34A] disabled:cursor-not-allowed disabled:opacity-70"
								>
									{loading ? (
										<>
											<Loader2 className="h-4 w-4 animate-spin" />
											Sending reset link...
										</>
									) : (
										"Send Reset Link"
									)}
								</button>
							</form>

							<p className="mt-5 text-center text-xs leading-5 text-white/38">
								Only approved team accounts can access the product.
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
		<Suspense
			fallback={
				<div className="relative min-h-screen overflow-hidden bg-[#080E1C] text-white">
					<div
						className="absolute inset-0 bg-cover bg-center"
						style={{ backgroundImage: "url('/beach-hero.png')" }}
					/>
					<div className="absolute inset-0 bg-[rgba(8,14,28,0.55)]" />
					<div className="relative z-10 flex min-h-screen items-center justify-center px-6">
						<div className="flex items-center gap-3 rounded-full border border-white/12 bg-[rgba(8,14,28,0.74)] px-5 py-3 text-sm text-white/80 backdrop-blur-xl">
							<Loader2 className="h-4 w-4 animate-spin" />
							Loading...
						</div>
					</div>
				</div>
			}
		>
			<ForgotPasswordPageInner />
		</Suspense>
	);
}
