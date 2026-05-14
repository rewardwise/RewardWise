"""
zoe/eval_ingester.py
─────────────────────
Ingests PM eval corrections into the zoe_evals table (RAG Layer 3).

Called by the PM eval API routes (app/admin/zoe_eval_routes.py).

PM evals are the highest-priority signal in the RAG system.
Corrections are retrieved and injected as negative examples in Zoe's
system prompt, preventing known failure patterns from repeating.
"""

from __future__ import annotations

from typing import Optional


async def submit_eval(
    interaction_id: str,
    pm_score: int,
    reviewer_id: str,
    *,
    factual_accuracy: bool = True,
    one_question_pass: bool = True,
    hallucination: bool = False,
    response_length_ok: bool = True,
    resolution_achieved: bool = True,
    failure_type: Optional[str] = None,
    original_response: str,
    corrected_response: Optional[str] = None,
    pm_notes: Optional[str] = None,
) -> Optional[str]:
    """
    Submit a PM eval for an interaction.

    Args:
        interaction_id:      UUID of the zoe_interactions row being evaluated
        pm_score:            Overall quality score 1–5
        reviewer_id:         UUID of the PM user
        factual_accuracy:    No factual errors (default True)
        one_question_pass:   Only one question asked (default True)
        hallucination:       A hallucination was present (default False)
        response_length_ok:  Response length was appropriate (default True)
        resolution_achieved: The user's need was addressed (default True)
        failure_type:        Category of failure if applicable
        original_response:   Zoe's original response (for the record)
        corrected_response:  PM's preferred response (becomes Layer 3 negative example)
        pm_notes:            Freeform notes for context

    Returns:
        Eval ID on success, None on failure.
    """
    try:
        from app.db.client import get_db_client
        db = get_db_client()

        row = {
            "interaction_id": interaction_id,
            "pm_score": pm_score,
            "reviewer_id": reviewer_id,
            "factual_accuracy": factual_accuracy,
            "one_question_pass": one_question_pass,
            "hallucination": hallucination,
            "response_length_ok": response_length_ok,
            "resolution_achieved": resolution_achieved,
            "failure_type": failure_type,
            "original_response": original_response,
            "corrected_response": corrected_response,
            "pm_notes": pm_notes,
        }

        result = db.table("zoe_evals").insert(row).select("id").execute()
        eval_id = (result.data or [{}])[0].get("id")

        # If score >= 4 and we have a corrected response, promote to corpus
        if pm_score >= 4 and corrected_response and eval_id:
            await _promote_correction_to_corpus(
                interaction_id=interaction_id,
                corrected_response=corrected_response,
                pm_score=pm_score,
            )

        print(f"✅ PM eval submitted: score={pm_score} interaction={interaction_id[:8]}...")
        return eval_id

    except Exception as exc:
        print(f"⚠️ Eval submission failed: {exc}")
        return None


async def _promote_correction_to_corpus(
    interaction_id: str,
    corrected_response: str,
    pm_score: int,
) -> None:
    """
    When a PM provides a corrected response (score >= 4), promote the
    corrected pair into the Layer 2 corpus as a high-quality example.
    """
    try:
        from app.db.client import get_db_client
        from app.services.zoe.rag.kb_manager import ingest_interaction

        db = get_db_client()
        result = db.table("zoe_interactions").select(
            "intent, user_message"
        ).eq("id", interaction_id).single().execute()

        row = result.data
        if not row:
            return

        await ingest_interaction(
            interaction_id=interaction_id,
            intent=row["intent"],
            user_message=row["user_message"],
            zoe_response=corrected_response,   # use the corrected version
            approval_source="pm_eval",
            rating=pm_score,
        )
    except Exception as exc:
        print(f"⚠️ Correction corpus promotion failed (non-fatal): {exc}")


async def get_weekly_sample(limit: int = 50) -> list[dict]:
    """
    Pull a stratified sample of interactions for weekly PM review.
    Stratified by intent to ensure coverage across all categories.
    """
    try:
        from app.db.client import get_db_client
        db = get_db_client()

        from datetime import datetime, timezone, timedelta
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

        result = (
            db.table("zoe_interactions")
            .select(
                "id, intent, user_message, zoe_response, is_voice, "
                "feedback_signal, created_at"
            )
            .gte("created_at", week_ago)
            .is_("feedback_signal", "null")   # unevaluated interactions
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return result.data or []

    except Exception as exc:
        print(f"⚠️ Weekly sample fetch failed: {exc}")
        return []


async def get_eval_metrics() -> dict:
    """
    Compute the six eval metrics for the metrics dashboard.
    Returns current week's numbers.
    """
    try:
        from app.db.client import get_db_client
        db = get_db_client()

        from datetime import datetime, timezone, timedelta
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

        result = (
            db.table("zoe_evals")
            .select(
                "pm_score, factual_accuracy, one_question_pass, "
                "hallucination, response_length_ok, resolution_achieved"
            )
            .gte("created_at", week_ago)
            .execute()
        )

        rows = result.data or []
        if not rows:
            return {"error": "No evals this week"}

        n = len(rows)
        return {
            "total_evals": n,
            "avg_pm_score": round(sum(r["pm_score"] for r in rows) / n, 2),
            "one_question_pct": round(sum(1 for r in rows if r["one_question_pass"]) / n * 100, 1),
            "hallucination_pct": round(sum(1 for r in rows if r["hallucination"]) / n * 100, 1),
            "factual_accuracy_pct": round(sum(1 for r in rows if r["factual_accuracy"]) / n * 100, 1),
            "resolution_pct": round(sum(1 for r in rows if r["resolution_achieved"]) / n * 100, 1),
        }

    except Exception as exc:
        print(f"⚠️ Metrics fetch failed: {exc}")
        return {"error": str(exc)}
