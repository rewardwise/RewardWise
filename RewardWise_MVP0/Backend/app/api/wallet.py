from fastapi import APIRouter

router = APIRouter()

@router.get("/wallet")
def get_wallet():
    return {"message": "Wallet endpoint coming soon"}