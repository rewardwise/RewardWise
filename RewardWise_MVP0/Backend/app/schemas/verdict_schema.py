from pydantic import BaseModel
from typing import Any


class RewardOption(BaseModel):
    program: str
    cpp: float
    cash_price_used: float
    points_cost_used: int
    verdict: str


class VerdictResponse(BaseModel):
    recommendation: str
    summary: str
    details: dict[str, Any]
    cpp: float
    cash_price_used: float
    points_cost_used: int
    alternatives: list[RewardOption]
