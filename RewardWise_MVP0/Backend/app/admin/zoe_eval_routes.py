"""
app/admin/zoe_eval_routes.py
─────────────────────────────
FastAPI routes for the PM eval workflow (Phase 4).

Endpoints:
  GET  /admin/zoe/evals/sample         — weekly sample for PM review
  POST /admin/zoe/evals/submit         — submit a PM eval + correction
  GET  /admin/zoe/evals/metrics        — live eval metrics dashboard data
  GET  /admin/zoe/kb/articles          — list KB articles
  POST /admin/zoe/kb/articles          — create KB article
  PUT  /admin/zoe/kb/articles/{id}     — update KB article
  DELETE /admin/zoe/kb/articles/{id}   — delete KB article
  POST /admin/zoe/kb/rpc               — create Supabase RPC functions (run once)

All routes require PM authentication.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.services.zoe.eval_ingester import (
    submit_eval,
    get_weekly_sample,
    get_eval_metrics,
)
from app.services.zoe.rag.kb_manager import (
    create_article,
    update_article,
    delete_article,
    list_articles,
    create_rpc_functions,
)

router = APIRouter(prefix="/admin/zoe", tags=["zoe-admin"])


# ── Auth helper ───────────────────────────────────────────────────────────────

async def require_pm(request: Request) -> str:
    """
    Verify the request comes from a PM user.
    Returns the user_id on success, raises 401/403 on failure.
    """
    import os, httpx
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")

    token = auth_header[7:]
    supabase_url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{supabase_url}/auth/v1/user",
                headers={"Authorization": f"Bearer {token}", "apikey": service_key},
            )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")

        user = resp.json()

        # Check PM role — stored in profiles or app_metadata
        # Adjust this check to match your actual role structure
        app_meta = user.get("app_metadata", {})
        user_meta = user.get("user_metadata", {})
        is_pm = (
            app_meta.get("role") in ("pm", "admin")
            or user_meta.get("role") in ("pm", "admin")
        )
        if not is_pm:
            pm_emails_env = os.environ.get("PM_TESTER_EMAILS", "")
            pm_emails = [e.strip() for e in pm_emails_env.split(",") if e.strip()]
            if user.get("email", "").lower() not in pm_emails:
                raise HTTPException(status_code=403, detail="PM access required")

        return user["id"]

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail=str(exc))


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class EvalSubmission(BaseModel):
    interaction_id:      str
    pm_score:            int = Field(..., ge=1, le=5)
    factual_accuracy:    bool = True
    one_question_pass:   bool = True
    hallucination:       bool = False
    response_length_ok:  bool = True
    resolution_achieved: bool = True
    failure_type:        Optional[str] = None
    original_response:   str
    corrected_response:  Optional[str] = None
    pm_notes:            Optional[str] = None


class ArticleCreate(BaseModel):
    title:    str
    category: str
    content:  str
    tags:     list[str] = []
    publish:  bool = False


class ArticleUpdate(BaseModel):
    title:   Optional[str] = None
    content: Optional[str] = None
    tags:    Optional[list[str]] = None
    publish: Optional[bool] = None


# ── Eval routes ───────────────────────────────────────────────────────────────

@router.get("/evals/sample")
async def get_sample(
    limit: int = 50,
    user_id: str = Depends(require_pm),
):
    """Pull the weekly interaction sample for PM review."""
    sample = await get_weekly_sample(limit=limit)
    return {"interactions": sample, "count": len(sample)}


@router.post("/evals/submit")
async def submit(
    body: EvalSubmission,
    user_id: str = Depends(require_pm),
):
    """Submit a PM eval for an interaction."""
    eval_id = await submit_eval(
        interaction_id=body.interaction_id,
        pm_score=body.pm_score,
        reviewer_id=user_id,
        factual_accuracy=body.factual_accuracy,
        one_question_pass=body.one_question_pass,
        hallucination=body.hallucination,
        response_length_ok=body.response_length_ok,
        resolution_achieved=body.resolution_achieved,
        failure_type=body.failure_type,
        original_response=body.original_response,
        corrected_response=body.corrected_response,
        pm_notes=body.pm_notes,
    )
    if not eval_id:
        raise HTTPException(status_code=500, detail="Eval submission failed")
    return {"eval_id": eval_id, "status": "submitted"}


@router.get("/evals/metrics")
async def get_metrics(user_id: str = Depends(require_pm)):
    """Get the current week's eval metrics for the dashboard."""
    metrics = await get_eval_metrics()
    return metrics


# ── KB article routes ─────────────────────────────────────────────────────────

@router.get("/kb/articles")
async def list_kb_articles(
    category: Optional[str] = None,
    published_only: bool = False,
    user_id: str = Depends(require_pm),
):
    """List knowledge base articles."""
    articles = await list_articles(category=category, published_only=published_only)
    return {"articles": articles, "count": len(articles)}


@router.post("/kb/articles")
async def create_kb_article(
    body: ArticleCreate,
    user_id: str = Depends(require_pm),
):
    """Create a new KB article. Automatically generates embedding."""
    article = await create_article(
        title=body.title,
        category=body.category,
        content=body.content,
        tags=body.tags,
        publish=body.publish,
    )
    return {"article": article, "status": "created"}


@router.put("/kb/articles/{article_id}")
async def update_kb_article(
    article_id: str,
    body: ArticleUpdate,
    user_id: str = Depends(require_pm),
):
    """Update a KB article. Re-embeds automatically if title or content changed."""
    article = await update_article(
        article_id,
        title=body.title,
        content=body.content,
        tags=body.tags,
        publish=body.publish,
    )
    return {"article": article, "status": "updated"}


@router.delete("/kb/articles/{article_id}")
async def delete_kb_article(
    article_id: str,
    user_id: str = Depends(require_pm),
):
    """Delete a KB article."""
    await delete_article(article_id)
    return {"status": "deleted", "id": article_id}


@router.post("/kb/rpc")
async def setup_rpc_functions(user_id: str = Depends(require_pm)):
    """
    Create the pgvector RPC functions in Supabase.
    Run this once after applying migrations.
    """
    success = await create_rpc_functions()
    if not success:
        raise HTTPException(
            status_code=500,
            detail="RPC function creation failed. Run the SQL manually in Supabase."
        )
    return {"status": "rpc functions created"}
