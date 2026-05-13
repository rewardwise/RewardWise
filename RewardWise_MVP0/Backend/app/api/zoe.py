from fastapi import APIRouter, Request
from app.services.zoe_service import handle_zoe
from app.services.zoe.interaction_logger import record_feedback

router = APIRouter()


@router.post("/api/zoe")
async def zoe_endpoint(request: Request):
    try:
        payload = await request.json()
        result = await handle_zoe(payload, request=request)
        return result
    except Exception as e:
        print("ZOE ERROR:", str(e))
        return {"type": "error", "message": "Zoe failed internally"}


@router.post("/api/zoe/feedback")
async def zoe_feedback(request: Request):
    """
    Record a feedback signal on a logged interaction.
    Called when user gives thumbs up or a search is triggered from Zoe.

    Body: { interaction_id: str, signal: "thumbs_up" | "search_triggered" }
    """
    try:
        body = await request.json()
        interaction_id = body.get("interaction_id")
        signal = body.get("signal")

        if not interaction_id or signal not in ("thumbs_up", "search_triggered"):
            return {"status": "error", "message": "Missing or invalid fields"}

        await record_feedback(interaction_id, signal)
        return {"status": "ok"}
    except Exception as e:
        print("ZOE FEEDBACK ERROR:", str(e))
        return {"status": "error", "message": str(e)}
