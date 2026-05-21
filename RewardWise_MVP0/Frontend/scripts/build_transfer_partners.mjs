#!/usr/bin/env node
// Generates Frontend/utils/transferPartners.ts from
// Backend/app/data/loyalty/flexible_transfers.json.
//
// Source of truth lives in the backend JSON. Run via `pnpm prebuild` or
// `node scripts/build_transfer_partners.mjs` to refresh the generated file.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = resolve(
  __dirname,
  "../../Backend/app/data/loyalty/flexible_transfers.json",
);
const OUTPUT_PATH = resolve(__dirname, "../utils/transferPartners.ts");

// seats.aero source slug → flexible_transfers.json partner_display string.
// Centralized here because PROGRAM_ALIASES does not directly carry the
// transfer-partner display name and the two vocabularies don't match 1:1.
const SOURCE_SLUG_TO_PARTNER_DISPLAY = {
  aeroplan: "Air Canada Aeroplan",
  united: "United MileagePlus",
  delta: "Delta SkyMiles",
  american: "American AAdvantage",
  alaska: null, // Alaska does not accept transfers from major flex programs
  jetblue: "JetBlue TrueBlue",
  flyingblue: "Flying Blue",
  air_france: "Flying Blue",
  virginatlantic: "Virgin Atlantic Flying Club",
  british: "British Airways Executive Club",
  singapore: "Singapore KrisFlyer",
  cathay: "Cathay Asia Miles",
  emirates: "Emirates Skywards",
  turkish: "Turkish Miles&Smiles",
  qantas: "Qantas Frequent Flyer",
  avianca: "Avianca LifeMiles",
  lifemiles: "Avianca LifeMiles",
  etihad: "Etihad Guest",
  qatar: "Qatar Airways Privilege Club",
  saudia: null,
  smiles: null,
  azul: null,
  korean: null,
  ana: "ANA Mileage Club",
  hyatt: "World of Hyatt",
  marriott: "Marriott Bonvoy",
};

const SHORT_NAMES = {
  "Chase Ultimate Rewards": "Chase UR",
  "Amex Membership Rewards": "Amex MR",
  "Citi ThankYou Points": "Citi TYP",
  "Capital One Miles": "Cap1 Miles",
  "Bilt Rewards": "Bilt",
  "Wells Fargo Rewards": "Wells Fargo",
  "Bank of America Premium Rewards": "BofA Premium",
};

function formatRatio(from, to) {
  if (from === to) return "1:1";
  if (from === 1) return `1:${to}`;
  return `${from}:${to}`;
}

function ratioQuality(from, to) {
  return to / from;
}

function speedRank(speed) {
  if (speed === "instant") return 0;
  return 1;
}

function buildMap(json) {
  const out = {};
  for (const [slug, partnerDisplay] of Object.entries(SOURCE_SLUG_TO_PARTNER_DISPLAY)) {
    if (!partnerDisplay) {
      out[slug] = [];
      continue;
    }
    const rows = [];
    for (const currency of json.currencies) {
      const cardName = currency.currency_display;
      const short = SHORT_NAMES[cardName] || cardName;
      const match = (currency.partners || []).find(
        (p) => p.partner_display === partnerDisplay && p.status === "active",
      );
      if (!match) continue;
      rows.push({
        sourceCard: cardName,
        short,
        ratio: formatRatio(match.ratio_from, match.ratio_to),
        speed: match.speed,
        _quality: ratioQuality(match.ratio_from, match.ratio_to),
        _speed: speedRank(match.speed),
      });
    }
    rows.sort((a, b) => {
      if (b._quality !== a._quality) return b._quality - a._quality;
      return a._speed - b._speed;
    });
    out[slug] = rows.map(({ _quality, _speed, ...rest }) => rest);
  }
  return out;
}

function render(map, sourcePath) {
  const lines = [
    "/** @format */",
    "// AUTO-GENERATED — do not edit by hand.",
    `// Source: ${sourcePath.replace(/^.*\/RewardWise_MVP0\//, "RewardWise_MVP0/")}`,
    "// Regenerate: node Frontend/scripts/build_transfer_partners.mjs",
    "",
    "export interface TransferPartner {",
    "  sourceCard: string;",
    "  short: string;",
    "  ratio: string;",
    "  speed: string;",
    "}",
    "",
    "export const TRANSFER_PARTNERS: Record<string, TransferPartner[]> = {",
  ];
  for (const [slug, partners] of Object.entries(map)) {
    if (partners.length === 0) {
      lines.push(`  ${slug}: [],`);
      continue;
    }
    lines.push(`  ${slug}: [`);
    for (const p of partners) {
      lines.push(
        `    { sourceCard: ${JSON.stringify(p.sourceCard)}, short: ${JSON.stringify(p.short)}, ratio: ${JSON.stringify(p.ratio)}, speed: ${JSON.stringify(p.speed)} },`,
      );
    }
    lines.push("  ],");
  }
  lines.push("};", "");
  return lines.join("\n");
}

function parseOutPath(argv) {
  // Supports `--out=<path>` for tests / dry-runs without touching the
  // committed file. Defaults to OUTPUT_PATH for production use.
  for (const arg of argv) {
    if (arg.startsWith("--out=")) return resolve(arg.slice("--out=".length));
  }
  return OUTPUT_PATH;
}

function main() {
  const outPath = parseOutPath(process.argv.slice(2));
  const json = JSON.parse(readFileSync(SOURCE_PATH, "utf8"));
  const map = buildMap(json);
  const output = render(map, SOURCE_PATH);
  writeFileSync(outPath, output, "utf8");
  const total = Object.values(map).reduce((n, arr) => n + arr.length, 0);
  const covered = Object.values(map).filter((arr) => arr.length > 0).length;
  console.log(
    `[build_transfer_partners] wrote ${outPath} — ${covered}/${Object.keys(map).length} slugs with partners, ${total} total rows`,
  );
}

main();
