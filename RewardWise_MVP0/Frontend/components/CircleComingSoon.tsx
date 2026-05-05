/** @format */

"use client";

// CircleComingSoon.tsx
//
// Aspirational sketch of the Circle concept. Framed as an idea-in-exploration,
// not a feature being promised — so beta users paying for the current product
// don't form expectations we haven't committed to. The privacy / consent model
// is shown, not claimed; specific savings figures are deliberately omitted.
//
// All copy lives in the CONTENT object at the top — change there, not in JSX.
// When the real Circle ships, this file can be deleted.

import React from "react";

// ---------------------------------------------------------------------------
// Content config
// ---------------------------------------------------------------------------
const CONTENT = {
	status: "An idea we're exploring",
	headline: ["Could your family and friends", "help you book smarter?"],
	subhead:
		"Sometimes the best points aren't yours. Circle would let you and people you trust pool your loyalty programs — so when Zoe finds a great award path, you can ask the right person to book it. We're sketching how this could work.",
	steps_eyebrow: "How we're thinking about it",
	steps: [
		{
			id: "invite",
			visual: "avatars",
			title: "1 · Invite your trusted few",
			body:
				"A spouse, a sibling, a close friend. Small circle, high trust — not a social network.",
		},
		{
			id: "consent",
			visual: "consent_toggles",
			title: "2 · You decide what's visible",
			body:
				"Choose which programs your circle can see — by program, not all-or-nothing. Balances and exact amounts stay private; Zoe just knows who has enough to help.",
		},
		{
			id: "suggest",
			visual: "zoe_pill",
			title: "3 · Zoe suggests who can help",
			body:
				"Searching SEA → NRT and short on Alaska miles? If your wife has shared Alaska, Zoe might suggest asking her. You can sort out the cash side however your relationship works.",
		},
		{
			id: "approve",
			visual: "approve_card",
			title: "4 · They review and decide",
			body:
				"No automatic access to anyone's account. The other person sees the request, reviews the trip and cost, and chooses to book or pass.",
		},
	],
	reflection: {
		eyebrow: "Why we think it could matter",
		body:
			'Premium award seats often need a specific program\'s miles — Alaska, ANA, Air France. When you don\'t have the right currency, Zoe\'s best verdict can still be "pay cash." Pooling with even one trusted person can unlock paths that simply aren\'t available to either of you alone. We\'re working out the details — and what\'s safe.',
	},
	construction: {
		emoji: "🚧✨",
		primary: "Still wiring this one up.",
		secondary_prefix:
			"This page is a sketch of an idea — not a feature you're paying for. If it sounds useful, tell us at ",
		feedback_email: "MyTravelWalletAiSupport@gmail.com",
		secondary_suffix: " and shape what we build.",
	},
};

