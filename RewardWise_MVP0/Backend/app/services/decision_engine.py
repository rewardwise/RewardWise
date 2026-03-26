def run_decision_engine(search_results, wallet):
    if not search_results:
        return {"message": "No flights found."}

    # Example: pick cheapest option (simple MVP)
    best = min(search_results, key=lambda x: x.get("price", float("inf")))

    return {
        "best_option": best,
        "recommendation": "Best available option based on price.",
    }