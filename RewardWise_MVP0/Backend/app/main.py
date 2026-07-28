from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api import health, wallet, search, verdict, newsletter
from app.api.zoe import router as zoe_router
from app.api.validators import limiter
from app.admin.zoe_eval_routes import router as zoe_admin_router
from app.api.zoe_stt import router as zoe_stt_router
from app.api.zoe_voice import router as zoe_voice_router
from app.cors_config import ALLOWED_ORIGINS, ALLOWED_ORIGIN_REGEX
from app.startup_checks import run_startup_checks

# Fail-fast BEFORE the server starts accepting traffic: must-load static data
# (transfer table etc.) is validated at import time so a broken deploy dies
# loudly here instead of silently serving reachability-blind verdicts.
run_startup_checks()

app = FastAPI(title="MyTravelWallet Backend")

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(health.router,     prefix="/api")
app.include_router(wallet.router,     prefix="/api")
app.include_router(search.router,     prefix="/api")
app.include_router(verdict.router,    prefix="/api")
app.include_router(newsletter.router, prefix="/api")
app.include_router(zoe_router)
app.include_router(zoe_admin_router)
app.include_router(zoe_stt_router)
app.include_router(zoe_voice_router)
