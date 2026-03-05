from app.utils.math_utils import calculate_cpp

def rank_options(options):
    """
    Compute CPP for each option and rank them from best to worst
    """
    for option in options:
        # calculate CPP using math_utils.py
        option["cpp"] = calculate_cpp(
            option["cash_price"],
            option["taxes"],
            option["points"]
        )

        # add a simple verdict
        if option["cpp"] > 2.0:
            option["verdict"] = "Excellent redemption"
        elif 1.3 <= option["cpp"] <= 2.0:
            option["verdict"] = "Good redemption"
        else:
            option["verdict"] = "Poor redemption"

    # sort options by cpp descending
    options.sort(key=lambda x: x["cpp"], reverse=True)
    return options