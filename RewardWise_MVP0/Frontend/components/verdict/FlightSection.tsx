/** @format */
"use client";

import { useState } from "react";
import { PlaneTakeoff, PlaneLanding } from "lucide-react";

type Recommendation = "use_points" | "pay_cash" | "wait";

export interface FlightSegment {
  flight_number?: string;
  carrier?: string;
  origin?: string;
  destination?: string;
  departs_at?: string;
  arrives_at?: string;
  duration?: number;
}

export interface FlightLeg {
  label: "Outbound" | "Return";
  segments: FlightSegment[];
  total_duration?: number;
  // "detailed" = trips[i].segments hydrated with per-segment carrier/time data.
  // "summary"  = synthesized from top-level award fields (airlines, route, search date)
  //              because seats.aero /trips hydration was skipped or returned no detail.
  //              FlightSection renders a disclaimer in this case.
  data_quality?: "detailed" | "summary";
}

type Props = {
  recommendation: Recommendation;
  isRoundtrip: boolean;
  outbound: FlightLeg | null;
  inbound: FlightLeg | null;
  /**
   * Lazy return-leg fetch (pay_cash round trips): SerpAPI only exposes return
   * legs via a second token-keyed request, so it fires on FIRST To-Flight tab
   * activation — never during search. Resolves a detailed FlightLeg or null.
   */
  onLoadReturnDetails?: (() => Promise<FlightLeg | null>) | null;
};

