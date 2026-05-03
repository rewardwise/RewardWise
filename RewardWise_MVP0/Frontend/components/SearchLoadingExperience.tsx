/** @format */

"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Circle } from "lucide-react";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import worldTopology from "world-atlas/countries-50m.json";
import { getAirportCoordinate } from "@/data/airportCoordinates";

type SearchLoadingExperienceProps = {
  origin?: string;
  destination?: string;
  cabin?: string;
  travelers?: number;
  isRoundtrip?: boolean;
};

type Point = {
  x: number;
  y: number;
};

const MINIMUM_VISIBLE_MS = 3000;
const MAP_WIDTH = 900;
const MAP_HEIGHT = 300;
const WORLD_WIDTH = 1200;
const WORLD_HEIGHT = 620;

const LEFT_ANCHOR_X = MAP_WIDTH * 0.25;
const RIGHT_ANCHOR_X = MAP_WIDTH * 0.75;
const ROUTE_MID_Y = MAP_HEIGHT * 0.5;

function cabinLabel(cabin?: string) {
  const labels: Record<string, string> = {
    economy: "economy",
    premium_economy: "premium economy",
    business: "business",
    first: "first class",
  };
  return labels[cabin || "economy"] || cabin || "economy";
}

function getObject(topology: unknown, objectName: string) {
  const objects = (topology as { objects?: Record<string, unknown> })?.objects || {};
  return objects[objectName];
}

