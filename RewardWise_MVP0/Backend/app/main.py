from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import health, wallet, search, verdict
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.api.validators import limiter
from app.schemas.zoe import ZoeRequest
from app.api.zoe import handle_zoe

app = FastAPI(title="RewardWise Backend")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS (for Next.js frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://reward-wise.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Include routers
app.include_router(health.router, prefix="/api")
app.include_router(wallet.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(verdict.router, prefix="/api")

@app.post("/api/zoe")
async def zoe_handler(req: ZoeRequest):
    return await handle_zoe(req.message, req.user_id)