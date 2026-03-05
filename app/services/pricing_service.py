def get_pricing_options():
    """
    Mock pricing data covering all CPP verdicts:
    - Excellent redemption (CPP > 2.0)
    - Good redemption (1.3 <= CPP <= 2.0)
    - Poor redemption (CPP < 1.3)
    """
    options = [
        {
            "program": "United",
            "cash_price": 600,   # High cash price / lower points → CPP = 2.75
            "points": 20000,
            "taxes": 50
        },
        {
            "program": "Virgin Atlantic",
            "cash_price": 550,   # Medium CPP = 1.67
            "points": 30000,
            "taxes": 50
        },
        {
            "program": "Air Canada Aeroplan",
            "cash_price": 500,   # Low CPP = 0.9
            "points": 50000,
            "taxes": 50
        }
    ]

    return options