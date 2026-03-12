from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import health, wallet, search, verdict
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.api.validators import limiter

app = FastAPI(title="RewardWise Backend")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS (for Next.js frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # update later for prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix="/api")
app.include_router(wallet.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(verdict.router, prefix="/api")