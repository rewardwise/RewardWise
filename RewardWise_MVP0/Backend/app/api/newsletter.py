"""Public newsletter signup endpoint (unauthenticated, rate-limited, service-role write)."""

import logging
import re

from fastapi import APIRouter, Request
from pydantic import BaseModel, field_validator

from app.api.search import _client_ip_from_request, _hash_public_trial_value
from app.api.validators import limiter
from app.db import get_server_supabase, insert_one
from app.db.errors import DbError

router = APIRouter()
log = logging.getLogger(__name__)

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class NewsletterSignupRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def _validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL_RE.match(v):
            raise ValueError("invalid email format")
        return v


class NewsletterSignupResponse(BaseModel):
    status: str  # "subscribed" | "already_subscribed"


@router.post("/newsletter", response_model=NewsletterSignupResponse)
@limiter.limit("10/hour")
async def newsletter_signup(
    request: Request,
    body: NewsletterSignupRequest,
) -> NewsletterSignupResponse:
    email_normalized = body.email  # already stripped + lowercased by field_validator
    ip_hash = _hash_public_trial_value(_client_ip_from_request(request))

    supabase = get_server_supabase()

    existing = (
        supabase
        .from_("newsletter_signups")
        .select("id")
        .eq("email", email_normalized)
        .limit(1)
        .execute()
    )
    if existing.data:
        return NewsletterSignupResponse(status="already_subscribed")

    try:
        insert_one(supabase, "newsletter_signups", {
            "email": email_normalized,
            "ip_hash": ip_hash,
            "source": "landing-footer",
        })
    except DbError as exc:
        if exc.code == "UNIQUE_VIOLATION":
            return NewsletterSignupResponse(status="already_subscribed")
        log.exception("newsletter signup insert failed", extra={"email_hash": ip_hash})
        raise
    except Exception:
        log.exception("newsletter signup insert failed", extra={"email_hash": ip_hash})
        raise

    return NewsletterSignupResponse(status="subscribed")
