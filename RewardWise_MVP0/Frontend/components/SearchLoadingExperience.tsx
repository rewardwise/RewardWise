/** @format */

"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Circle } from "lucide-react";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import worldTopology from "world-atlas/countries-50m.json";
import { getAirportCoordinate } from "@/data/airportCoordinates";
import { cabinLabel } from "@/utils/cabin";

type SearchLoadingExperienceProps = {
  origin?: string;
  destination?: string;
  cabin?: string;
  travelers?: number;
  isRoundtrip?: boolean;
};

type Point = { x: number; y: number };

const MINIMUM_VISIBLE_MS = 3000;
const MAP_WIDTH = 900;
const MAP_HEIGHT = 300;

/**
 * Padding (px) reserved around each dot so they never hug the card edge.
 * Dots land in the [PAD_X .. MAP_WIDTH-PAD_X] × [PAD_Y .. MAP_HEIGHT-PAD_Y] box.
 */
const PAD_X = MAP_WIDTH  * 0.18; // 18% → dots in ~162–738 px horizontally
const PAD_Y = MAP_HEIGHT * 0.20; // 20% → dots in ~60–240 px vertically

function getObject(topology: unknown, objectName: string) {
  const objects = (topology as { objects?: Record<string, unknown> })?.objects || {};
  return objects[objectName];
}

function safePoint(projected: [number, number] | null, fallback: Point): Point {
  if (!projected || Number.isNaN(projected[0]) || Number.isNaN(projected[1])) return fallback;
  return { x: projected[0], y: projected[1] };
}

function getRoutePath(start: Point, end: Point, routeDeg: number) {
  if (routeDeg < 15) {
    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  }
  const midX = (start.x + end.x) / 2;
  const span = Math.abs(end.x - start.x);
  const lift = Math.max(18, Math.min(75, span * 0.13));
  const cy = Math.min(start.y, end.y) - lift;
  return `M ${start.x} ${start.y} Q ${midX} ${cy} ${end.x} ${end.y}`;
}

function routeLabel(o?: string, d?: string) {
  if (!o || !d) return "Route map";
  return `${o.toUpperCase()} → ${d.toUpperCase()} route map`;
}

