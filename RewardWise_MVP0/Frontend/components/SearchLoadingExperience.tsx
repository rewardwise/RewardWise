/** @format */

"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Check, Circle } from "lucide-react";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import worldTopology from "world-atlas/countries-110m.json";
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

type ContinentKey = "Americas" | "Europe" | "Africa" | "Asia" | "Oceania";

type Extent = {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
};

type ViewBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const MINIMUM_VISIBLE_MS = 5000;
const WORLD_WIDTH = 1200;
const WORLD_HEIGHT = 620;

const AMERICAS_COUNTRIES = new Set([
  "AG","AI","AR","AW","BB","BL","BM","BO","BQ","BR","BS","BZ","CA","CL","CO","CR","CU","CW","DM","DO","EC","FK","GD","GF","GL","GP","GT","GY","HN","HT","JM","KN","KY","LC","MF","MQ","MS","MX","NI","PA","PE","PM","PR","PY","SR","SV","SX","TC","TT","US","UY","VC","VE","VG","VI",
]);

const EUROPE_COUNTRIES = new Set([
  "AD","AL","AT","AX","BA","BE","BG","BY","CH","CY","CZ","DE","DK","EE","ES","FI","FO","FR","GB","GG","GI","GR","HR","HU","IE","IM","IS","IT","JE","LI","LT","LU","LV","MC","MD","ME","MK","MT","NL","NO","PL","PT","RO","RS","RU","SE","SI","SJ","SK","SM","TR","UA","VA",
]);

const AFRICA_COUNTRIES = new Set([
  "AO","BF","BI","BJ","BW","CD","CF","CG","CI","CM","CV","DJ","DZ","EG","EH","ER","ET","GA","GH","GM","GN","GQ","GW","KE","KM","LR","LS","LY","MA","MG","ML","MR","MU","MW","MZ","NA","NE","NG","RE","RW","SC","SD","SH","SL","SN","SO","SS","ST","SZ","TD","TG","TN","TZ","UG","YT","ZA","ZM","ZW",
]);

const OCEANIA_COUNTRIES = new Set([
  "AS","AU","CK","FJ","FM","GU","KI","MH","MP","NC","NF","NR","NU","NZ","PF","PG","PN","PW","SB","TK","TL","TO","TV","VU","WF","WS",
]);

const CONTINENT_EXTENTS: Record<ContinentKey, Extent> = {
  Americas: { minLon: -170, maxLon: -25, minLat: -60, maxLat: 82 },
  Europe: { minLon: -15, maxLon: 45, minLat: 30, maxLat: 72 },
  Africa: { minLon: -20, maxLon: 55, minLat: -35, maxLat: 38 },
  Asia: { minLon: 25, maxLon: 150, minLat: -10, maxLat: 75 },
  Oceania: { minLon: 110, maxLon: 180, minLat: -50, maxLat: 8 },
};

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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function safeProjectedPoint(projected: [number, number] | null, fallback: Point): Point {
  if (!projected || Number.isNaN(projected[0]) || Number.isNaN(projected[1])) {
    return fallback;
  }

  return { x: projected[0], y: projected[1] };
}

function angleBetween(start: Point, end: Point) {
  return Math.atan2(end.y - start.y, end.x - start.x) * (180 / Math.PI);
}

function getRoutePath(start: Point, end: Point) {
  const midX = (start.x + end.x) / 2;
  const distance = Math.abs(end.x - start.x);
  const arcLift = Math.max(26, Math.min(86, distance * 0.18));
  const controlY = Math.min(start.y, end.y) - arcLift;

  return `M ${start.x} ${start.y} Q ${midX} ${controlY} ${end.x} ${end.y}`;
}

function getContinentFromCountry(countryCode?: string): ContinentKey {
  const code = (countryCode || "").toUpperCase();
  if (AMERICAS_COUNTRIES.has(code)) return "Americas";
  if (EUROPE_COUNTRIES.has(code)) return "Europe";
  if (AFRICA_COUNTRIES.has(code)) return "Africa";
  if (OCEANIA_COUNTRIES.has(code)) return "Oceania";
  return "Asia";
}

function combineExtents(continents: ContinentKey[]): Extent {
  const unique = Array.from(new Set(continents));
  return unique.reduce(
    (combined, continent) => {
      const current = CONTINENT_EXTENTS[continent];
      return {
        minLon: Math.min(combined.minLon, current.minLon),
        maxLon: Math.max(combined.maxLon, current.maxLon),
        minLat: Math.min(combined.minLat, current.minLat),
        maxLat: Math.max(combined.maxLat, current.maxLat),
      };
    },
    { minLon: 999, maxLon: -999, minLat: 999, maxLat: -999 },
  );
}

