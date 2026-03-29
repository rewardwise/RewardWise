from fastapi import APIRouter, Request
from app.services.zoe_service import handle_zoe

router = APIRouter()


@router.post("/api/zoe")
async def zoe_endpoint(request: Request):
    try:
        # 1. Read request body safely
        payload = await request.json()

        # 2. Call Zoe brain — pass request so auth flows through to run_search
        result = await handle_zoe(payload, request=request)

        # 3. Always return valid structure
        return result

    except Exception as e:
        print("ZOE ERROR:", str(e))  # shows real issue in terminal

        return {
            "type": "error",
            "message": "Zoe failed internally"
        }