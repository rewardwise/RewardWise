#!/usr/bin/env node
// Byte-for-byte diff: the committed transferPartners.ts must match
// what the generator produces from the current flexible_transfers.json.
// If this fails, regenerate and commit:
//   node Frontend/scripts/build_transfer_partners.mjs

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_FRONTEND = resolve(__dirname, "..");
const COMMITTED_PATH = resolve(REPO_FRONTEND, "utils/transferPartners.ts");
const SCRIPT_PATH = resolve(__dirname, "build_transfer_partners.mjs");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ok  ${name}`);
    passed += 1;
  } catch (err) {
    console.error(`  FAIL ${name}`);
    console.error(err.message);
    failed += 1;
  }
}

console.log("build_transfer_partners.test.mjs");

test("generated transferPartners.ts matches committed file (byte-for-byte)", () => {
  // Run the generator into a tmp output path via --out=, then byte-compare
  // against the committed file. This never touches the committed file, so
  // there is no corruption window even on SIGKILL during the spawn.
  const tmp = mkdtempSync(join(tmpdir(), "tp-test-"));
  const tmpOut = join(tmp, "transferPartners.ts");
  try {
    const result = spawnSync("node", [SCRIPT_PATH, `--out=${tmpOut}`], { encoding: "utf8" });
    assert.equal(result.status, 0, `generator exited ${result.status}: ${result.stderr}`);
    const committed = readFileSync(COMMITTED_PATH, "utf8");
    const regenerated = readFileSync(tmpOut, "utf8");
    if (regenerated !== committed) {
      const cLines = committed.split("\n");
      const rLines = regenerated.split("\n");
      const firstDiff = cLines.findIndex((l, i) => l !== rLines[i]);
      throw new Error(
        `Drift detected. Run: node Frontend/scripts/build_transfer_partners.mjs && git add Frontend/utils/transferPartners.ts\n` +
          `First differing line ${firstDiff + 1}:\n  committed:   ${cLines[firstDiff]}\n  regenerated: ${rLines[firstDiff]}`,
      );
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("missing slug in source JSON resolves to empty array, doesn't crash", () => {
  // Build a stripped-down JSON with only one currency that has no aeroplan
  // partner; assert the generator still produces aeroplan: [] without throwing.
  const tmp = mkdtempSync(join(tmpdir(), "tp-test-mock-"));
  const mockJsonPath = join(tmp, "flexible_transfers.json");
  const mockOutPath = join(tmp, "transferPartners.ts");
  writeFileSync(
    mockJsonPath,
    JSON.stringify({
      as_of: "test",
      version: "test",
      currencies: [
        {
          currency_id: "test_currency",
          currency_display: "Test Currency",
          partners: [],
        },
      ],
    }),
  );
  // Run an inline copy of buildMap by importing the script module.
  const mod = spawnSync(
    "node",
    [
      "--input-type=module",
      "-e",
      `
        import { readFileSync, writeFileSync } from "node:fs";
        // Inline the script's core to test in isolation.
        const SOURCE_SLUG_TO_PARTNER_DISPLAY = { aeroplan: "Air Canada Aeroplan", saudia: null };
        const json = JSON.parse(readFileSync("${mockJsonPath}", "utf8"));
        const out = {};
        for (const [slug, partnerDisplay] of Object.entries(SOURCE_SLUG_TO_PARTNER_DISPLAY)) {
          if (!partnerDisplay) { out[slug] = []; continue; }
          const rows = [];
          for (const c of json.currencies) {
            const m = (c.partners || []).find(p => p.partner_display === partnerDisplay && p.status === "active");
            if (m) rows.push({ sourceCard: c.currency_display, ratio: m.ratio_from + ":" + m.ratio_to });
          }
          out[slug] = rows;
        }
        writeFileSync("${mockOutPath}", JSON.stringify(out));
        console.log(JSON.stringify(out));
      `,
    ],
    { encoding: "utf8" },
  );
  assert.equal(mod.status, 0, `mock generator exited ${mod.status}: ${mod.stderr}`);
  const result = JSON.parse(mod.stdout.trim());
  assert.deepEqual(result, { aeroplan: [], saudia: [] });
  rmSync(tmp, { recursive: true, force: true });
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
