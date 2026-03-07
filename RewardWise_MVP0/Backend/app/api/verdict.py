from fastapi import APIRouter
from app.services.pricing_service import get_pricing_options
from app.services.optimization_engine import rank_options
from app.schemas.verdict_schema import VerdictResponse, RewardOption

router = APIRouter()

MAX_ALTERNATIVES = 2


def _build_summary(program: str, cpp: float, verdict: str) -> str:
    return (
        f"{program} offers a {verdict.lower()} at {cpp}¢ per point. "
        f"{'This is one of the best ways to use your points.' if cpp > 2.0 else 'Consider if a better option is available.' if cpp < 1.3 else 'A solid redemption for most travelers.'}"
    )


@router.post("/verdict", response_model=VerdictResponse)
def generate_verdict():
    options = get_pricing_options()
    ranked = rank_options(options)

    top = ranked[0]
    alternatives = [
        RewardOption(
            program=opt["program"],
            cpp=opt["cpp"],
            cash_price_used=opt["cash_price"],
            points_cost_used=opt["points"],
            verdict=opt["verdict"],
        )
        for opt in ranked[1 : 1 + MAX_ALTERNATIVES]
    ]

    return VerdictResponse(
        recommendation=top["program"],
        summary=_build_summary(top["program"], top["cpp"], top["verdict"]),
        details={
            "taxes": top["taxes"],
            "verdict_label": top["verdict"],
            "all_options": ranked,
        },
        cpp=top["cpp"],
        cash_price_used=top["cash_price"],
        points_cost_used=top["points"],
        alternatives=alternatives,
    )