function fmtDuration(mins?: number) {
  if (!mins) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function parseDateTime(value?: string) {
  if (!value) return null;
  const safe = value.includes("T") ? value : value.replace(" ", "T");
  const bare = safe.replace("Z", "").split("+")[0];
  const [datePart, timePart] = bare.split("T");
  if (!datePart || !timePart) return null;
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  if ([year, month, day, hour, minute].some((n) => Number.isNaN(n))) return null;
  return new Date(year, month - 1, day, hour, minute);
}

function fmtTime(value?: string) {
  const d = parseDateTime(value);
  if (!d) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function fmtShortDate(value?: string) {
  const d = parseDateTime(value);
  if (!d) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtDate(value?: string) {
  if (!value) return "";
  // Date-only strings (YYYY-MM-DD) must be parsed in local tz, not UTC.
  // new Date("2026-07-04") parses as UTC midnight and renders as Jul 3 in Pacific.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }
  const parsed = parseDateTime(value);
  if (!parsed) return "";
  return parsed.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function arrivalOverflowsDate(seg: FlightSegment) {
  const dep = parseDateTime(seg.departs_at);
  const arr = parseDateTime(seg.arrives_at);
  if (!dep || !arr) return false;
  return dep.toDateString() !== arr.toDateString();
}

function layoverMinutes(prev: FlightSegment, next: FlightSegment) {
  const prevArr = parseDateTime(prev.arrives_at);
  const nextDep = parseDateTime(next.departs_at);
  if (!prevArr || !nextDep) return null;
  const diff = Math.round((nextDep.getTime() - prevArr.getTime()) / 60000);
  return diff > 0 ? diff : null;
}

function FlightCard({ leg }: { leg: FlightLeg }) {
  const segments = leg.segments;
  const isReturn = leg.label === "Return";
  const first = segments[0];
  const last = segments[segments.length - 1];
  const stopCount = segments.length - 1;
  const stopLabel = stopCount === 0 ? "Nonstop" : `${stopCount} stop${stopCount > 1 ? "s" : ""}`;
  const headerDate = first ? fmtDate(first.departs_at) : "";
  const isSummary = leg.data_quality === "summary";
  const testIdSuffix = leg.label.toLowerCase();

  return (
    <div
      data-testid={`flight-card-${testIdSuffix}`}
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:p-5"
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-400/20 bg-indigo-500/15">
          {isReturn ? (
            <PlaneLanding className="h-4 w-4 text-indigo-300" />
          ) : (
            <PlaneTakeoff className="h-4 w-4 text-indigo-300" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p
            data-testid={`leg-header-${testIdSuffix}`}
            className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-300"
          >
            {leg.label}
            {headerDate ? (
              <span className="normal-case tracking-normal text-slate-400"> · {headerDate}</span>
            ) : null}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <span
              data-testid={`leg-route-${testIdSuffix}`}
              className="text-lg font-extrabold text-white"
            >
              {first?.origin || "—"} → {last?.destination || "—"}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-semibold text-slate-300">
              {stopLabel}
            </span>
            {leg.total_duration ? (
              <span className="text-xs text-slate-500">{fmtDuration(leg.total_duration)}</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {segments.map((seg, idx) => {
          const overflow = arrivalOverflowsDate(seg);
          const next = segments[idx + 1];
          const layover = next ? layoverMinutes(seg, next) : null;
          const carrierLabel = [seg.carrier, seg.flight_number].filter(Boolean).join(" ");
          return (
            <div key={`${idx}-${seg.flight_number ?? "seg"}`}>
              <div
                data-testid="segment-row"
                className="flex flex-wrap items-baseline justify-between gap-2"
              >
                <p className="text-sm font-semibold text-white">
                  {carrierLabel || "Flight pending"}
                  <span className="font-normal text-slate-400">
                    {" · "}
                    {seg.origin || "—"} → {seg.destination || "—"}
                  </span>
                  {seg.duration ? (
                    <span className="font-normal text-slate-500"> · {fmtDuration(seg.duration)}</span>
                  ) : null}
                </p>
              </div>
              {isSummary ? null : (
                <div className="mt-1 flex flex-wrap items-baseline gap-x-2 text-xs text-slate-400">
                  <span>
                    {fmtTime(seg.departs_at) || "—"}
                    {fmtTime(seg.arrives_at) ? ` – ${fmtTime(seg.arrives_at)}` : ""}
                  </span>
                  {overflow && seg.arrives_at ? (
                    <span className="text-amber-300">· Arrives {fmtShortDate(seg.arrives_at)}</span>
                  ) : null}
                </div>
              )}
              {layover != null && next ? (
                <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                  {fmtDuration(layover)} layover {seg.destination || ""}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      {isSummary ? (
        <p className="mt-3 text-xs italic text-slate-400">
          Flight details may vary at booking. Confirm on the airline site.
        </p>
      ) : null}
    </div>
  );
}

export default function FlightSection({
  recommendation,
  isRoundtrip,
  outbound,
  inbound,
  onLoadReturnDetails = null,
}: Props) {
  const [activeTab, setActiveTab] = useState<"from" | "to">("from");
  const [lazyInbound, setLazyInbound] = useState<FlightLeg | null>(null);
  const [lazyState, setLazyState] = useState<"idle" | "loading" | "done" | "failed">("idle");

  const wantLazy =
    onLoadReturnDetails != null && (inbound == null || inbound.data_quality === "summary");

  const activateTab = (id: "from" | "to") => {
    setActiveTab(id);
    if (id === "to" && wantLazy && lazyState === "idle") {
      setLazyState("loading");
      onLoadReturnDetails!()
        .then((leg) => {
          if (leg && leg.segments.length > 0) {
            setLazyInbound(leg);
            setLazyState("done");
          } else {
            setLazyState("failed");
          }
        })
        .catch(() => setLazyState("failed"));
    }
  };

  if (recommendation === "wait") return null;
  if (!outbound || outbound.segments.length === 0) return null;

  const showInbound = isRoundtrip && inbound && inbound.segments.length > 0;

  // One-way (or no return detail): render the single leg, no tabs.
  if (!showInbound || !inbound) {
    return (
      <section className="mt-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Flight details
        </p>
        <FlightCard leg={outbound} />
      </section>
    );
  }

  // Round trip: tabbed so we show one leg at a time (From Flight / To Flight)
  // instead of a tall two-column block.
  const tabs = [
    { id: "from" as const, label: "From Flight" },
    { id: "to" as const, label: "To Flight" },
  ];
  const displayedInbound = lazyInbound ?? inbound;
  const activeLeg = activeTab === "from" ? outbound : displayedInbound;

  return (
    <section className="mt-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        Flight details
      </p>
      <div
        role="tablist"
        aria-label="Flight legs"
        className="mb-3 inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1"
      >
        {tabs.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              data-testid={`flight-tab-${tab.id}`}
              onClick={() => activateTab(tab.id)}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors ${
                selected
                  ? "bg-emerald-500 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {activeTab === "to" && lazyState === "loading" ? (
        <div
          data-testid="return-leg-loading"
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400"
        >
          Loading return flight details…
        </div>
      ) : activeTab === "to" && lazyState === "failed" ? (
        <div className="flex flex-col gap-3">
          {displayedInbound ? <FlightCard leg={displayedInbound} /> : null}
          <p
            data-testid="return-leg-unavailable"
            className="text-xs italic text-slate-400"
          >
            Return details not available from the cash source. Confirm on the airline site.
          </p>
        </div>
      ) : activeLeg ? (
        <FlightCard leg={activeLeg} />
      ) : null}
    </section>
  );
}