function getRouteExtent(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
  continent: ContinentKey,
): Extent {
  const bounds = CONTINENT_EXTENTS[continent];
  const centerLon = (lon1 + lon2) / 2;
  const centerLat = (lat1 + lat2) / 2;
  const lonSpan = Math.abs(lon1 - lon2);
  const latSpan = Math.abs(lat1 - lat2);

  const minLonSpan = continent === "Americas" ? 24 : 18;
  const minLatSpan = continent === "Americas" ? 16 : 13;
  const targetLonSpan = Math.max(minLonSpan, lonSpan * 1.35);
  const targetLatSpan = Math.max(minLatSpan, latSpan * 2.5);

  let minLon = centerLon - targetLonSpan / 2;
  let maxLon = centerLon + targetLonSpan / 2;
  let minLat = centerLat - targetLatSpan / 2;
  let maxLat = centerLat + targetLatSpan / 2;

  if (minLon < bounds.minLon) {
    maxLon += bounds.minLon - minLon;
    minLon = bounds.minLon;
  }
  if (maxLon > bounds.maxLon) {
    minLon -= maxLon - bounds.maxLon;
    maxLon = bounds.maxLon;
  }
  if (minLat < bounds.minLat) {
    maxLat += bounds.minLat - minLat;
    minLat = bounds.minLat;
  }
  if (maxLat > bounds.maxLat) {
    minLat -= maxLat - bounds.maxLat;
    maxLat = bounds.maxLat;
  }

  return {
    minLon: clamp(minLon, bounds.minLon, bounds.maxLon),
    maxLon: clamp(maxLon, bounds.minLon, bounds.maxLon),
    minLat: clamp(minLat, bounds.minLat, bounds.maxLat),
    maxLat: clamp(maxLat, bounds.minLat, bounds.maxLat),
  };
}

function getMapCase(
  originCountry: string | undefined,
  destinationCountry: string | undefined,
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
) {
  const originContinent = getContinentFromCountry(originCountry);
  const destinationContinent = getContinentFromCountry(destinationCountry);

  if (originContinent === destinationContinent) {
    return {
      label: originContinent === "Americas" ? "Americas route map" : `${originContinent} route map`,
      extent: getRouteExtent(lon1, lat1, lon2, lat2, originContinent),
    };
  }

  const combinedContinents = [originContinent, destinationContinent].sort((a, b) => {
    if (a === "Americas") return -1;
    if (b === "Americas") return 1;
    return a.localeCompare(b);
  });

  return {
    label: `${combinedContinents.join(" + ")} route map`,
    extent: combineExtents(combinedContinents),
  };
}

function viewBoxFromExtent(
  extent: Extent,
  project: (coords: [number, number]) => [number, number] | null,
): ViewBox {
  const points = [
    project([extent.minLon, extent.minLat]),
    project([extent.minLon, extent.maxLat]),
    project([extent.maxLon, extent.minLat]),
    project([extent.maxLon, extent.maxLat]),
  ].filter(Boolean) as [number, number][];

  if (!points.length) {
    return { x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT };
  }

  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const rawWidth = Math.max(160, maxX - minX);
  const rawHeight = Math.max(110, maxY - minY);
  const desiredRatio = 3.05;

  let width = rawWidth;
  let height = rawHeight;

  if (width / height > desiredRatio) {
    height = width / desiredRatio;
  } else {
    width = height * desiredRatio;
  }

  width *= 1.08;
  height *= 1.18;

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const x = clamp(centerX - width / 2, 0, Math.max(0, WORLD_WIDTH - width));
  const y = clamp(centerY - height / 2, 0, Math.max(0, WORLD_HEIGHT - height));

  return {
    x,
    y,
    width: Math.min(width, WORLD_WIDTH),
    height: Math.min(height, WORLD_HEIGHT),
  };
}

