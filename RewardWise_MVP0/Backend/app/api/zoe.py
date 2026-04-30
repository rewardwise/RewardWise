from fastapi import APIRouter, Request
from app.services.zoe_service import handle_zoe

router = APIRouter()


@router.post("/api/zoe")
async def zoe_endpoint(request: Request):
    try:
        payload = await request.json()
        result = await handle_zoe(payload, request=request)
        return result

    except Exception as e:
        print("ZOE ERROR:", str(e))

        return {
            "type": "error",
            "message": "Zoe failed internally"
        }