function RouteMap({ origin, destination }: { origin?: string; destination?: string }) {
  const originAirport      = getAirportCoordinate(origin);
  const destinationAirport = getAirportCoordinate(destination);

  const { mapPath, routePath, start, end, mapLabel, mapTransform, strokeWidth } = useMemo(() => {
    const countriesObject  = getObject(worldTopology, "countries");
    const countriesFeature = feature(worldTopology, countriesObject);

    // Fall back to EWR / LAX if coordinates are unknown
    const oLng = originAirport?.longitude      ?? -74.17;
    const oLat = originAirport?.latitude       ?? 40.69;
    const dLng = destinationAirport?.longitude ?? -118.4;
    const dLat = destinationAirport?.latitude  ?? 33.94;

    // Approximate distance in degrees (for curve & stroke decisions)
    const rawDLng = dLng - oLng;
    const adjDLng = Math.abs(rawDLng) > 180 ? 360 - Math.abs(rawDLng) : Math.abs(rawDLng);
    const routeDeg = Math.hypot(adjDLng, Math.abs(dLat - oLat));

    // ── Step 1: base world projection onto a generous canvas ────────────────
    const WORLD_W = 1000;
    const WORLD_H = 500;
    const baseProj = geoMercator().fitExtent([[0, 0], [WORLD_W, WORLD_H]], countriesFeature);

    const pO = safePoint(baseProj([oLng, oLat]), { x: WORLD_W * 0.25, y: WORLD_H * 0.5 });
    const pD = safePoint(baseProj([dLng, dLat]), { x: WORLD_W * 0.75, y: WORLD_H * 0.5 });

    // ── Step 2: compute scale so both dots fit within the padded card area ──
    const availW = MAP_WIDTH  - 2 * PAD_X;
    const availH = MAP_HEIGHT - 2 * PAD_Y;
    const spanX  = Math.abs(pD.x - pO.x);
    const spanY  = Math.abs(pD.y - pO.y);

    let scale: number;
    if (spanX < 1 && spanY < 1) {
      // Same airport / missing coords → regional view
      scale = 3.5;
    } else {
      const scaleByX = spanX > 0 ? availW / spanX : Infinity;
      const scaleByY = spanY > 0 ? availH / spanY : Infinity;
      // Use the more constraining axis; clamp to a sane zoom range
      scale = Math.min(scaleByX, scaleByY);
      scale = Math.max(0.9, Math.min(scale, 4.2));
    }

    // ── Step 3: translate so the midpoint of both airports sits at card center
    const midX = (pO.x + pD.x) / 2;
    const midY = (pO.y + pD.y) / 2;
    const tx = MAP_WIDTH  / 2 - midX * scale;
    const ty = MAP_HEIGHT / 2 - midY * scale;

    // ── Step 4: final dot positions on the card (map + dots share transform) ─
    const rawStart: Point = { x: pO.x * scale + tx, y: pO.y * scale + ty };
    const rawEnd:   Point = { x: pD.x * scale + tx, y: pD.y * scale + ty };

    // Safety clamp — should be inside card already, but guard just in case
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
    const start: Point = {
      x: clamp(rawStart.x, PAD_X * 0.4, MAP_WIDTH  - PAD_X * 0.4),
      y: clamp(rawStart.y, PAD_Y * 0.4, MAP_HEIGHT - PAD_Y * 0.4),
    };
    const end: Point = {
      x: clamp(rawEnd.x, PAD_X * 0.4, MAP_WIDTH  - PAD_X * 0.4),
      y: clamp(rawEnd.y, PAD_Y * 0.4, MAP_HEIGHT - PAD_Y * 0.4),
    };

    return {
      mapPath:      geoPath(baseProj)(countriesFeature) || "",
      routePath:    getRoutePath(start, end, routeDeg),
      start,
      end,
      mapLabel:     routeLabel(origin, destination),
      mapTransform: `translate(${tx} ${ty}) scale(${scale})`,
      strokeWidth:  routeDeg >= 80 ? 2.2 : 1.6,
    };
  }, [
    origin,
    destination,
    originAirport?.latitude,
    originAirport?.longitude,
    destinationAirport?.latitude,
    destinationAirport?.longitude,
  ]);

  // Labels are always CSS-pinned: origin bottom-left, destination bottom-right.
  // This is intentional UX — the route reads left-to-right regardless of geography.
  const leftLabel  = origin?.toUpperCase()      || "Origin";
  const rightLabel = destination?.toUpperCase() || "Destination";

  return (
    <div className="relative mx-auto mt-7 h-72 w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 text-emerald-100 shadow-inner shadow-black/20">
      <style>{`
        @keyframes mtw-route-dash {
          to { stroke-dashoffset: -24; }
        }
        @keyframes mtw-map-pulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.2); }
        }
      `}</style>

      {/* Ambient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.16),transparent_30%),radial-gradient(circle_at_80%_65%,rgba(56,189,248,0.12),transparent_32%)]" />
      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:34px_34px]" />

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        {/* Map — uses the exact same translate+scale as the dots, so geography and dots are always in sync */}
        <g transform={mapTransform}>
          <path
            d={mapPath}
            fill="rgba(148, 163, 184, 0.22)"
            stroke="rgba(148, 163, 184, 0.24)"
            strokeWidth="0.7"
            vectorEffect="non-scaling-stroke"
          />
        </g>

        {/* Animated dashed route line */}
        <path
          d={routePath}
          fill="none"
          stroke="rgba(110, 231, 183, 0.95)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray="8 8"
          style={{ animation: "mtw-route-dash 1.2s linear infinite" }}
        />

        {/* Origin dot + pulse ring (emerald) */}
        <circle cx={start.x} cy={start.y} r={3.5} fill="rgb(110, 231, 183)" />
        <foreignObject x={start.x - 6} y={start.y - 6} width={12} height={12}>
          <div
            className="h-3 w-3 rounded-full border border-emerald-200/60 bg-emerald-300/20"
            style={{ animation: "mtw-map-pulse 1.8s ease-in-out infinite" }}
          />
        </foreignObject>

        {/* Destination dot + ring (sky) */}
        <circle cx={end.x} cy={end.y} r={3.5} fill="rgb(125, 211, 252)" />
        <foreignObject x={end.x - 6} y={end.y - 6} width={12} height={12}>
          <div className="h-3 w-3 rounded-full border border-sky-200/60 bg-sky-300/20" />
        </foreignObject>
      </svg>

      {/* Route label badge */}
      <div className="absolute left-4 top-3 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 backdrop-blur-md">
        {mapLabel}
      </div>

      {/* Airport labels — always origin left, destination right */}
      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-sm font-bold text-white">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

export default function SearchLoadingExperience({
  origin,
  destination,
  cabin,
  travelers = 1,
  isRoundtrip = false,
}: SearchLoadingExperienceProps) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 150);
    return () => window.clearInterval(timer);
  }, []);

  const route = `${origin || "Origin"} → ${destination || "Destination"}`;
  const progress   = Math.min(100, Math.round((elapsedMs / MINIMUM_VISIBLE_MS) * 100));
  const overMinimum = elapsedMs >= MINIMUM_VISIBLE_MS;

  const steps = useMemo(
    () => [
      { label: "Searching cash fares", startsAt: 0    },
      { label: "Checking award space", startsAt: 750  },
      { label: "Comparing value",      startsAt: 1500 },
      { label: "Preparing verdict",    startsAt: 2300 },
    ],
    [],
  );

  const activeIndex = overMinimum
    ? steps.length - 1
    : steps.reduce((latest, step, i) => (elapsedMs >= step.startsAt ? i : latest), 0);

  const statusText = overMinimum
    ? "Preparing verdict..."
    : steps[Math.max(0, activeIndex)]?.label || "Starting search...";

  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/80 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
      <style>{`
        @keyframes mtw-pulse-dot {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.18); }
        }
      `}</style>

      <div className="mx-auto max-w-5xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">
          Building your trip verdict
        </p>

        <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-4xl">
          {route}
        </h2>

        <p className="mt-2 text-sm text-slate-400">
          {travelers} traveler{travelers === 1 ? "" : "s"} · {cabin ? cabinLabel(cabin) : ""} · {isRoundtrip ? "round trip" : "one way"}
        </p>

        <RouteMap origin={origin} destination={destination} />

        <div className="mx-auto mt-7 max-w-4xl">
          <div className="flex items-center justify-between text-sm font-medium text-slate-400">
            <span>{statusText}</span>
            <span>{overMinimum ? "100%" : `${progress}%`}</span>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-emerald-300 transition-all duration-200 ease-out"
              style={{ width: `${overMinimum ? 100 : progress}%` }}
            />
          </div>
        </div>

        <div className="mx-auto mt-7 grid max-w-4xl gap-3 text-left sm:grid-cols-4">
          {steps.map((step, index) => {
            const isDone   = overMinimum || elapsedMs > step.startsAt + 600;
            const isActive = !overMinimum && index === activeIndex;

            return (
              <div
                key={step.label}
                className={`rounded-2xl border px-3 py-3 transition-all duration-300 ${
                  isActive
                    ? "border-emerald-300/30 bg-emerald-400/10 text-white"
                    : isDone
                      ? "border-emerald-300/15 bg-white/[0.035] text-slate-200"
                      : "border-white/10 bg-white/[0.02] text-slate-500"
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-full ${
                      isDone || isActive ? "bg-emerald-300/15 text-emerald-200" : "bg-white/5 text-slate-500"
                    }`}
                    style={{ animation: isActive ? "mtw-pulse-dot 1.2s ease-in-out infinite" : undefined }}
                  >
                    {isDone ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-2.5 w-2.5 fill-current" />}
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Step {index + 1}
                  </span>
                </div>
                <p className="text-xs font-semibold leading-snug">{step.label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
