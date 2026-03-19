from app.utils.math_utils import calculate_cpp


def rank_options(options):
    """
    Compute CPP for each option and rank them from best to worst.
    Thresholds aligned with verdict_service.py:
      >= 2.0  → Excellent
      >= 1.5  → Good
      >= 1.3  → Decent
      < 1.3   → Poor
    """
    for option in options:
        option["cpp"] = calculate_cpp(
            option["cash_price"],
            option["taxes"],
            option["points"]
        )
        if option["cpp"] >= 2.0:
            option["verdict"] = "Excellent redemption"
        elif option["cpp"] >= 1.5:
            option["verdict"] = "Good redemption"
        elif option["cpp"] >= 1.3:
            option["verdict"] = "Decent redemption"
        else:
            option["verdict"] = "Poor redemption"

    options.sort(key=lambda x: x["cpp"], reverse=True)
    return options