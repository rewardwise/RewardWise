/** @format */

"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FcGoogle } from "react-icons/fc";
import {
	ArrowLeft,
	Eye,
	EyeOff,
	Loader2,
	Lock,
	Mail,
	Plane,
} from "lucide-react";

import { useAuth } from "@/context/AuthProvider";
import { validateSignupEmail } from "@/utils/emailValidation";
import { LOGIN_GOOGLE_FAIL } from "@/utils/user-messages";

type MessageTone = "success" | "error";

/**
 * Post-signup destination. Honors a `?returnTo=` deep link (e.g. the guest
 * verdict's "Connect your wallet" CTA in 8c) so the user lands back where they
 * were. Guarded to INTERNAL paths only — a single leading "/" and not "//" — so
 * it can't be turned into an open redirect. Falls back to /home.
 */
function safePostSignupDestination(): string {
	if (typeof window === "undefined") return "/home";
	const rt = new URLSearchParams(window.location.search).get("returnTo");
	if (rt && rt.startsWith("/") && !rt.startsWith("//")) return rt;
	return "/home";
}

export default function SignupPage() {
	const router = useRouter();
	const { signInWithGoogle, signUpWithEmail, user, loading: authLoading } =
		useAuth();

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [submittingEmail, setSubmittingEmail] = useState(false);
	const [submittingGoogle, setSubmittingGoogle] = useState(false);
	const [message, setMessage] = useState<string>("");
	const [messageTone, setMessageTone] = useState<MessageTone>("success");

	useEffect(() => {
		if (!authLoading && user) {
			router.replace(safePostSignupDestination());
		}
	}, [authLoading, router, user]);

	const validate = () => {
		const nextErrors: Record<string, string> = {};

		const emailError = validateSignupEmail(email);
		if (emailError) {
			nextErrors.email = emailError;
		}

		if (!password) {
			nextErrors.password = "Password is required.";
		} else if (password.length < 8) {
			nextErrors.password = "Password must be at least 8 characters long.";
		}

		setErrors(nextErrors);
		return Object.keys(nextErrors).length === 0;
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setMessage("");

		if (!validate()) return;

		setSubmittingEmail(true);
		setErrors({});

		const { error } = await signUpWithEmail(email.trim(), password);

		if (error) {
			setMessageTone("error");
			setMessage(error.message);
			setSubmittingEmail(false);
			return;
		}

		setMessageTone("success");
		setMessage("Check your email to confirm your account, then come back and sign in.");
		setSubmittingEmail(false);
	};

	const handleGoogleSignup = async () => {
		try {
			setSubmittingGoogle(true);
			setErrors({});
			setMessage("");
			await signInWithGoogle();
		} catch {
			setMessageTone("error");
			setMessage(LOGIN_GOOGLE_FAIL);
			setSubmittingGoogle(false);
		}
	};

	if (authLoading) {
		return (
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
		);
	}

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
						onClick={() => router.push("/")}
						className="mb-6 inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white"
					>
						<ArrowLeft className="h-4 w-4" />
						Back
					</button>

					<div className="mb-6 flex items-center gap-2">
						<Plane className="h-5 w-5 text-white" />
						<span className="text-base font-semibold tracking-tight text-white">
							MyTravelWallet
						</span>
					</div>

					<h1 className="text-3xl font-bold tracking-tight text-white">
						Create your account
					</h1>

					<p className="mt-2 text-sm leading-6 text-white/65">
						Start using MyTravelWallet to compare points versus cash and make smarter travel decisions.
					</p>

					{message ? (
						<div
							className={`mt-5 rounded-xl border px-4 py-3 text-sm ${
								messageTone === "success"
									? "border-emerald-300/20 bg-emerald-300/10 text-emerald-50"
									: "border-red-400/25 bg-red-400/10 text-red-100"
							}`}
						>
							{message}
						</div>
					) : null}

					{Object.keys(errors).length > 0 ? (
						<div
							role="alert"
							className="mt-5 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3"
						>
							<ul className="space-y-1 text-sm text-red-100">
								{Object.values(errors).map((error, index) => (
									<li key={index}>{error}</li>
								))}
							</ul>
						</div>
					) : null}

					<div className="mt-6">
						<button
							type="button"
							onClick={handleGoogleSignup}
							disabled={submittingGoogle || submittingEmail}
							className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/12 bg-white/6 px-4 py-3.5 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
						>
							{submittingGoogle ? (
								<>
									<Loader2 className="h-4 w-4 animate-spin" />
									Redirecting...
								</>
							) : (
								<>
									<FcGoogle size={18} />
									Continue with Google
								</>
							)}
						</button>
					</div>

					<div className="my-6 flex items-center">
						<div className="h-px flex-1 bg-white/10" />
						<span className="px-3 text-xs uppercase tracking-[0.12em] text-white/30">
							Or use email
						</span>
						<div className="h-px flex-1 bg-white/10" />
					</div>

					<form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
									onChange={(event) => setEmail(event.target.value)}
									placeholder="name@example.com"
									autoComplete="email"
									className={`w-full rounded-xl border bg-white/7 py-3 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-white/24 focus:bg-white/10 ${
										errors.email
											? "border-red-400/40"
											: "border-white/12 focus:border-[rgba(34,197,94,0.45)]"
									}`}
								/>
							</div>
						</div>

						<div>
							<label
								htmlFor="password"
								className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#86EFAC]/80"
							>
								Password
							</label>

							<div className="relative">
								<Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
								<input
									id="password"
									type={showPassword ? "text" : "password"}
									value={password}
									onChange={(event) => setPassword(event.target.value)}
									placeholder="At least 8 characters"
									autoComplete="new-password"
									className={`w-full rounded-xl border bg-white/7 py-3 pl-10 pr-12 text-sm text-white outline-none transition placeholder:text-white/24 focus:bg-white/10 ${
										errors.password
											? "border-red-400/40"
											: "border-white/12 focus:border-[rgba(34,197,94,0.45)]"
									}`}
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

						<button
							type="submit"
							disabled={submittingEmail || submittingGoogle}
							className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#22C55E] px-5 py-3.5 text-sm font-semibold text-[#08111F] transition hover:bg-[#16A34A] disabled:cursor-not-allowed disabled:opacity-70"
						>
							{submittingEmail ? (
								<>
									<Loader2 className="h-4 w-4 animate-spin" />
									Creating account...
								</>
							) : (
								"Create account"
							)}
						</button>
					</form>

					<p className="mt-5 text-center text-sm text-white/45">
						Already have an account?{" "}
						<button
							onClick={() => router.push("/login")}
							className="font-medium text-[#86EFAC] transition hover:text-[#bbf7d0]"
						>
							Sign in
						</button>
					</p>
				</div>
			</div>
		</div>
	);
}
