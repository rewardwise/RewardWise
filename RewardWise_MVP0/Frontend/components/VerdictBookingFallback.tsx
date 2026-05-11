/** @format */
"use client";

import { ExternalLink } from "lucide-react";
import { fmtMoney } from "@/utils/format";
import { logHandoffClick } from "@/utils/analytics";

type Props = {
	airlineName: string;
	airlineDomain: string;
	origin: string;
	destination: string;
	departDate: string;
	returnDate?: string | null;
	travelers: number;
	cabin?: string;
	verdictType: "cash" | "points";
	amountCash?: number;
	amountPoints?: number;
	pointsProgram?: string;
	taxes?: number;
	airlineUrl: string;
	program: string;
};

function formatDate(d: string) {
	const [year, month, day] = d.split("-").map(Number);
	if (!year || !month || !day) return d;
	return new Date(year, month - 1, day).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export default function VerdictBookingFallback({
	airlineName,
	airlineDomain,
	origin,
	destination,
	departDate,
	returnDate,
	travelers,
	cabin,
	verdictType,
	amountCash,
	amountPoints,
	pointsProgram,
	taxes,
	airlineUrl,
	program,
}: Props) {
	const travelerLabel = `${travelers} traveler${travelers > 1 ? "s" : ""}`;
	const cabinLabel = cabin || "economy";
	const dateLine = `${origin} → ${destination} · ${formatDate(departDate)}${
		returnDate ? ` → ${formatDate(returnDate)}` : ""
	}`;

	const handleClick = () => {
		logHandoffClick({
			program,
			origin,
			destination,
			depart_date: departDate,
			return_date: returnDate ?? null,
			travelers,
			cabin,
			verdict_type: verdictType,
			amount_cash: amountCash,
			amount_points: amountPoints,
			taxes,
		});
	};

	const headline =
		verdictType === "cash"
			? `Book this trip on ${airlineName}:`
			: `Use Points on ${airlineName} for this trip:`;

	const amountLine =
		verdictType === "cash"
			? amountCash != null
				? `Cash fare: ${fmtMoney(amountCash)}`
				: null
			: amountPoints != null
				? `Points: ${amountPoints.toLocaleString()}${pointsProgram ? ` ${pointsProgram}` : ""}${
						taxes ? ` + ${fmtMoney(taxes)} taxes` : ""
					}`
				: null;

	const footer =
		verdictType === "cash"
			? `At ${airlineName}'s site, enter your dates and airports to find this fare.`
			: `Log into your ${pointsProgram || airlineName} account and search award availability for these dates.`;

	return (
		<div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-200">
			<p className="font-semibold text-white">{headline}</p>
			<p className="text-slate-300">{dateLine}</p>
			<p className="text-slate-300">
				{travelerLabel}, {cabinLabel}
			</p>
			{amountLine && <p className="text-slate-300">{amountLine}</p>}
			<a
				href={airlineUrl}
				target="_blank"
				rel="noopener noreferrer"
				onClick={handleClick}
				className="mt-2 inline-flex w-fit items-center gap-2 rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-300"
			>
				Open {airlineDomain} <ExternalLink className="h-4 w-4" />
			</a>
			<p className="mt-1 text-xs text-slate-400">{footer}</p>
		</div>
	);
}
