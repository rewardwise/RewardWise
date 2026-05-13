"""
zoe/interaction_logger.py
──────────────────────────
Logs every Zoe interaction to the zoe_interactions table.
This is the ingestion feed for RAG Layer 2 and the source for PM evals.

Called at the end of every handle_zoe() turn.

Also handles the corpus_ingester logic: when a high-signal feedback event
arrives (thumbs_up, search_triggered), it automatically promotes the
interaction into the Layer 2 corpus via kb_manager.ingest_interaction().
"""

from __future__ import annotations

import re
from typing import Optional
from unittest import result


def _strip_pii(text: str) -> str:
    """Remove common PII patterns before storing interaction data."""
    # Email addresses
    text = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[EMAIL]', text)
    # US phone numbers
    text = re.sub(r'\b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b', '[PHONE]', text)
    # Credit card numbers (16 digits)
    text = re.sub(r'\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b', '[CARD]', text)
    # SSN
    text = re.sub(r'\b\d{3}-\d{2}-\d{4}\b', '[SSN]', text)
    return text


async def log(
    session_id: str,
    user_id: Optional[str],
    intent: str,
    user_message: str,
    zoe_response: str,
    *,
    conversation_id: Optional[str] = None,
    is_voice: bool = False,
    feedback_signal: Optional[str] = None,
) -> Optional[str]:
    """
    Log a Zoe interaction to the database.

    Returns the interaction ID (UUID) on success, None on failure.
    Failure is non-fatal — we never let logging break the user experience.
    """
    try:
        from app.db.client import get_db_client
        db = get_db_client()

        clean_message = _strip_pii(user_message)
        clean_response = zoe_response  # responses don't contain user PII

        row = {
            "session_id": session_id,
            "user_id": user_id,
            "conversation_id": conversation_id,
            "intent": intent,
            "user_message": clean_message,
            "zoe_response": clean_response,
            "is_voice": is_voice,
            "feedback_signal": feedback_signal,
        }

        result = db.table("zoe_interactions").insert(row).execute()
        interaction_id = (result.data or [{}])[0].get("id")

        # Auto-promote to corpus if we have a strong signal
        if feedback_signal in ("thumbs_up", "search_triggered") and interaction_id:
            await _maybe_ingest_corpus(
                interaction_id=interaction_id,
                intent=intent,
                user_message=clean_message,
                zoe_response=clean_response,
                approval_source=feedback_signal,
            )

        return interaction_id

    except Exception as exc:
        print(f"⚠️ Interaction log failed (non-fatal): {exc}")
        return None


async def record_feedback(
    interaction_id: str,
    signal: str,
) -> None:
    """
    Update an existing interaction with a feedback signal.
    Called when the user gives thumbs up or a search is triggered.
    Also promotes to corpus automatically.
    """
    try:
        from app.db.client import get_db_client
        db = get_db_client()

        db.table("zoe_interactions").update(
            {"feedback_signal": signal}
        ).eq("id", interaction_id).execute()

        # Fetch the interaction to promote to corpus
        result = db.table("zoe_interactions").select(
            "intent, user_message, zoe_response"
        ).eq("id", interaction_id).single().execute()

        row = result.data
        if row:
            await _maybe_ingest_corpus(
                interaction_id=interaction_id,
                intent=row["intent"],
                user_message=row["user_message"],
                zoe_response=row["zoe_response"],
                approval_source=signal,
            )

    except Exception as exc:
        print(f"⚠️ Feedback record failed (non-fatal): {exc}")


async def _maybe_ingest_corpus(
    interaction_id: str,
    intent: str,
    user_message: str,
    zoe_response: str,
    approval_source: str,
    rating: Optional[int] = None,
) -> None:
    """
    Attempt to ingest into Layer 2 corpus.
    Non-fatal — corpus ingestion failure doesn't affect anything else.
    """
    try:
        from app.services.zoe.rag.kb_manager import ingest_interaction
        await ingest_interaction(
            interaction_id=interaction_id,
            intent=intent,
            user_message=user_message,
            zoe_response=zoe_response,
            approval_source=approval_source,
            rating=rating,
        )
    except Exception as exc:
        print(f"⚠️ Corpus ingestion failed (non-fatal): {exc}")
