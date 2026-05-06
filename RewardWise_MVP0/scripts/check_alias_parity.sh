#!/usr/bin/env bash
# Drift detector for PROGRAM_ALIASES across the TS frontend and Python backend.
#
# Compares the set of (seats.aero source key, sorted alias list) tuples in
#   Frontend/utils/programAliases.ts
#   Backend/app/program_aliases.py
# Exits 0 on parity, 1 on mismatch (with a unified diff to stderr).
#
# Run locally:    bash RewardWise_MVP0/scripts/check_alias_parity.sh
# CI invocation:  same — script self-locates regardless of cwd.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." &> /dev/null && pwd)"

TS_FILE="$REPO_ROOT/Frontend/utils/programAliases.ts"
PY_FILE="$REPO_ROOT/Backend/app/program_aliases.py"

if [[ ! -f "$TS_FILE" ]]; then
  echo "ERROR: $TS_FILE not found" >&2
  exit 2
fi
if [[ ! -f "$PY_FILE" ]]; then
  echo "ERROR: $PY_FILE not found" >&2
  exit 2
fi

# Extract a normalized "key=alias1,alias2,..." line per dict entry.
# Strategy: pull the lines between the dict literal's opening and closing braces,
# strip comments, drop section dividers and blank lines, then normalize.
normalize() {
  local file="$1"
  python3 - "$file" <<'PY'
import re
import sys

path = sys.argv[1]
text = open(path, "r", encoding="utf-8").read()

# Find first opening brace after "PROGRAM_ALIASES" and its matching close.
m = re.search(r"PROGRAM_ALIASES[^{]*\{", text)
if not m:
    sys.exit(f"PROGRAM_ALIASES not found in {path}")
start = m.end() - 1
depth = 0
end = None
for i in range(start, len(text)):
    if text[i] == "{":
        depth += 1
    elif text[i] == "}":
        depth -= 1
        if depth == 0:
            end = i
            break
if end is None:
    sys.exit(f"unterminated PROGRAM_ALIASES literal in {path}")

body = text[start + 1:end]

# Per line: drop // and # comments, strip whitespace.
entries = []
for raw in body.splitlines():
    line = raw
    line = re.sub(r"//.*$", "", line)
    line = re.sub(r"#.*$", "", line)
    line = line.strip()
    if not line:
        continue
    # Match "key": [...] or key: [...]  (TS allows unquoted keys, Python requires quotes)
    em = re.match(r'^"?([A-Za-z_][A-Za-z0-9_]*)"?\s*:\s*\[(.*?)\]\s*,?\s*$', line)
    if not em:
        continue
    key = em.group(1)
    inner = em.group(2).strip()
    if not inner:
        aliases = []
    else:
        aliases = [a.strip().strip('"').strip("'") for a in inner.split(",") if a.strip()]
    entries.append(f"{key}={','.join(aliases)}")

entries.sort()
print("\n".join(entries))
PY
}

TS_NORM="$(mktemp)"
PY_NORM="$(mktemp)"
trap 'rm -f "$TS_NORM" "$PY_NORM"' EXIT

normalize "$TS_FILE" > "$TS_NORM"
normalize "$PY_FILE" > "$PY_NORM"

if diff -u "$TS_NORM" "$PY_NORM" > /dev/null; then
  echo "OK — PROGRAM_ALIASES parity confirmed across frontend + backend."
  exit 0
fi

echo "DRIFT DETECTED — Frontend/utils/programAliases.ts disagrees with Backend/app/program_aliases.py" >&2
echo "" >&2
diff -u --label "programAliases.ts (normalized)" --label "program_aliases.py (normalized)" "$TS_NORM" "$PY_NORM" >&2
exit 1
