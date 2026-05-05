/** @format */

"use client";

import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, Loader2, Plane, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthProvider";

type SubmitState = "idle" | "submitting" | "success" | "error";

function LandingPageInner() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const formRef = useRef<HTMLDivElement | null>(null);
	const { user, loading, signOut } = useAuth();

	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [email, setEmail] = useState("");
	const [submitState, setSubmitState] = useState<SubmitState>("idle");
	const [errorMessage, setErrorMessage] = useState("");
	const [positionNumber, setPositionNumber] = useState<number | null>(null);
	const [signingOutUnauthorized, setSigningOutUnauthorized] = useState(false);

	const accessDenied = searchParams.get("access") === "denied";

	useEffect(() => {
		if (loading) return;

		if (accessDenied && user) {
			setSigningOutUnauthorized(true);
			void signOut().finally(() => {
				setSigningOutUnauthorized(false);
				router.replace("/");
			});
			return;
		}

		if (user && !accessDenied) {
			router.replace("/home");
		}
	}, [accessDenied, loading, router, signOut, user]);

	const scrollToForm = () => {
		formRef.current?.scrollIntoView({
			behavior: "smooth",
			block: "center",
		});
	};

	const handleAuthorizedTesterAccess = () => {
		router.push(user ? "/home" : "/login");
	};

	const validateEmail = (value: string) => {
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
	};

	const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		const trimmedFirst = firstName.trim();
		const trimmedLast = lastName.trim();
		const trimmedEmail = email.trim();
		const sheetUrl = process.env.NEXT_PUBLIC_WAITLIST_SHEET_URL?.trim();

		setErrorMessage("");

		if (!trimmedFirst) {
			setSubmitState("error");
			setErrorMessage("Please enter your first name.");
			return;
		}

		if (!trimmedLast) {
			setSubmitState("error");
			setErrorMessage("Please enter your last name.");
			return;
		}

		if (!validateEmail(trimmedEmail)) {
			setSubmitState("error");
			setErrorMessage("Please enter a valid email address.");
			return;
		}

		if (!sheetUrl) {
			setSubmitState("error");
			setErrorMessage(
				"Waitlist form is not configured yet. Add NEXT_PUBLIC_WAITLIST_SHEET_URL.",
			);
			return;
		}

		setSubmitState("submitting");

		try {
			await fetch(sheetUrl, {
				method: "POST",
				mode: "no-cors",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					firstName: trimmedFirst,
					lastName: trimmedLast,
					email: trimmedEmail,
				}),
			});

			setPositionNumber(Math.floor(Math.random() * 150) + 250);
			setSubmitState("success");
		} catch {
			setSubmitState("error");
			setErrorMessage("Something went wrong. Please try again.");
		}
	};

	if (loading || signingOutUnauthorized) {
		return (
			<div className="relative min-h-screen overflow-hidden bg-[#080E1C] text-white">
				<div
					className="absolute inset-0 bg-cover bg-center"
					style={{
						backgroundImage: "url('/beach-hero.png')",
					}}
				/>
				<div className="absolute inset-0 bg-[rgba(8,14,28,0.38)]" />
				<div className="relative z-10 flex min-h-screen items-center justify-center px-6">
					<div className="flex items-center gap-3 rounded-full border border-white/12 bg-[rgba(8,14,28,0.74)] px-5 py-3 text-sm text-white/80 backdrop-blur-xl">
						<Loader2 className="h-4 w-4 animate-spin" />
						{signingOutUnauthorized ? "Resetting access..." : "Loading..."}
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="relative min-h-screen overflow-hidden bg-[#080E1C] text-white">
			<div
				className="absolute inset-0 bg-cover bg-center"
				style={{
					backgroundImage: "url('/beach-hero.png')",
				}}
			/>
			<div className="absolute inset-0 bg-[rgba(8,14,28,0.38)]" />
			<div className="absolute inset-0 bg-gradient-to-br from-[rgba(8,14,28,0.55)] via-[rgba(8,14,28,0.22)] to-[rgba(8,14,28,0.5)]" />

			<div className="relative z-10">
				<header className="sticky top-0 z-20 border-b border-white/8 bg-[rgba(8,14,28,0.18)] backdrop-blur-xl">
					<div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6">
						<div className="flex items-center gap-2">
							<Plane className="h-5 w-5 text-white" />
							<span className="text-[15px] font-semibold tracking-tight text-white">
								MyTravelWallet
							</span>
						</div>

						<div className="flex items-center gap-2">
							<button
								onClick={handleAuthorizedTesterAccess}
								className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/7 px-4 py-2 text-sm font-semibold text-white/78 transition hover:bg-white/12 hover:text-white"
							>
								Authorized Testers
								<ArrowRight className="h-4 w-4" />
							</button>

							<button
								onClick={scrollToForm}
								className="inline-flex items-center gap-2 rounded-full border border-[rgba(34,197,94,0.28)] bg-[rgba(34,197,94,0.12)] px-4 py-2 text-sm font-semibold text-[#86EFAC] transition hover:bg-[rgba(34,197,94,0.18)]"
							>
								Join Waitlist
								<ArrowRight className="h-4 w-4" />
							</button>
						</div>
					</div>
				</header>

				<main className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-7xl items-center px-6 py-12 sm:py-16">
					<div className="grid w-full items-start gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
						<section className="max-w-2xl">
							{accessDenied ? (
								<div className="mb-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-50 backdrop-blur-xl">
									That account does not have access to MyTravelWallet.
								</div>
							) : null}

							<div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[rgba(34,197,94,0.24)] bg-[rgba(34,197,94,0.1)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#86EFAC]">
								<Sparkles className="h-3.5 w-3.5" />
								Early Access Now Open
							</div>

							<h1 className="max-w-3xl text-4xl font-bold leading-[1.02] tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
								Travel smarter.
								<br />
								Spend wiser.
								<br />
								<span className="text-[#86EFAC]">One verdict.</span>
							</h1>

							<p className="mt-6 max-w-xl text-base leading-7 text-white/72 sm:text-lg">
								MyTravelWallet reads your full rewards wallet across cards,
								airlines, and hotels, then tells you the smartest move in
								seconds — use points, pay cash, or save them for later.
							</p>

							<div className="mt-8 flex flex-wrap gap-3">
								<button
									onClick={scrollToForm}
									className="inline-flex items-center gap-2 rounded-full bg-[#22C55E] px-5 py-3 text-sm font-semibold text-[#08111F] transition hover:bg-[#16A34A]"
								>
									Get Started
									<ArrowRight className="h-4 w-4" />
								</button>

								<div className="inline-flex items-center rounded-full border border-white/14 bg-white/6 px-4 py-3 text-sm text-white/70">
									Early Access has now begun!
								</div>
							</div>

							{/* <div className="mt-10 max-w-xl rounded-2xl border border-white/12 bg-[rgba(8,14,28,0.74)] p-5 shadow-2xl shadow-black/25 backdrop-blur-2xl">
								<div className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white/28">
									Example verdict
								</div>

								<div className="mb-3 rounded-xl border border-white/8 bg-white/4 px-4 py-3 font-mono text-sm text-white/76">
									&quot;NYC to London, business, Feb 14–21&quot;
								</div>

								<div className="grid gap-3 sm:grid-cols-2">
									<div className="rounded-xl border border-[rgba(34,197,94,0.16)] bg-[rgba(34,197,94,0.06)] p-4">
										<div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#86EFAC]">
											Award
										</div>
										<div className="text-sm font-semibold text-white">
											United Polaris
										</div>
										<div className="mt-1 text-sm text-white/68">
											84,000 miles + $56
										</div>
										<div className="mt-2 text-xs font-medium text-[#86EFAC]">
											1.8¢/pt · $1,512 value
										</div>
									</div>

									<div className="rounded-xl border border-white/8 bg-white/4 p-4">
										<div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/28">
											Cash
										</div>
										<div className="text-sm font-semibold text-white">
											British Airways
										</div>
										<div className="mt-1 text-sm text-white/68">
											$1,847 · nonstop
										</div>
										<div className="mt-2 text-xs text-white/42">
											7h 5m direct
										</div>
									</div>
								</div>

								<div className="mt-4 flex items-start gap-3 rounded-xl border border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.08)] px-4 py-3">
									<div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#22C55E]/16">
										<Check className="h-3.5 w-3.5 text-[#86EFAC]" />
									</div>
									<div>
										<div className="text-sm font-semibold text-[#86EFAC]">
											Use your miles — save about $1,400
										</div>
										<div className="mt-1 text-xs text-[#bbf7d0]/70">
											1.8¢/pt is above your 1.0¢ floor, so the points booking is
											the stronger move.
										</div>
									</div>
								</div>
							</div> */}

							<div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
								<div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
									<div className="text-2xl font-bold text-white">$48B</div>
									<div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-white/34">
										Points expire yearly
									</div>
								</div>

								<div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
									<div className="text-2xl font-bold text-white">73%</div>
									<div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-white/34">
										Unsure what&apos;s worth using
									</div>
								</div>

								<div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
									<div className="text-2xl font-bold text-white">&lt;3s</div>
									<div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-white/34">
										To your decision
									</div>
								</div>
							</div>
						</section>

						<section ref={formRef} className="w-full lg:pt-6">
							<div className="rounded-[26px] border border-white/12 bg-[rgba(8,14,28,0.74)] p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl sm:p-8">
								{submitState === "success" ? (
									<div className="flex flex-col items-center text-center">
										<div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(34,197,94,0.24)] bg-[rgba(34,197,94,0.08)]">
											<Check className="h-6 w-6 text-[#22C55E]" />
										</div>

										<h2 className="text-2xl font-bold tracking-tight text-white">
											You&apos;re in! 🎉
										</h2>

										<p className="mt-2 text-sm font-medium text-[#86EFAC]">
											Welcome, {firstName.trim()} 👋
										</p>

										<p className="mt-3 max-w-sm text-sm leading-6 text-white/68">
											Welcome to MyTravelWallet. Get ready to stop leaving
											points and miles on the table.
										</p>

										<div className="mt-6 w-full rounded-2xl border border-white/10 bg-white/4 p-5 text-left">
											<div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#86EFAC]">
												What happens next
											</div>

											<div className="space-y-3 text-sm text-white/72">
												<div className="flex items-center gap-3">
													<div className="flex h-6 w-6 items-center justify-center rounded-full border border-[rgba(34,197,94,0.24)] bg-[rgba(34,197,94,0.08)] text-[11px] font-semibold text-[#86EFAC]">
														1
													</div>
													<span>Confirmation lands in your inbox</span>
												</div>

												<div className="flex items-center gap-3">
													<div className="flex h-6 w-6 items-center justify-center rounded-full border border-[rgba(34,197,94,0.24)] bg-[rgba(34,197,94,0.08)] text-[11px] font-semibold text-[#86EFAC]">
														2
													</div>
													<span>
														We send your access link when your spot opens
													</span>
												</div>

												<div className="flex items-center gap-3">
													<div className="flex h-6 w-6 items-center justify-center rounded-full border border-[rgba(34,197,94,0.24)] bg-[rgba(34,197,94,0.08)] text-[11px] font-semibold text-[#86EFAC]">
														3
													</div>
													<span>
														Log in, connect your wallet, get your first verdict
													</span>
												</div>
											</div>
										</div>

										{positionNumber ? (
											<div className="mt-5 rounded-full border border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.08)] px-4 py-2 font-mono text-xs text-[#86EFAC]">
												Position #{positionNumber} secured
											</div>
										) : null}
									</div>
								) : (
									<>
										<div className="mb-6">
											<div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#86EFAC]">
												Join the waitlist
											</div>
											<h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-[30px]">
												Secure your spot.
											</h2>
											<p className="mt-3 text-sm leading-6 text-white/68">
												We&apos;ll reach out as soon as
												you&apos;re ready to explore.
											</p>
										</div>

										<form onSubmit={handleSubmit} className="space-y-4">
											<div className="grid gap-4 sm:grid-cols-2">
												<div>
													<label
														htmlFor="firstName"
														className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#86EFAC]/80"
													>
														First Name
													</label>
													<input
														id="firstName"
														type="text"
														value={firstName}
														onChange={(e) => setFirstName(e.target.value)}
														placeholder="First name"
														autoComplete="given-name"
														className="w-full rounded-xl border border-white/12 bg-white/7 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/24 focus:border-[rgba(34,197,94,0.45)] focus:bg-white/10"
													/>
												</div>

												<div>
													<label
														htmlFor="lastName"
														className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#86EFAC]/80"
													>
														Last Name
													</label>
													<input
														id="lastName"
														type="text"
														value={lastName}
														onChange={(e) => setLastName(e.target.value)}
														placeholder="Last name"
														autoComplete="family-name"
														className="w-full rounded-xl border border-white/12 bg-white/7 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/24 focus:border-[rgba(34,197,94,0.45)] focus:bg-white/10"
													/>
												</div>
											</div>

											<div>
												<label
													htmlFor="email"
													className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#86EFAC]/80"
												>
													Email Address
												</label>
												<input
													id="email"
													type="email"
													value={email}
													onChange={(e) => setEmail(e.target.value)}
													placeholder="you@example.com"
													autoComplete="email"
													className="w-full rounded-xl border border-white/12 bg-white/7 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/24 focus:border-[rgba(34,197,94,0.45)] focus:bg-white/10"
												/>
											</div>

											<button
												type="submit"
												disabled={submitState === "submitting"}
												className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#22C55E] px-5 py-3.5 text-sm font-semibold text-[#08111F] transition hover:bg-[#16A34A] disabled:cursor-not-allowed disabled:opacity-70"
											>
												{submitState === "submitting" ? (
													<>
														<Loader2 className="h-4 w-4 animate-spin" />
														Securing your spot...
													</>
												) : (
													<>
														Get Started
														<ArrowRight className="h-4 w-4" />
													</>
												)}
											</button>
										</form>

										{submitState === "error" && errorMessage ? (
											<div className="mt-4 rounded-xl border border-red-400/22 bg-red-400/8 px-4 py-3 text-sm text-red-100">
												{errorMessage}
											</div>
										) : null}

										<p className="mt-4 text-center text-xs leading-5 text-white/40">
											No spam, ever. You&apos;ll only hear from us when your
											spot is ready.
										</p>

										<div className="mt-3 text-center text-[11px] text-white/26">
											Responses saved securely to Google Sheets
										</div>
									</>
								)}
							</div>
						</section>
					</div>
				</main>

				<footer className="border-t border-white/8">
					<div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-6 py-5 text-sm text-white/34 sm:flex-row sm:items-center sm:justify-between">
						<p>© 2026 MyTravelWallet · One verdict, not 47 options.</p>
						<a
							href="https://www.linkedin.com/company/mytravelwallet-ai/"
							target="_blank"
							rel="noreferrer"
							className="transition hover:text-[#86EFAC]"
						>
							LinkedIn
						</a>
					</div>
				</footer>
			</div>
		</div>
	);
}


export default function LandingPage() {
	return (
		<Suspense
			fallback={
				<div className="relative min-h-screen overflow-hidden bg-[#080E1C] text-white">
					<div
						className="absolute inset-0 bg-cover bg-center"
						style={{ backgroundImage: "url('/beach-hero.png')" }}
					/>
					<div className="absolute inset-0 bg-[rgba(8,14,28,0.38)]" />
					<div className="relative z-10 flex min-h-screen items-center justify-center px-6">
						<div className="flex items-center gap-3 rounded-full border border-white/12 bg-[rgba(8,14,28,0.74)] px-5 py-3 text-sm text-white/80 backdrop-blur-xl">
							<Loader2 className="h-4 w-4 animate-spin" />
							Loading...
						</div>
					</div>
				</div>
			}
		>
			<LandingPageInner />
		</Suspense>
	);
}
