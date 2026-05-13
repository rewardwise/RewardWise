from fastapi import APIRouter, Depends, HTTPException, Request
from app.api.validators import limiter
from app.services.zoe_service import handle_zoe
from app.services.zoe.interaction_logger import record_feedback

router = APIRouter()


async def require_user(request: Request) -> str:
    import os
    import httpx

    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")

    token = auth_header[7:]
    supabase_url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not service_key:
        raise HTTPException(status_code=500, detail="Auth verification is not configured")

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{supabase_url}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": service_key,
                },
            )
    except Exception:
        raise HTTPException(status_code=401, detail="Could not verify session")

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session")

    user = resp.json()
    user_id = user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid session")

    return user_id


@router.post("/api/zoe")
@limiter.limit("20/minute")
async def zoe_endpoint(request: Request, auth_user_id: str = Depends(require_user)):
    try:
        payload = await request.json()
        payload["user_id"] = auth_user_id
        result = await handle_zoe(payload, request=request)
        return result
    except HTTPException:
        raise
    except Exception as e:
        print("ZOE ERROR:", str(e))
        return {"type": "error", "message": "Zoe failed internally"}


@router.post("/api/zoe/feedback")
@limiter.limit("30/minute")
async def zoe_feedback(request: Request, auth_user_id: str = Depends(require_user)):
    try:
        body = await request.json()
        interaction_id = body.get("interaction_id")
        signal = body.get("signal")

        if not interaction_id or signal not in ("thumbs_up", "search_triggered"):
            raise HTTPException(status_code=400, detail="Missing or invalid fields")

        await record_feedback(interaction_id, signal)
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        print("ZOE FEEDBACK ERROR:", str(e))
        raise HTTPException(status_code=500, detail="Feedback could not be recorded")