export type CircleComingSoonProps = {
	content?: typeof CONTENT;
	onFeedbackClick?: () => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function CircleComingSoon({
	content = CONTENT,
	onFeedbackClick,
}: CircleComingSoonProps) {
	return (
		<div className="rounded-2xl overflow-hidden min-h-[600px] bg-gradient-to-b from-[#0F172A] to-[#1A2438]">
			<div className="max-w-[920px] mx-auto px-6 sm:px-8 pt-10 pb-9">
				<StatusPill label={content.status} />

				<h1 className="text-4xl font-medium text-white tracking-tight leading-[1.1] mt-5 mb-3.5">
					{content.headline.map((line, i) => (
						<React.Fragment key={i}>
							{line}
							{i < content.headline.length - 1 && <br />}
						</React.Fragment>
					))}
				</h1>

				<p className="text-base text-white/70 leading-relaxed max-w-[580px] mb-9">
					{content.subhead}
				</p>

				<StepsCard eyebrow={content.steps_eyebrow} steps={content.steps} />

				<ReflectionCard reflection={content.reflection} />

				<ConstructionNote
					{...content.construction}
					onFeedbackClick={onFeedbackClick}
				/>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------
function StatusPill({ label }: { label: string }) {
	return (
		<span className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#5BC99B]/10 border border-[#5BC99B]/30 text-[#5BC99B] text-xs font-medium rounded-full uppercase tracking-wider">
			<span
				className="w-[7px] h-[7px] rounded-full bg-[#5BC99B]"
				style={{ boxShadow: "0 0 10px #5BC99B" }}
			/>
			{label}
		</span>
	);
}

function StepsCard({
	eyebrow,
	steps,
}: {
	eyebrow: string;
	steps: typeof CONTENT.steps;
}) {
	return (
		<div className="bg-white/[0.04] border border-white/10 rounded-2xl px-7 py-6 mb-8">
			<div className="text-[11px] tracking-widest text-white/50 uppercase mb-[18px]">
				{eyebrow}
			</div>
			<div className="flex flex-col gap-[18px]">
				{steps.map((step, i) => (
					<div
						key={step.id}
						className={[
							"flex items-center gap-[18px] py-3",
							i < steps.length - 1 ? "border-b border-white/[0.08]" : "",
						].join(" ")}
					>
						<StepVisual variant={step.visual} />
						<div className="flex-1">
							<div className="text-white text-[15px] font-medium mb-[3px]">
								{step.title}
							</div>
							<div className="text-white/60 text-[13px] leading-relaxed">
								{step.body}
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

function StepVisual({ variant }: { variant: string }) {
	if (variant === "avatars") {
		return (
			<div className="relative w-[88px] h-14 flex-shrink-0">
				<Avatar initials="YO" gradient="from-[#4F7EE5] to-[#2E4BA3]" left={0} top={8} />
				<Avatar initials="M" gradient="from-[#5BC99B] to-[#1F6B47]" left={22} top={0} />
				<Avatar initials="D" gradient="from-[#E5A14F] to-[#A36810]" left={44} top={14} />
			</div>
		);
	}

	if (variant === "consent_toggles") {
		return (
			<div className="w-[88px] h-14 flex-shrink-0 flex items-center justify-center">
				<div className="bg-white/[0.06] border border-white/[0.12] rounded-[10px] py-2 px-2.5 min-w-[76px]">
					<div className="flex items-center gap-1.5 mb-1">
						<Toggle on />
						<span className="text-white text-[9px] font-medium">Alaska</span>
					</div>
					<div className="flex items-center gap-1.5">
						<Toggle on={false} />
						<span className="text-white/50 text-[9px]">Amex</span>
					</div>
				</div>
			</div>
		);
	}

	if (variant === "zoe_pill") {
		return (
			<div className="w-[88px] h-14 flex-shrink-0 flex items-center justify-center">
				<div className="bg-[#5BC99B]/[0.12] border border-[#5BC99B]/30 rounded-[10px] py-[7px] px-[11px] inline-flex items-center gap-1.5">
					<span className="text-[13px]">✦</span>
					<span className="text-[#5BC99B] text-[11px] font-medium whitespace-nowrap">
						M can help here
					</span>
				</div>
			</div>
		);
	}

	if (variant === "approve_card") {
		return (
			<div className="w-[88px] h-14 flex-shrink-0 flex items-center justify-center">
				<div className="bg-white/[0.06] border border-white/[0.12] rounded-[10px] py-2 px-2.5 min-w-[70px]">
					<div className="text-white/55 text-[9px] tracking-wider mb-0.5">
						REQUEST
					</div>
					<div className="text-white text-xs font-medium">Approve / decline</div>
				</div>
			</div>
		);
	}

	return null;
}

function Toggle({ on }: { on: boolean }) {
	return (
		<div
			className={[
				"relative w-6 h-3 rounded-full transition-colors",
				on ? "bg-[#5BC99B]" : "bg-white/15",
			].join(" ")}
		>
			<div
				className={[
					"absolute top-[1px] w-2.5 h-2.5 rounded-full transition-all",
					on ? "right-[1px] bg-white" : "left-[1px] bg-white/40",
				].join(" ")}
			/>
		</div>
	);
}

function Avatar({
	initials,
	gradient,
	left,
	top,
}: {
	initials: string;
	gradient: string;
	left: number;
	top: number;
}) {
	return (
		<div
			className={[
				"absolute w-[38px] h-[38px] rounded-full flex items-center justify-center",
				"text-white text-[13px] font-medium border-[1.5px] border-[#1A2438]",
				"bg-gradient-to-br",
				gradient,
			].join(" ")}
			style={{ left, top }}
		>
			{initials}
		</div>
	);
}

function ReflectionCard({
	reflection,
}: {
	reflection: typeof CONTENT.reflection;
}) {
	return (
		<div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl px-[22px] py-[18px] mb-8">
			<div className="text-[11px] tracking-widest text-white/50 uppercase mb-2">
				{reflection.eyebrow}
			</div>
			<p className="text-white/[0.78] text-sm leading-relaxed">
				{reflection.body}
			</p>
		</div>
	);
}

function ConstructionNote({
	emoji,
	primary,
	secondary_prefix,
	feedback_email,
	secondary_suffix,
	onFeedbackClick,
}: typeof CONTENT.construction & { onFeedbackClick?: () => void }) {
	// If onFeedbackClick is provided, render the email as a button (e.g. opens
	// an in-app feedback form). Otherwise, render as a standard mailto link.
	const emailEl = onFeedbackClick ? (
		<button
			type="button"
			onClick={onFeedbackClick}
			className="text-[#5BC99B] hover:underline"
		>
			{feedback_email}
		</button>
	) : (
		<a
			href={`mailto:${feedback_email}?subject=Circle%20feedback`}
			className="text-[#5BC99B] hover:underline"
		>
			{feedback_email}
		</a>
	);

	return (
		<div className="text-center pt-4 px-4 border-t border-white/[0.08]">
			<div className="text-2xl mb-2">{emoji}</div>
			<div className="text-white text-sm font-medium mb-1">{primary}</div>
			<div className="text-white/55 text-[13px] leading-relaxed max-w-[460px] mx-auto">
				{secondary_prefix}
				{emailEl}
				{secondary_suffix}
			</div>
		</div>
	);
}
