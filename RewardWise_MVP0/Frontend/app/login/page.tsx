/** @format */

"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/context/AuthProvider";
import {
	ArrowLeft,
	Eye,
	EyeOff,
	Loader2,
	Lock,
	Mail,
	Plane,
} from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import {
	LOGIN_GOOGLE_FAIL,
	mapSupabaseSignInError,
} from "@/utils/user-messages";

/**
 * Full-bleed island backdrop for the auth pages (island spec v2). Photo +
 * flat rgba(6,20,14,.50) scrim so the centered solid-white card pops. The
 * card provides its own contrast; no bare text sits on the photo.
 */
function AuthBackdrop() {
	return (
		<>
			<Image
				src="/hero-island.jpg"
				alt=""
				fill
				priority
				sizes="100vw"
				className="-z-10 object-cover object-center"
			/>
			<div className="absolute inset-0 -z-10 bg-[rgba(6,20,14,0.50)]" />
		</>
	);
}

function AuthLoading() {
	return (
		<div className="font-mtw relative isolate min-h-screen overflow-hidden">
			<AuthBackdrop />
			<div className="relative z-10 flex min-h-screen items-center justify-center px-6">
				<div className="flex items-center gap-3 rounded-mtw-pill border border-mtw-border bg-white px-5 py-3 text-mtw-small text-mtw-ink shadow-mtw-ambient">
					<Loader2 className="h-4 w-4 animate-spin text-mtw-emerald" />
					Loading...
				</div>
			</div>
		</div>
	);
}

function LoginPageInner() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { signInWithEmail, signInWithGoogle, user, loading: authLoading } =
		useAuth();

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [submittingEmail, setSubmittingEmail] = useState(false);
	const [submittingGoogle, setSubmittingGoogle] = useState(false);

	const callbackError = searchParams.get("error");
	const accessDenied = searchParams.get("access") === "denied";

	const callbackMessage = useMemo(() => {
		if (callbackError === "auth_callback_error") {
			return "We couldn’t complete sign in. Please try again.";
		}

		if (accessDenied) {
			return "That account is not approved for access right now.";
		}

		return "";
	}, [accessDenied, callbackError]);

	useEffect(() => {
		if (!authLoading && user) {
			router.replace("/home");
		}
	}, [authLoading, user, router]);

	const validate = () => {
		const nextErrors: Record<string, string> = {};

		if (!email.trim()) {
			nextErrors.email = "Email address is required.";
		}

		if (!password) {
			nextErrors.password = "Password is required.";
		}

		setErrors(nextErrors);
		return Object.keys(nextErrors).length === 0;
	};

	const handleEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (!validate()) return;

		setSubmittingEmail(true);
		setErrors({});

		const { error } = await signInWithEmail(email.trim(), password);

		if (error) {
			setErrors({
				general: mapSupabaseSignInError(error.message),
			});
			setSubmittingEmail(false);
			return;
		}

		router.push("/home");
	};

	const handleGoogleSignIn = async () => {
		try {
			setSubmittingGoogle(true);
			setErrors({});
			await signInWithGoogle();
		} catch {
			setErrors({
				general: LOGIN_GOOGLE_FAIL,
			});
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
						Welcome back
					</h1>

					<p className="mt-2 text-mtw-small leading-6 text-mtw-muted">
						Sign in to access your wallet, search trips, and get your points-versus-cash verdicts.
					</p>

					{callbackMessage ? (
						<div className="mt-5 rounded-mtw border border-amber-300 bg-amber-50 px-4 py-3 text-mtw-small text-amber-900">
							{callbackMessage}
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
							onClick={handleGoogleSignIn}
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

					<form onSubmit={handleEmailSubmit} className="space-y-4" noValidate>
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
									placeholder="Enter your password"
									autoComplete="current-password"
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

						<div className="flex justify-end">
							<button
								type="button"
								onClick={() => router.push("/forgot-password")}
								className="text-mtw-small font-medium text-mtw-emerald transition-opacity hover:opacity-80"
							>
								Forgot password?
							</button>
						</div>

						<button
							type="submit"
							disabled={submittingEmail || submittingGoogle}
							className="inline-flex w-full items-center justify-center gap-2 rounded-mtw bg-mtw-emerald px-5 py-3.5 text-mtw-small font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
						>
							{submittingEmail ? (
								<>
									<Loader2 className="h-4 w-4 animate-spin" />
									Signing in...
								</>
							) : (
								"Sign in"
							)}
						</button>
					</form>

					<p className="mt-5 text-center text-mtw-small text-mtw-muted">
						Don’t have an account?{" "}
						<button
							onClick={() => router.push("/signup")}
							className="font-medium text-mtw-emerald transition-opacity hover:opacity-80"
						>
							Create one
						</button>
					</p>
				</div>
			</div>
		</div>
	);
}

export default function LoginPage() {
	return (
		<Suspense fallback={<AuthLoading />}>
			<LoginPageInner />
		</Suspense>
	);
}
