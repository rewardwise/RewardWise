def calculate_cpp(cash_price: float, taxes: float, points: int) -> float:
    """
    Internal per-award RANKING SCORE — not a user-facing display value.

    Formula: (cash_price - taxes) / points * 100

    Unit contract at callers in `app/api/search.py`:
        cash_price = one-way, per-date, TOTAL across `travelers` (FlightAPI shape).
        taxes      = per-pax dollars (seats.aero shape).
        points     = per-pax mileage for one leg (seats.aero shape).

    Because numerator (total-pax cash) and denominator (per-pax points)
    use different scopes, this ratio is inflated by `travelers` relative
    to the matched-scope CPP. That is acceptable because the score is
    used only to RANK award_options against each other and to drive the
    pay_cash / use_points / wait threshold gates in `verdict_service` —
    every option goes through the same calc, so the inflation cancels.

    DO NOT surface this number to the FE as "cents per point." The
    display CPP is recomputed in `verdict_service._metrics` against
    matched-scope inputs (full-trip total cash / total-travelers total
    points) so that `cpp × points = displayed savings` reconciles.

    Taxes must be passed in dollars (conversion handled in search.py).
    """
    if points <= 0:
        return 0.0
    return round((cash_price - taxes) / points * 100, 4)