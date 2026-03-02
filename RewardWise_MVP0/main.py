from fastapi import FastAPI, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel
from typing import Optional, List

app = FastAPI()

# Allow frontend to access backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",      # Local React dev server (most common)
        "http://localhost:5173",      # Vite dev server
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],  # or specify ["http://localhost:3000", "https://your-frontend-url.com"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------
# 1) Wallet Setup
# -------------------------------
class WalletPayload(BaseModel):
    userId: str
    cardInfo: str
    balance: float

@app.post("/wallet/connect")
async def connect_wallet(payload: WalletPayload):
    # TODO: Save to DB
    return {"status": "success", "redirect": "/home"}

# -------------------------------
# 2) Trip Search Form
# -------------------------------
class TripSearchPayload(BaseModel):
    origin: str
    destination: str
    departure_date: str
    return_date: Optional[str] = None

@app.post("/trip/search")
async def trip_search(payload: TripSearchPayload):
    # Validate inputs
    if not payload.origin or not payload.destination:
        return {"status": "error", "message": "Origin and destination required"}
    
    # Mock API call
    results = {
        "flights": [
            {"airline": "DemoAir", "price": 250, "duration": "3h"},
            {"airline": "SampleJet", "price": 300, "duration": "2h 45m"}
        ]
    }
    return {"status": "success", "data": results}

# -------------------------------
# 3) Static Verdict JSON
# -------------------------------
@app.get("/verdict/static")
async def get_static_verdict():
    return {
        "verdict": "Approved",
        "confidence": 0.92,
        "issues": ["Missing section A", "Inconsistent balance"]
    }

# -------------------------------
# 4) Portfolio Persistence Layer (Stub)
# -------------------------------
class PortfolioPayload(BaseModel):
    userId: str
    assets: List[str]
    balances: List[float]

@app.post("/portfolio/save")
async def save_portfolio(payload: PortfolioPayload):
    # TODO: Persist to DB in future
    return {"status": "stubbed", "message": "Portfolio persistence not yet implemented"}