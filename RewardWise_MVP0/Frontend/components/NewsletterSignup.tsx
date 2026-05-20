/** @format */
"use client";

import { useState } from "react";

type UiState =
	| { kind: "idle" }
	| { kind: "loading" }
	| { kind: "success" }
	| { kind: "duplicate" }
	| { kind: "invalid" }
	| { kind: "error" };

export default function NewsletterSignup() {
	const [email, setEmail] = useState("");
	const [state, setState] = useState<UiState>({ kind: "idle" });

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setState({ kind: "loading" });
		try {
			const res = await fetch("/api/newsletter", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: email.trim() }),
			});
			if (res.status === 422) {
				setState({ kind: "invalid" });
				return;
			}
			if (!res.ok) {
				setState({ kind: "error" });
				return;
			}
			const data = await res.json();
			setState({
				kind: data.status === "already_subscribed" ? "duplicate" : "success",
			});
		} catch {
			setState({ kind: "error" });
		}
	}

	const formSwapped = state.kind === "success" || state.kind === "duplicate";

	return (
		<section
			className="mx-auto max-w-2xl px-6 py-16 text-center"
			aria-labelledby="newsletter-heading"
		>
			<h2
				id="newsletter-heading"
				className="text-3xl font-semibold tracking-tight text-white sm:text-4xl"
			>
				Stay in the loop
			</h2>
			<p className="mt-4 text-base leading-7 text-white/65">
				Travel-rewards tips and product updates. We email when we have
				something worth saying.
			</p>

			{formSwapped ? (
				<div
					className="mt-8 rounded-2xl border border-white/12 bg-white/8 px-6 py-5 text-sm text-white/85 backdrop-blur-xl"
					role="status"
				>
					{state.kind === "success"
						? "Thanks, we'll keep you posted."
						: "You're already subscribed. Thanks for sticking with us."}
				</div>
			) : (
				<form
					onSubmit={handleSubmit}
					className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center"
				>
					<label htmlFor="newsletter-email" className="sr-only">
						Email address
					</label>
					<input
						id="newsletter-email"
						type="email"
						required
						value={email}
						onChange={(e) => {
							setEmail(e.target.value);
							if (state.kind === "invalid" || state.kind === "error") {
								setState({ kind: "idle" });
							}
						}}
						placeholder="you@example.com"
						className="w-full rounded-full border border-white/12 bg-white/8 px-5 py-3 text-sm text-white placeholder:text-white/40 backdrop-blur-xl focus:border-[#86EFAC] focus:outline-none sm:w-80"
						disabled={state.kind === "loading"}
					/>
					<button
						type="submit"
						disabled={state.kind === "loading" || !email}
						className="rounded-full bg-[#86EFAC] px-6 py-3 text-sm font-semibold text-[#07101E] transition hover:bg-[#6EE7A0] disabled:opacity-50"
					>
						{state.kind === "loading" ? "Subscribing…" : "Subscribe"}
					</button>
				</form>
			)}

			{state.kind === "invalid" && (
				<p className="mt-3 text-sm text-[#F87171]" role="alert">
					That email doesn't look right. Mind double-checking?
				</p>
			)}
			{state.kind === "error" && (
				<p className="mt-3 text-sm text-[#F87171]" role="alert">
					Something went wrong. Please try again in a moment.
				</p>
			)}
		</section>
	);
}