function safeProjectedPoint(projected: [number, number] | null, fallback: Point): Point {
  if (!projected || Number.isNaN(projected[0]) || Number.isNaN(projected[1])) {
    return fallback;
  }

  return { x: projected[0], y: projected[1] };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function shortestLongitudeDelta(originLongitude: number, destinationLongitude: number) {
  let delta = destinationLongitude - originLongitude;

  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;

  return delta;
}

function getRouteDistanceDegrees(
  originLongitude: number,
  originLatitude: number,
  destinationLongitude: number,
  destinationLatitude: number,
) {
  const longitudeDelta = Math.abs(shortestLongitudeDelta(originLongitude, destinationLongitude));
  const latitudeDelta = Math.abs(destinationLatitude - originLatitude);

  return Math.hypot(longitudeDelta, latitudeDelta);
}

function getRoutePath(start: Point, end: Point, shouldCurve: boolean) {
  if (!shouldCurve) {
    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  }

  const midX = (start.x + end.x) / 2;
  const distance = Math.abs(end.x - start.x);
  const arcLift = Math.max(28, Math.min(92, distance * 0.16));
  const controlY = Math.min(start.y, end.y) - arcLift;

  return `M ${start.x} ${start.y} Q ${midX} ${controlY} ${end.x} ${end.y}`;
}

function routeLabel(originCode?: string, destinationCode?: string) {
  if (!originCode || !destinationCode) return "Route map";
  return `${originCode.toUpperCase()} → ${destinationCode.toUpperCase()} route map`;
}

function transformPoint(point: Point, scale: number, translateX: number, translateY: number): Point {
  return {
    x: point.x * scale + translateX,
    y: point.y * scale + translateY,
  };
}

function RouteMap({ origin, destination }: { origin?: string; destination?: string }) {
  const originAirport = getAirportCoordinate(origin);
  const destinationAirport = getAirportCoordinate(destination);

  const {
    mapPath,
    routePath,
    start,
    end,
    mapLabel,
    sameRegion,
    mapTransform,
    leftLabel,
    rightLabel,
  } = useMemo(() => {
    const countriesObject = getObject(worldTopology, "countries");
    const countriesFeature = feature(worldTopology, countriesObject);

    const baseProjection = geoMercator().fitExtent(
      [
        [0, 0],
        [WORLD_WIDTH, WORLD_HEIGHT],
      ],
      countriesFeature,
    );

    const originLongitude = originAirport?.longitude ?? -74.17;
    const originLatitude = originAirport?.latitude ?? 40.69;
    const destinationLongitude = destinationAirport?.longitude ?? -118.4;
    const destinationLatitude = destinationAirport?.latitude ?? 33.94;

    const originRegion = originAirport?.continentCode || "";
    const destinationRegion = destinationAirport?.continentCode || "";
    const isSameRegion = Boolean(originRegion && destinationRegion && originRegion === destinationRegion);

    const routeDistance = getRouteDistanceDegrees(
      originLongitude,
      originLatitude,
      destinationLongitude,
      destinationLatitude,
    );
    const shouldCurve = !isSameRegion || routeDistance >= 45;

    const baseStart = safeProjectedPoint(baseProjection([originLongitude, originLatitude]), {
      x: WORLD_WIDTH * 0.25,
      y: WORLD_HEIGHT * 0.5,
    });
    const baseEnd = safeProjectedPoint(baseProjection([destinationLongitude, destinationLatitude]), {
      x: WORLD_WIDTH * 0.75,
      y: WORLD_HEIGHT * 0.5,
    });

    const leftBaseX = Math.min(baseStart.x, baseEnd.x);
    const rightBaseX = Math.max(baseStart.x, baseEnd.x);
    const baseDeltaX = Math.max(1, rightBaseX - leftBaseX);

    const targetDeltaX = RIGHT_ANCHOR_X - LEFT_ANCHOR_X;
    const rawScale = targetDeltaX / baseDeltaX;

    const maxScale = isSameRegion ? 58 : 14;
    const minScale = isSameRegion ? 1.8 : 0.75;
    const scale = clamp(rawScale, minScale, maxScale);

    const translateX = LEFT_ANCHOR_X - leftBaseX * scale;

    const routeBaseMidY = (baseStart.y + baseEnd.y) / 2;
    const yBias = shouldCurve ? Math.min(22, Math.abs(baseEnd.y - baseStart.y) * scale * 0.08) : 0;
    const translateY = ROUTE_MID_Y - routeBaseMidY * scale + yBias;

    const transformedStart = transformPoint(baseStart, scale, translateX, translateY);
    const transformedEnd = transformPoint(baseEnd, scale, translateX, translateY);

    const originCode = origin?.toUpperCase() || "Origin";
    const destinationCode = destination?.toUpperCase() || "Destination";
    const originIsLeft = transformedStart.x <= transformedEnd.x;

    return {
      mapPath: geoPath(baseProjection)(countriesFeature) || "",
      routePath: getRoutePath(baseStart, baseEnd, shouldCurve),
      start: transformedStart,
      end: transformedEnd,
      mapLabel: routeLabel(origin, destination),
      sameRegion: isSameRegion,
      mapTransform: `translate(${translateX} ${translateY}) scale(${scale})`,
      leftLabel: originIsLeft ? originCode : destinationCode,
      rightLabel: originIsLeft ? destinationCode : originCode,
    };
  }, [
    origin,
    destination,
    originAirport?.continentCode,
    originAirport?.latitude,
    originAirport?.longitude,
    destinationAirport?.continentCode,
    destinationAirport?.latitude,
    destinationAirport?.longitude,
  ]);

  const endpointDotRadius = sameRegion ? 2.8 : 4.8;
  const endpointRingSize = sameRegion ? 10 : 16;
  const endpointRingOffset = endpointRingSize / 2;
  const endpointRingClassName = sameRegion ? "h-2.5 w-2.5" : "h-4 w-4";
  const routeStrokeWidth = sameRegion ? 1.5 : 2.4;

  return (
    <div className="relative mx-auto mt-7 h-72 w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 text-emerald-100 shadow-inner shadow-black/20">
      <style>{`
        @keyframes mtw-route-dash {
          to { stroke-dashoffset: -24; }
        }
        @keyframes mtw-map-pulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.16),transparent_30%),radial-gradient(circle_at_80%_65%,rgba(56,189,248,0.12),transparent_32%)]" />
      <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:34px_34px]" />

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <g transform={mapTransform}>
          <path
            d={mapPath}
            fill="rgba(148, 163, 184, 0.22)"
            stroke="rgba(148, 163, 184, 0.24)"
            strokeWidth="0.7"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={routePath}
            fill="none"
            stroke="rgba(110, 231, 183, 0.95)"
            strokeWidth={routeStrokeWidth}
            strokeLinecap="round"
            strokeDasharray="8 8"
            vectorEffect="non-scaling-stroke"
            style={{ animation: "mtw-route-dash 1.2s linear infinite" }}
          />
        </g>

        <circle cx={start.x} cy={start.y} r={endpointDotRadius} fill="rgb(110, 231, 183)" />
        <circle cx={end.x} cy={end.y} r={endpointDotRadius} fill="rgb(125, 211, 252)" />

        {!sameRegion && (
          <>
            <foreignObject
              x={start.x - endpointRingOffset}
              y={start.y - endpointRingOffset}
              width={endpointRingSize}
              height={endpointRingSize}
            >
              <div className={`${endpointRingClassName} rounded-full border border-emerald-200/60 bg-emerald-300/20`} style={{ animation: "mtw-map-pulse 1.8s ease-in-out infinite" }} />
            </foreignObject>
            <foreignObject
              x={end.x - endpointRingOffset}
              y={end.y - endpointRingOffset}
              width={endpointRingSize}
              height={endpointRingSize}
            >
              <div className={`${endpointRingClassName} rounded-full border border-sky-200/60 bg-sky-300/20`} />
            </foreignObject>
          </>
        )}
      </svg>

      <div className="absolute left-4 top-3 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 backdrop-blur-md">
        {mapLabel}
      </div>
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
  const progress = Math.min(100, Math.round((elapsedMs / MINIMUM_VISIBLE_MS) * 100));
  const overMinimum = elapsedMs >= MINIMUM_VISIBLE_MS;

  const steps = useMemo(
    () => [
      { label: "Searching cash fares", startsAt: 0 },
      { label: "Checking award space", startsAt: 750 },
      { label: "Comparing value", startsAt: 1500 },
      { label: "Preparing verdict", startsAt: 2300 },
    ],
    [],
  );

  const activeIndex = overMinimum
    ? steps.length - 1
    : steps.reduce((latestIndex, step, index) => (elapsedMs >= step.startsAt ? index : latestIndex), 0);

  const statusText = overMinimum
    ? "Preparing verdict..."
    : steps[Math.max(0, activeIndex)]?.label || "Starting search...";

  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/80 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
      <style>{`
        @keyframes mtw-pulse-dot {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.18); }
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
          {travelers} traveler{travelers === 1 ? "" : "s"} · {cabinLabel(cabin)} · {isRoundtrip ? "round trip" : "one way"}
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
            const isDone = overMinimum || elapsedMs > step.startsAt + 600;
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
                      isDone
                        ? "bg-emerald-300/15 text-emerald-200"
                        : isActive
                          ? "bg-emerald-300/15 text-emerald-200"
                          : "bg-white/5 text-slate-500"
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
