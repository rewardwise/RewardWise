/** @format */
"use client";

import { Sparkles } from "lucide-react";
import { TRANSFER_PARTNERS } from "@/utils/transferPartners";

type Recommendation = "use_points" | "pay_cash" | "wait";

export interface AwardProgramOption {
  program: string;
  points: number;
  taxes: number | null;
  cpp: number;
  remaining_seats?: number;
  direct?: boolean;
}

type Props = {
  recommendation: Recommendation;
  operatingAirline: string | null;
  awardOptions: AwardProgramOption[];
  userPrograms: string[];
  travelers: number;
};

function fmtProgram(s?: string | null) {
  const raw = (s || "").replace(/_/g, " ").trim();
  if (!raw) return "";
  const normalized = raw.toLowerCase();
  const special: Record<string, string> = {
    flyingblue: "Flying Blue",
    "flying blue": "Flying Blue",
    virginatlantic: "Virgin Atlantic",
    "virgin atlantic": "Virgin Atlantic",
    "american airlines": "American Airlines",
    "british airways": "British Airways",
  };
  if (special[normalized]) return special[normalized];
  return raw
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function joinPrograms(names: string[]) {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} or ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, or ${names[names.length - 1]}`;
}

function valueBadge(cpp: number): { label: string; tone: string } | null {
  if (cpp >= 2.0) return { label: "Excellent value", tone: "border-emerald-400/30 bg-emerald-500/15 text-emerald-200" };
  if (cpp >= 1.5) return { label: "Strong value", tone: "border-sky-400/30 bg-sky-500/15 text-sky-200" };
  if (cpp >= 1.2) return { label: "Decent value", tone: "border-amber-400/30 bg-amber-500/15 text-amber-200" };
  return null;
}

export default function AwardDetailsSection({
  recommendation,
  operatingAirline,
  awardOptions,
  userPrograms,
  travelers,
}: Props) {
  if (recommendation !== "use_points") return null;

  const walletSet = new Set(userPrograms.map((p) => p.toLowerCase()));
  const inWallet = awardOptions.filter((opt) => walletSet.has(opt.program.toLowerCase()));
  const programsToShow = inWallet.length > 0 ? inWallet : awardOptions.slice(0, 1);
  if (programsToShow.length === 0) return null;

  const programNames = programsToShow.map((opt) => fmtProgram(opt.program));
  const headerProgramText = joinPrograms(programNames);

  const best = programsToShow[0];
  const totalPoints = best.points * travelers;
  const taxes = best.taxes ?? 0;
  const seats = best.remaining_seats;
  const badge = valueBadge(best.cpp);

  const bestSlug = best.program.toLowerCase();
  const isNativeHeld = walletSet.has(bestSlug);
  const allPartners = TRANSFER_PARTNERS[bestSlug] ?? [];
  const filteredPartners = userPrograms.length > 0
    ? allPartners.filter((p) => walletSet.has(p.sourceCard.toLowerCase()))
    : allPartners;
  const transferPartners = isNativeHeld ? [] : filteredPartners.slice(0, 3);

  return (
    <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/15">
          <Sparkles className="h-4 w-4 text-emerald-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Award booking
          </p>
          <p className="mt-1 text-lg font-extrabold text-white">
            {operatingAirline ? `${operatingAirline} flight` : "Award flight"}
            {headerProgramText ? (
              <span className="font-medium text-slate-300"> through {headerProgramText}</span>
            ) : null}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {totalPoints.toLocaleString()} points
            {travelers > 1 ? ` (${best.points.toLocaleString()} × ${travelers})` : ""}
            {taxes > 0 ? ` plus $${Number(taxes).toFixed(0)} in taxes` : " with no fuel surcharges"}.
          </p>

          {transferPartners.length > 0 ? (
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Transfer from{" "}
              {transferPartners.map((p, i) => (
                <span key={p.short}>
                  <span className="font-semibold text-slate-200">{p.short}</span>{" "}
                  ({p.ratio}{p.speed === "instant" ? "" : `, ${p.speed}`})
                  {i < transferPartners.length - 1 ? ", " : ""}
                </span>
              ))}.
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {seats != null && seats > 0 ? (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-200">
                {seats} seat{seats !== 1 ? "s" : ""} left
              </span>
            ) : null}
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-200">
              {best.cpp.toFixed(2)} ¢/pt
            </span>
            {badge ? (
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badge.tone}`}>
                {badge.label}
              </span>
            ) : null}
          </div>

          {programsToShow.length > 1 ? (
            <p className="mt-4 text-xs leading-5 text-slate-500">
              Other in-wallet programs that book this flight: {joinPrograms(programNames.slice(1))}.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
