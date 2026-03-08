def calculate_cpp(cash_price: float, taxes: float, points: int) -> float:
    """
    Calculates cents-per-point (CPP).
    Formula: (cash_price - taxes) / points * 100
    """
    if points <= 0:
        return 0.0
    return round((cash_price - taxes) / points * 100, 4)