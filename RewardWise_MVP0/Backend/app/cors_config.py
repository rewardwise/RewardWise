"""CORS allowlist for the FastAPI app.

Kept in a leaf module (no FastAPI / heavy deps imported here) so the
allowlist + regex can be unit-tested in isolation without dragging in
the full `app.main` import chain — which transitively imports zoe_stt /
imageio_ffmpeg / riva.client that are CI-installed but rarely available
in scratch dev envs. `app.main` imports from here and wires them into
the actual middleware.
"""

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "https://reward-wise.vercel.app",
    "https://mytravelwallet-ai.vercel.app",
    "https://mytravelwallet.ai",
    "https://www.mytravelwallet.ai",
]

# Covers Vercel branch-preview URLs of the form
# `https://mytravelwallet-ai-git-<branch-slug>-my-travel-walletai.vercel.app`.
# Pinned to our project prefix + our team-slug suffix so an arbitrary
# `*.vercel.app` cannot ride the allowlist. Branch slug accepts lowercase
# alphanumerics + hyphens (Vercel's normalization rule). Required for the
# Playwright preview-smoke gate — without it, the browser preflight 400s
# and React renders TypeError: Failed to fetch on the search form.
ALLOWED_ORIGIN_REGEX = (
    r"^https://mytravelwallet-ai-git-[a-z0-9\-]+-my-travel-walletai\.vercel\.app$"
)
