"""CORS allowlist coverage: literal prod origins + Vercel branch-preview regex.

Pre-fix gap: `Backend/app/main.py` only listed prod/localhost origins in
`allow_origins`. Vercel branch-preview URLs
(`mytravelwallet-ai-git-<branch>-my-travel-walletai.vercel.app`) preflight-
400'd with no Access-Control-Allow-Origin, so the browser blocked
`/api/public-search` POSTs from any PR preview deploy. The Playwright
preview-smoke gate could not pass until this hole closed.

These tests pin the post-fix contract by exercising Starlette's actual
`CORSMiddleware` on a minimal FastAPI app wired with the SAME constants
the real app uses (imported from `app.cors_config` — single source of
truth). Importing `app.main` directly would drag in zoe_stt /
imageio_ffmpeg / riva.client which are CI-installed but not always in
local dev envs; the leaf-module approach keeps these tests runnable
anywhere.
"""

import re

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

from app.cors_config import ALLOWED_ORIGINS, ALLOWED_ORIGIN_REGEX


def _build_app() -> FastAPI:
    """Mini-app wired with the production CORS config — same constants."""
    app = FastAPI()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_origin_regex=ALLOWED_ORIGIN_REGEX,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.post("/api/public-search")
    def _stub():
        return {"ok": True}

    return app


client = TestClient(_build_app())


def _preflight(origin: str):
    return client.options(
        "/api/public-search",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )


def test_preflight_prod_origin_echoed():
    """Literal prod origin remains in the allowlist (no regression)."""
    res = _preflight("https://www.mytravelwallet.ai")
    assert res.status_code == 200
    assert (
        res.headers.get("access-control-allow-origin")
        == "https://www.mytravelwallet.ai"
    )


def test_preflight_localhost_origin_echoed():
    """Localhost dev origin remains in the allowlist (no regression)."""
    res = _preflight("http://localhost:3000")
    assert res.status_code == 200
    assert (
        res.headers.get("access-control-allow-origin") == "http://localhost:3000"
    )


def test_preflight_vercel_branch_preview_origin_echoed():
    """Real preview URL the verdict-redesign smoke spec hits must clear."""
    origin = (
        "https://mytravelwallet-ai-git-feat-verdict-redesign-"
        "my-travel-walletai.vercel.app"
    )
    res = _preflight(origin)
    assert res.status_code == 200
    assert res.headers.get("access-control-allow-origin") == origin


def test_preflight_vercel_branch_preview_with_hyphenated_branch_echoed():
    """Branch slugs include hyphens (e.g. fix/cors-preview-allowlist → fix-cors-preview-allowlist)."""
    origin = (
        "https://mytravelwallet-ai-git-fix-cors-preview-allowlist-"
        "my-travel-walletai.vercel.app"
    )
    res = _preflight(origin)
    assert res.status_code == 200
    assert res.headers.get("access-control-allow-origin") == origin


def test_preflight_foreign_vercel_project_rejected():
    """Different project prefix on a Vercel URL must NOT match the regex."""
    res = _preflight(
        "https://evilsite-git-foo-my-travel-walletai.vercel.app"
    )
    # Starlette omits ACAO when origin is rejected
    assert res.headers.get("access-control-allow-origin") is None


def test_preflight_foreign_vercel_team_rejected():
    """Correct project prefix but different team-slug suffix must NOT match."""
    res = _preflight(
        "https://mytravelwallet-ai-git-foo-some-other-team.vercel.app"
    )
    assert res.headers.get("access-control-allow-origin") is None


def test_preflight_arbitrary_vercel_app_rejected():
    """Plain `*.vercel.app` outside our project must NOT match."""
    res = _preflight("https://random-site.vercel.app")
    assert res.headers.get("access-control-allow-origin") is None


def test_preflight_non_vercel_origin_rejected():
    """Any unrelated origin must NOT match."""
    res = _preflight("https://attacker.example.com")
    assert res.headers.get("access-control-allow-origin") is None


def test_regex_compiles_and_anchors_full_string():
    """Pin the anchor characters — drop a `^` or `$` and a subdomain attack flies."""
    pattern = re.compile(ALLOWED_ORIGIN_REGEX)
    # Anchored match: extra prefix breaks it
    assert pattern.fullmatch(
        "evil.https://mytravelwallet-ai-git-foo-my-travel-walletai.vercel.app"
    ) is None
    # Anchored match: extra suffix breaks it
    assert pattern.fullmatch(
        "https://mytravelwallet-ai-git-foo-my-travel-walletai.vercel.app.evil.com"
    ) is None