function RouteMap({ origin, destination }: { origin?: string; destination?: string }) {
  const originAirport = getAirportCoordinate(origin);
  const destinationAirport = getAirportCoordinate(destination);

  const { mapPath, start, end, routePath, planeAngle, mapLabel, viewBox } = useMemo(() => {
    const countriesObject = getObject(worldTopology, "countries");
    const countriesFeature = feature(worldTopology, countriesObject);

    const projection = geoMercator().fitExtent(
      [
        [0, 0],
        [WORLD_WIDTH, WORLD_HEIGHT],
      ],
      countriesFeature,
    );

    const lon1 = originAirport?.longitude ?? -74.17;
    const lat1 = originAirport?.latitude ?? 40.69;
    const lon2 = destinationAirport?.longitude ?? -118.4;
    const lat2 = destinationAirport?.latitude ?? 33.94;

    const mapCase = getMapCase(
      originAirport?.countryCode,
      destinationAirport?.countryCode,
      lon1,
      lat1,
      lon2,
      lat2,
    );

    const startPoint = safeProjectedPoint(projection([lon1, lat1]), { x: WORLD_WIDTH * 0.25, y: WORLD_HEIGHT * 0.5 });
    const endPoint = safeProjectedPoint(projection([lon2, lat2]), { x: WORLD_WIDTH * 0.75, y: WORLD_HEIGHT * 0.5 });

    const mapViewBox = viewBoxFromExtent(mapCase.extent, projection);
    const path = geoPath(projection)(countriesFeature) || "";

    return {
      mapPath: path,
      start: startPoint,
      end: endPoint,
      routePath: getRoutePath(startPoint, endPoint),
      planeAngle: angleBetween(startPoint, endPoint),
      mapLabel: mapCase.label,
      viewBox: mapViewBox,
    };
  }, [
    originAirport?.countryCode,
    originAirport?.latitude,
    originAirport?.longitude,
    destinationAirport?.countryCode,
    destinationAirport?.latitude,
    destinationAirport?.longitude,
  ]);

  return (
    <div
      className="relative mx-auto mt-7 h-72 w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 text-emerald-100 shadow-inner shadow-black/20"
      style={{ "--plane-angle": `${planeAngle}deg` } as CSSProperties}
    >
      <style>{`
        @keyframes mtw-map-plane {
          0% { offset-distance: 0%; opacity: 0; transform: rotate(var(--plane-angle)) scale(0.9); }
          12% { opacity: 1; transform: rotate(var(--plane-angle)) scale(1); }
          82% { opacity: 1; }
          100% { offset-distance: 100%; opacity: 0; transform: rotate(var(--plane-angle)) scale(0.94); }
        }
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
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <path d={mapPath} fill="rgba(148, 163, 184, 0.22)" stroke="rgba(148, 163, 184, 0.24)" strokeWidth="0.7" />
        <path d={routePath} fill="none" stroke="rgba(110, 231, 183, 0.95)" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="8 8" style={{ animation: "mtw-route-dash 1.2s linear infinite" }} />
        <circle cx={start.x} cy={start.y} r="4.8" fill="rgb(110, 231, 183)" />
        <circle cx={end.x} cy={end.y} r="4.8" fill="rgb(125, 211, 252)" />

        <foreignObject x={start.x - 8} y={start.y - 8} width="16" height="16">
          <div className="h-4 w-4 rounded-full border border-emerald-200/60 bg-emerald-300/20" style={{ animation: "mtw-map-pulse 1.8s ease-in-out infinite" }} />
        </foreignObject>
        <foreignObject x={end.x - 8} y={end.y - 8} width="16" height="16">
          <div className="h-4 w-4 rounded-full border border-sky-200/60 bg-sky-300/20" />
        </foreignObject>
      </svg>

      <div className="absolute left-4 top-3 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 backdrop-blur-md">
        {mapLabel}
      </div>
      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-sm font-bold text-white">
        <span>{origin?.toUpperCase() || "Origin"}</span>
        <span>{destination?.toUpperCase() || "Destination"}</span>
      </div>
    </div>
  );
}

export default function SearchLoadingExperience({ origin, destination, cabin, travelers = 1, isRoundtrip = false }: SearchLoadingExperienceProps) {
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
      { label: "Checking award space", startsAt: 1250 },
      { label: "Comparing value", startsAt: 2600 },
      { label: "Preparing verdict", startsAt: 3900 },
    ],
    [],
  );

  const activeIndex = overMinimum
    ? steps.length - 1
    : steps.reduce((latestIndex, step, index) => (elapsedMs >= step.startsAt ? index : latestIndex), 0);

  const statusText = overMinimum ? "Still pulling live availability..." : steps[Math.max(0, activeIndex)]?.label || "Starting search...";

  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/80 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
      <style>{`
        @keyframes mtw-pulse-dot {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.18); }
        }
      `}</style>

      <div className="mx-auto max-w-5xl text-center">

        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">Building your trip verdict</p>

        <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-4xl">{route}</h2>

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
            <div className="h-full rounded-full bg-emerald-300 transition-all duration-200 ease-out" style={{ width: `${overMinimum ? 100 : progress}%` }} />
          </div>
        </div>

        <div className="mx-auto mt-7 grid max-w-4xl gap-3 text-left sm:grid-cols-4">
          {steps.map((step, index) => {
            const isDone = overMinimum || elapsedMs > step.startsAt + 950;
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
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Step {index + 1}</span>
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
