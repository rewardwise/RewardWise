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
import { AuthBackdrop, AuthLoading } from "@/components/AuthShell";
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
		return <AuthLoading />;
	}

	return (
		<div className="font-mtw relative isolate min-h-screen overflow-hidden text-mtw-ink">
			<AuthBackdrop />

			<div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-10">
				<div
					data-testid="auth-card"
					className="w-full max-w-md rounded-mtw-lg border border-mtw-border bg-white p-7 shadow-mtw-ambient sm:p-8"
				>
					<button
						onClick={() => router.push("/")}
						className="mb-6 inline-flex items-center gap-2 text-mtw-small text-mtw-muted transition-colors hover:text-mtw-ink"
					>
						<ArrowLeft className="h-4 w-4" />
						Back
					</button>

					<div className="mb-6 flex items-center gap-2">
						<Plane className="h-5 w-5 text-mtw-emerald" />
						<span className="text-mtw-body font-semibold tracking-tight text-mtw-ink">
							MyTravelWallet
						</span>
					</div>

					<h1 className="text-mtw-headline font-bold text-mtw-ink-strong">
						Create your account
					</h1>

					<p className="mt-2 text-mtw-small leading-6 text-mtw-muted">
						Start using MyTravelWallet to compare points versus cash and make smarter travel decisions.
					</p>

					{message ? (
						<div
							className={`mt-5 rounded-mtw border px-4 py-3 text-mtw-small ${
								messageTone === "success"
									? "border-mtw-emerald/30 bg-mtw-emerald/10 text-mtw-emerald"
									: "border-red-200 bg-red-50 text-red-700"
							}`}
						>
							{message}
						</div>
					) : null}

					{Object.keys(errors).length > 0 ? (
						<div
							role="alert"
							className="mt-5 rounded-mtw border border-red-200 bg-red-50 px-4 py-3"
						>
							<ul className="space-y-1 text-mtw-small text-red-700">
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
							className="flex w-full items-center justify-center gap-3 rounded-mtw border border-mtw-border bg-white px-4 py-3.5 text-mtw-small font-medium text-mtw-ink transition-colors hover:bg-mtw-surface disabled:cursor-not-allowed disabled:opacity-70"
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
						<div className="h-px flex-1 bg-mtw-border" />
						<span className="px-3 text-mtw-label uppercase text-mtw-muted">
							Or use email
						</span>
						<div className="h-px flex-1 bg-mtw-border" />
					</div>

					<form onSubmit={handleSubmit} className="space-y-4" noValidate>
						<div>
							<label
								htmlFor="email"
								className="mb-2 block text-mtw-label uppercase text-mtw-muted"
							>
								Email
							</label>

							<div className="relative">
								<Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mtw-muted" />
								<input
									id="email"
									type="email"
									value={email}
									onChange={(event) => setEmail(event.target.value)}
									placeholder="name@example.com"
									autoComplete="email"
									className={`w-full rounded-mtw border bg-white py-3 pl-10 pr-4 text-mtw-small text-mtw-ink outline-none transition placeholder:text-mtw-muted focus:ring-2 focus:ring-mtw-emerald ${
										errors.email ? "border-red-300" : "border-mtw-border"
									}`}
								/>
							</div>
						</div>

						<div>
							<label
								htmlFor="password"
								className="mb-2 block text-mtw-label uppercase text-mtw-muted"
							>
								Password
							</label>

							<div className="relative">
								<Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mtw-muted" />
								<input
									id="password"
									type={showPassword ? "text" : "password"}
									value={password}
									onChange={(event) => setPassword(event.target.value)}
									placeholder="At least 8 characters"
									autoComplete="new-password"
									className={`w-full rounded-mtw border bg-white py-3 pl-10 pr-12 text-mtw-small text-mtw-ink outline-none transition placeholder:text-mtw-muted focus:ring-2 focus:ring-mtw-emerald ${
										errors.password ? "border-red-300" : "border-mtw-border"
									}`}
								/>

								<button
									type="button"
									onClick={() => setShowPassword((prev) => !prev)}
									className="absolute right-3 top-1/2 -translate-y-1/2 text-mtw-muted transition-colors hover:text-mtw-ink"
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
							className="inline-flex w-full items-center justify-center gap-2 rounded-mtw bg-mtw-emerald px-5 py-3.5 text-mtw-small font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
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

					<p className="mt-5 text-center text-mtw-small text-mtw-muted">
						Already have an account?{" "}
						<button
							onClick={() => router.push("/login")}
							className="font-medium text-mtw-emerald transition-opacity hover:opacity-80"
						>
							Sign in
						</button>
					</p>
				</div>
			</div>
		</div>
	);
}
