from fastapi import FastAPI
from app.api import health, wallet, search, verdict

app = FastAPI(title="RewardWise Backend")

# Include routers
app.include_router(health.router, prefix="/api")
app.include_router(wallet.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(verdict.router, prefix="/api")