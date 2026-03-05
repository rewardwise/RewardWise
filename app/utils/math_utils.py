def calculate_cpp(cash_price: float, taxes: float, points: int) -> float:
    """
    Calculate cents-per-point (CPP) for a reward redemption option.
    
    CPP = ((Cash Price - Taxes) / Points) * 100
    """
    if points == 0:
        return 0.0  # avoid division by zero
    
    cpp = ((cash_price - taxes) / points) * 100
    return round(cpp, 2)  # round to 2 decimal places