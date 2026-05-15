/** @format */
"use client";

import { ExternalLink } from "lucide-react";
import { getProgramHandoffInfo } from "@/utils/airlines";

export interface MultiHandoffProgram {
  program: string;
  points: number;
  taxes: number | null;
}

export interface MultiHandoffCashAirline {
  airline: string;
  cashPrice: number | null;
  bookingUrl?: string | null;
}

type Props = {
  recommendation: "use_points" | "pay_cash";
  programs?: MultiHandoffProgram[];
  cashAirline?: MultiHandoffCashAirline | null;
  bestDate: string;
  routeLabel: string;
  travelersLabel: string;
};

function domainFromUrl(url: string) {
  return url
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

function fmtMoneyShort(amount: number) {
  return `$${amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)}`;
}

export default function MultiHandoffGrid({
  recommendation,
  programs,
  cashAirline,
  bestDate,
  routeLabel,
  travelersLabel,
}: Props) {
  if (recommendation === "use_points") {
    const items = programs ?? [];
    if (items.length === 0) return null;
    return (
      <section className="mt-6">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
          Book through your program
        </p>
        <div className={items.length > 1 ? "grid gap-4 md:grid-cols-2" : "grid gap-4"}>
          {items.map((item) => {
            const { url, displayName } = getProgramHandoffInfo(item.program);
            const linkDomain = url === "#" ? null : domainFromUrl(url);
            const taxesPart =
              item.taxes != null && item.taxes > 0
                ? ` + ${fmtMoneyShort(item.taxes)} taxes`
                : "";
            return (
              <div
                key={item.program}
                className="flex flex-col gap-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] p-5"
              >
                <div className="min-w-0">
                  <p className="text-base font-extrabold text-white">{displayName}</p>
                  <p className="mt-1 text-sm text-slate-300">
                    {item.points.toLocaleString()} pts{taxesPart}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {routeLabel} · {bestDate} · {travelersLabel}
                  </p>
                </div>
                {url !== "#" ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-300"
                  >
                    Open {linkDomain || displayName}
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : (
                  <span className="self-start rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-400">
                    Book directly on {displayName}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  if (!cashAirline) return null;
  const airlineName = cashAirline.airline || "the airline";
  const url = cashAirline.bookingUrl || null;
  const linkDomain = url ? domainFromUrl(url) : `${airlineName.toLowerCase().replace(/\s+/g, "")}.com`;

  const cardContent = (
    <div className="flex flex-col gap-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] p-5 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <p className="text-base font-extrabold text-white">
          Visit {linkDomain}
          {url ? <ExternalLink className="ml-2 inline h-4 w-4 align-text-bottom text-emerald-300" /> : null}
        </p>
        {cashAirline.cashPrice != null ? (
          <p className="mt-1 text-sm text-slate-300">
            Cash fare around {fmtMoneyShort(cashAirline.cashPrice)}.
          </p>
        ) : null}
        <p className="mt-1 text-xs text-slate-500">
          {routeLabel} · {bestDate} · {travelersLabel}
        </p>
      </div>
    </div>
  );

  return (
    <section className="mt-6">
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Book on ${airlineName} (opens in new tab)`}
          className="block rounded-2xl transition-colors hover:bg-white/[0.05] focus:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
        >
          {cardContent}
        </a>
      ) : (
        cardContent
      )}
    </section>
  );
}
