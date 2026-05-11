#!/usr/bin/env bash
# Smoke test for Vercel preview deployments.
# Usage:
#   ./scripts/smoke-test-vercel-preview.sh <PREVIEW_URL> [BYPASS_TOKEN]
#
# If Vercel Deployment Protection is on, pass the bypass token as arg 2.
# Get the token from Vercel project settings > Deployment Protection > Protection Bypass for Automation.
#
# Exits non-zero if any test fails.

set -u

PREVIEW_URL="${1:-}"
BYPASS_TOKEN="${2:-}"

if [ -z "$PREVIEW_URL" ]; then
  echo "Usage: $0 <PREVIEW_URL> [BYPASS_TOKEN]"
  exit 2
fi

# Build curl flags
CURL_FLAGS=(-s)
if [ -n "$BYPASS_TOKEN" ]; then
  CURL_FLAGS+=(-H "x-vercel-protection-bypass: $BYPASS_TOKEN")
fi

FAILED=0
echo "=== Smoke test: $PREVIEW_URL ==="

# Test 1 — 200 OK
STATUS=$(curl "${CURL_FLAGS[@]}" -o /dev/null -w "%{http_code}" "$PREVIEW_URL")
if [ "$STATUS" = "200" ]; then
  echo "✓ Test 1 — 200 OK"
else
  echo "✗ Test 1 — got $STATUS (expected 200)"
  if [ "$STATUS" = "401" ]; then
    echo "  Hint: Vercel Deployment Protection is on. Pass a bypass token as arg 2."
  fi
  FAILED=1
fi

# Test 2 — viewport meta with viewport-fit=cover
VIEWPORT=$(curl "${CURL_FLAGS[@]}" "$PREVIEW_URL" | grep -oE '<meta[^>]*name="viewport"[^>]*>' | head -1)
if echo "$VIEWPORT" | grep -q "viewport-fit=cover" && \
   echo "$VIEWPORT" | grep -q "width=device-width" && \
   echo "$VIEWPORT" | grep -q "initial-scale=1"; then
  echo "✓ Test 2 — viewport meta present with viewport-fit=cover"
else
  echo "✗ Test 2 — viewport meta missing or incomplete"
  echo "  Found: $VIEWPORT"
  FAILED=1
fi

# Test 3 — theme-color meta
THEME=$(curl "${CURL_FLAGS[@]}" "$PREVIEW_URL" | grep -oE '<meta[^>]*name="theme-color"[^>]*>' | head -1)
if echo "$THEME" | grep -q '#0f172a'; then
  echo "✓ Test 3 — theme-color #0f172a present"
else
  echo "✗ Test 3 — theme-color missing or wrong value"
  echo "  Found: $THEME"
  FAILED=1
fi

# Test 4 — critical routes
echo "--- Route check ---"
for path in "/" "/home" "/concierge"; do
  ROUTE_STATUS=$(curl "${CURL_FLAGS[@]}" -o /dev/null -w "%{http_code}" "${PREVIEW_URL}${path}")
  if [ "$ROUTE_STATUS" -lt "500" ]; then
    echo "  ✓ $path -> $ROUTE_STATUS"
  else
    echo "  ✗ $path -> $ROUTE_STATUS (5xx error)"
    FAILED=1
  fi
done

echo "==="
if [ "$FAILED" = "0" ]; then
  echo "ALL CHECKS PASSED"
  exit 0
else
  echo "SOME CHECKS FAILED"
  exit 1
fi
