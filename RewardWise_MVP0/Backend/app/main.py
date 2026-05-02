from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api import health, wallet, search, verdict
from app.api.zoe import router as zoe_router
from app.api.validators import limiter


# ✅ CREATE APP ONLY ONCE
app = FastAPI(title="MyTravelWallet Backend")

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://reward-wise.vercel.app",
        "https://mytravelwallet-ai.vercel.app",
        "https://mytravelwallet.ai",
        "https://www.mytravelwallet.ai",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Routers
app.include_router(health.router, prefix="/api")
app.include_router(wallet.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(verdict.router, prefix="/api")


app.include_router(zoe_router)
