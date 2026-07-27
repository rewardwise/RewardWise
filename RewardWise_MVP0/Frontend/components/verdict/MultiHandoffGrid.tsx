/** @format */
"use client";

import { ArrowRight, ExternalLink } from "lucide-react";
import { getProgramHandoffInfo } from "@/utils/airlines";
import { TRANSFER_PARTNERS } from "@/utils/transferPartners";

export interface MultiHandoffProgram {
  program: string;
  points: number;
  taxes: number | null;
}

export interface MultiHandoffCashAirline {
  airline: string;
  cashPrice: number | null;
  bookingUrl?: string | null;
  /** SerpAPI's canonical Google Flights URL for the exact cash search. */
  googleFlightsUrl?: string | null;
}

type Props = {
  recommendation: "use_points" | "pay_cash";
  programs?: MultiHandoffProgram[];
  cashAirline?: MultiHandoffCashAirline | null;
  bestDate: string;
  returnDateLabel?: string | null;
  routeLabel: string;
  travelersLabel: string;
  legLabel?: string;
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
  returnDateLabel = null,
  routeLabel,
  travelersLabel,
  legLabel,
}: Props) {
  if (recommendation === "use_points") {
    const items = programs ?? [];
    if (items.length === 0) return null;
    const heading = legLabel
      ? `Book ${legLabel.toLowerCase()} through your program`
      : "Book through your program";
    return (
      <section className="mt-6">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
          {heading}
        </p>
        <div className={items.length > 1 ? "grid gap-4 md:grid-cols-2" : "grid gap-4"}>
          {items.map((item) => {
            const { url, displayName } = getProgramHandoffInfo(item.program);
            const linkDomain = url === "#" ? null : domainFromUrl(url);
            const taxesPart =
              item.taxes != null && item.taxes > 0
                ? ` + ${fmtMoneyShort(item.taxes)} taxes`
                : " · no fuel surcharges";
            const programKey = item.program.toLowerCase().trim();
            const transferSources = (TRANSFER_PARTNERS[programKey] ?? []).slice(0, 3);
            const needsTransfer = transferSources.length > 0;
            return (
              <div
                key={item.program}
                className="flex flex-col gap-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] p-5"
              >
                {needsTransfer ? (
                  <div
                    data-testid="transfer-step"
                    className="rounded-xl border border-amber-400/30 bg-amber-500/[0.08] p-4"
                  >
                    <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-amber-300/40 text-[10px] font-bold">
                        1
                      </span>
                      Transfer to {displayName}
                    </p>
                    <p className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1 text-xs leading-5 text-slate-300">
                      <span>From</span>
                      {transferSources.map((p, i) => (
                        <span key={p.sourceCard}>
                          <span className="font-semibold text-slate-100">{p.short}</span>{" "}
                          <span className="text-slate-400">
                            ({p.ratio}
                            {p.speed === "instant" ? "" : `, ${p.speed}`})
                          </span>
                          {i < transferSources.length - 1 ? "," : "."}
                        </span>
                      ))}
                    </p>
                    <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-slate-400">
                      Skip this step if your miles are already in {displayName}.
                    </p>
                  </div>
                ) : null}
                <div className="min-w-0">
                  {needsTransfer ? (
                    <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-300/40 text-[10px] font-bold">
                        2
                      </span>
                      Book on {linkDomain || displayName}
                    </p>
                  ) : null}
                  <p
                    className={`${
                      needsTransfer ? "mt-1 " : ""
                    }text-base font-extrabold text-white`}
                  >
                    {displayName}
                  </p>
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
                    {needsTransfer ? (
                      <>
                        Transfer, then open {linkDomain || displayName}
                        <ArrowRight className="h-4 w-4" />
                      </>
                    ) : (
                      <>
                        Open {linkDomain || displayName}
                        <ExternalLink className="h-4 w-4" />
                      </>
                    )}
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
  // Cash-source resolution order (2026-07-27, homepage ELIMINATED — a bare
  // carrier homepage isn't a booking link and may not even sell this fare):
  //   1. bookingUrl — a real per-itinerary deeplink if a provider ever
  //      supplies one (SerpAPI's search response never does; null today).
  //   2. SerpAPI's canonical google_flights_url for the EXACT search — both
  //      dates encoded in tfs=, guaranteed to show the fare we quoted.
  //   3. Labeled best-effort ?q= link (undocumented format; only if the
  //      canonical URL is absent from the payload).
  const dateLabel = returnDateLabel ? `${bestDate} – ${returnDateLabel}` : bestDate;
  const bestEffortFallback = `https://www.google.com/travel/flights?q=${encodeURIComponent(
    `Flights ${routeLabel.replace(/[⇄→]/g, "to")} ${dateLabel}`.replace(/\s+/g, " ")
  )}`;
  const url =
    cashAirline.bookingUrl ||
    cashAirline.googleFlightsUrl ||
    bestEffortFallback;
  const usingCanonical = !cashAirline.bookingUrl && Boolean(cashAirline.googleFlightsUrl);
  const linkDomain = domainFromUrl(url);
  const linkLabel = cashAirline.bookingUrl
    ? `Visit ${linkDomain}`
    : usingCanonical
      ? "See this fare on Google Flights"
      : "Search this route on Google Flights";

  const cardContent = (
    <div className="flex flex-col gap-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] p-5 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <p className="text-base font-extrabold text-white">
          {linkLabel}
          <ExternalLink className="ml-2 inline h-4 w-4 align-text-bottom text-emerald-300" />
        </p>
        {cashAirline.cashPrice != null ? (
          <p className="mt-1 text-sm text-slate-300">
            Cash fare around {fmtMoneyShort(cashAirline.cashPrice)}.
          </p>
        ) : null}
        <p className="mt-1 text-xs text-slate-500">
          {routeLabel} · {dateLabel} · {travelersLabel}
        </p>
      </div>
    </div>
  );

  return (
    <section className="mt-6">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Book on ${airlineName} (opens in new tab)`}
        className="block rounded-2xl transition-colors hover:bg-white/[0.05] focus:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
      >
        {cardContent}
      </a>
    </section>
  );
}
