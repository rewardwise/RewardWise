"""
RW-047: Input validation + rate limiting
Shared Pydantic validators and rate limiter setup for /search and /verdict.
"""

import re
from datetime import date, datetime
from enum import Enum
from typing import Optional

from fastapi import HTTPException
from pydantic import BaseModel, field_validator


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class CabinClass(str, Enum):
    economy = "economy"
    business = "business"
    first = "first"


# ---------------------------------------------------------------------------
# Shared search params validator
# Used by both /search and /verdict endpoints via Depends()
# ---------------------------------------------------------------------------

class SearchParams(BaseModel):
    origin: str
    destination: str
    date: str
    date_end: Optional[str] = None
    cabin: CabinClass = CabinClass.economy
    travelers: int = 1
    return_date: Optional[str] = None

    @field_validator("origin", "destination")
    @classmethod
    def validate_airport_code(cls, v: str) -> str:
        code = v.strip().upper()
        # Force Render rebuild 2026-05-08 — validators.py was missing in deploy despite being on main
        if not re.fullmatch(r"[A-Z]{3}(,[A-Z]{3}){0,4}", code):
            raise ValueError(
                "Airport code must be 1-5 comma-separated 3-letter codes (e.g. JFK or JFK,LGA,EWR)"
            )
        return code

    @field_validator("date", "date_end", "return_date", mode="before")
    @classmethod
    def validate_date_format(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        try:
            parsed = datetime.strptime(v.strip(), "%Y-%m-%d").date()
        except ValueError:
            raise ValueError("Date must be in YYYY-MM-DD format (e.g. 2026-05-01)")
        if parsed < date.today():
            raise ValueError("Date cannot be in the past")
        return v.strip()

    @field_validator("travelers")
    @classmethod
    def validate_travelers(cls, v: int) -> int:
        if not (1 <= v <= 9):
            raise ValueError("Travelers must be between 1 and 9")
        return v

    def model_post_init(self, __context) -> None:
        """Cross-field: origin and destination must be disjoint, return_date after date,
        date_end >= date when range mode requested."""
        origin_set = set(self.origin.split(","))
        dest_set = set(self.destination.split(","))
        overlap = origin_set & dest_set
        if overlap:
            raise ValueError(
                f"Origin and destination cannot share airports: {sorted(overlap)}"
            )
        if self.date_end:
            dep = datetime.strptime(self.date, "%Y-%m-%d").date()
            dep_end = datetime.strptime(self.date_end, "%Y-%m-%d").date()
            if dep_end < dep:
                raise ValueError("date_end must be on or after date")
        if self.return_date:
            dep = datetime.strptime(self.date, "%Y-%m-%d").date()
            ret = datetime.strptime(self.return_date, "%Y-%m-%d").date()
            if ret <= dep:
                raise ValueError("return_date must be after departure date")


# ---------------------------------------------------------------------------
# Rate limiter setup (SlowAPI — drop-in for FastAPI)
# ---------------------------------------------------------------------------

from slowapi import Limiter
from slowapi.util import get_remote_address

# 10 requests / minute per IP on search + verdict endpoints
limiter = Limiter(key_func=get_remote_address, default_limits=["10/minute"])