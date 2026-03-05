from fastapi import APIRouter
from app.services.pricing_service import get_pricing_options
from app.services.optimization_engine import rank_options

router = APIRouter()

@router.post("/search")
def search():
    """
    Endpoint to search for reward redemption options,
    calculate CPP, and return ranked results
    """
    # Step 1: Get pricing options from the service
    options = get_pricing_options()

    # Step 2: Calculate CPP and rank options
    ranked_options = rank_options(options)

    # Step 3: Return the ranked options
    return {
        "results": ranked_options
    }