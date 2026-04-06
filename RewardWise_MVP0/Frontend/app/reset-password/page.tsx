/** @format */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Eye, EyeOff, Loader2, Lock, Plane } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function ResetPasswordPage() {
	const router = useRouter();
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		if (!password || password.length < 8) {
			setError("Password must be at least 8 characters long.");
			return;
		}

		if (password !== confirmPassword) {
			setError("Passwords do not match.");
			return;
		}

		setLoading(true);

		const supabase = createClient();
		const { error: updateError } = await supabase.auth.updateUser({
			password,
		});

		setLoading(false);

		if (updateError) {
			setError(updateError.message);
			return;
		}

		setSuccess(true);
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
					<div className="mb-6 flex items-center gap-2">
						<Plane className="h-5 w-5 text-white" />
						<span className="text-base font-semibold tracking-tight text-white">
							MyTravelWallet
						</span>
					</div>

					{success ? (
						<div className="text-center">
							<div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(34,197,94,0.24)] bg-[rgba(34,197,94,0.08)]">
								<CheckCircle className="h-6 w-6 text-[#22C55E]" />
							</div>
							<h1 className="text-2xl font-bold tracking-tight text-white">
								Password updated
							</h1>
							<p className="mt-3 text-sm leading-6 text-white/68">
								Your password has been reset successfully. You can sign back in now.
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
								Set new password
							</h1>
							<p className="mt-2 text-sm leading-6 text-white/65">
								Choose a new password for your approved team account.
							</p>

							{error ? (
								<div className="mt-5 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-100">
									{error}
								</div>
							) : null}

							<form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
								<div>
									<label
										htmlFor="password"
										className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#86EFAC]/80"
									>
										New Password
									</label>
									<div className="relative">
										<Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
										<input
											id="password"
											type={showPassword ? "text" : "password"}
											value={password}
											onChange={(e) => setPassword(e.target.value)}
											placeholder="Minimum 8 characters"
											autoComplete="new-password"
											className="w-full rounded-xl border border-white/12 bg-white/7 py-3 pl-10 pr-12 text-sm text-white outline-none transition placeholder:text-white/24 focus:border-[rgba(34,197,94,0.45)] focus:bg-white/10"
										/>
										<button
											type="button"
											onClick={() => setShowPassword((prev) => !prev)}
											className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 transition hover:text-white/70"
											aria-label={showPassword ? "Hide password" : "Show password"}
										>
											{showPassword ? (
												<EyeOff className="h-4 w-4" />
											) : (
												<Eye className="h-4 w-4" />
											)}
										</button>
									</div>
								</div>

								<div>
									<label
										htmlFor="confirmPassword"
										className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#86EFAC]/80"
									>
										Confirm Password
									</label>
									<div className="relative">
										<Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
										<input
											id="confirmPassword"
											type={showPassword ? "text" : "password"}
											value={confirmPassword}
											onChange={(e) => setConfirmPassword(e.target.value)}
											placeholder="Re-enter your password"
											autoComplete="new-password"
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
											Updating password...
										</>
									) : (
										"Update Password"
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
