from __future__ import annotations

import re


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "").strip().lower())


def detect_reset_intent(text: str) -> bool:
    """Only truly destructive reset/new-search phrases. Never trust model reset alone."""
    t = _norm(text)
    if not t:
        return False
    exact = {
        "start over", "new search", "new trip", "reset", "reset trip", "different route",
        "another route", "search another route", "can i search another route", "can i search another route?",
        "forget this", "forget that", "clear this", "clear trip",
    }
    if t in exact:
        return True
    patterns = [
        r"\b(start|begin)\s+(over|again)\b",
        r"\b(new|another|different)\s+(search|trip|route|flight)\b",
        r"\bsearch\s+(a\s+)?(new|another|different)\s+(route|trip|flight)\b",
        r"\bforget\s+(this|that|the)\s+(trip|route|search)\b",
    ]
    return any(re.search(pattern, t) for pattern in patterns)


def looks_like_replacement_trip(text: str) -> bool:
    t = _norm(text)
    route_patterns = [
        r"\bfrom\s+.+?\s+to\s+.+",
        r"\b.+?\s+to\s+.+",
        r"\bi\s+(want|wanna|would like)\s+to\s+(go|fly|travel)\s+to\s+.+",
        r"\bcan\s+i\s+use\s+points\s+to\s+fly\s+from\s+.+?\s+to\s+.+",
    ]
    return any(re.search(pattern, t) for pattern in route_patterns)


def detect_general_question(text: str) -> bool:
    t = _norm(text)
    if not t:
        return False
    trip_words = ["fly", "flight", "route", "airport", "trip", "points", "cash", "miles", "travel", "go to"]
    if any(word in t for word in trip_words):
        return False
    return t.endswith("?")
