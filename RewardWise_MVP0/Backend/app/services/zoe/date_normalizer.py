"""
zoe/date_normalizer.py
──────────────────────
Natural language date → ISO 8601 (YYYY-MM-DD) normalization.
Pure Python — no external API.

Handles:
  - Absolute dates: "June 15", "June 15th", "Dec 25 2026", "2026-06-15"
  - Relative dates: "next Friday", "in 3 weeks", "this weekend"
  - Seasonal: "next summer", "Christmas", "New Year's"
  - Vague: "sometime in June" → None (don't guess)

Returns None when the date cannot be determined with confidence.
The caller (parse_call) handles None by not populating the date field.
"""

from __future__ import annotations

import re
from datetime import date, timedelta
from typing import Optional


# ── Month name lookup ─────────────────────────────────────────────────────────

_MONTHS = {
    "january": 1, "jan": 1,
    "february": 2, "feb": 2,
    "march": 3, "mar": 3,
    "april": 4, "apr": 4,
    "may": 5,
    "june": 6, "jun": 6,
    "july": 7, "jul": 7,
    "august": 8, "aug": 8,
    "september": 9, "sep": 9, "sept": 9,
    "october": 10, "oct": 10,
    "november": 11, "nov": 11,
    "december": 12, "dec": 12,
}

_WEEKDAYS = {
    "monday": 0, "mon": 0,
    "tuesday": 1, "tue": 1, "tues": 1,
    "wednesday": 2, "wed": 2,
    "thursday": 3, "thu": 3, "thurs": 3,
    "friday": 4, "fri": 4,
    "saturday": 5, "sat": 5,
    "sunday": 6, "sun": 6,
}

_VAGUE_PATTERNS = re.compile(
    r"\b(sometime|some time|around|maybe|perhaps|possibly|probably|"
    r"not sure when|unsure|tbd|to be determined|flexible|"
    r"next month|next year|early|mid|late)\b",
    re.IGNORECASE,
)


def _today() -> date:
    return date.today()


def _next_weekday(target_weekday: int) -> date:
    """Return the next occurrence of target_weekday (0=Mon, 6=Sun), at least 1 day from today."""
    today = _today()
    days_ahead = target_weekday - today.weekday()
    if days_ahead <= 0:
        days_ahead += 7
    return today + timedelta(days=days_ahead)


def _this_weekday(target_weekday: int) -> date:
    """Return this week's occurrence of target_weekday, or next if already past."""
    today = _today()
    days_ahead = target_weekday - today.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return today + timedelta(days=days_ahead)


def normalize(text: str) -> Optional[str]:
    """
    Parse a date expression and return ISO 8601 string (YYYY-MM-DD) or None.

    Args:
        text: Natural language date expression, e.g. "next Friday", "June 15"

    Returns:
        "YYYY-MM-DD" string, or None if the date cannot be determined.
    """
    if not text:
        return None

    t = text.strip().lower()

    # Already ISO format
    iso_match = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", t)
    if iso_match:
        try:
            d = date(int(iso_match.group(1)), int(iso_match.group(2)), int(iso_match.group(3)))
            if d >= _today():
                return d.isoformat()
        except ValueError:
            pass

    # Vague — return None immediately
    if _VAGUE_PATTERNS.search(t):
        return None

    today = _today()

    # ── Relative: today / tomorrow ────────────────────────────────────────────
    if re.search(r"\btoday\b", t):
        return today.isoformat()
    if re.search(r"\btomorrow\b", t):
        return (today + timedelta(days=1)).isoformat()

    # ── Relative: "in N days/weeks/months" ───────────────────────────────────
    m = re.search(r"in\s+(\d+)\s+(day|days)", t)
    if m:
        return (today + timedelta(days=int(m.group(1)))).isoformat()

    m = re.search(r"in\s+(\d+)\s+(week|weeks)", t)
    if m:
        return (today + timedelta(weeks=int(m.group(1)))).isoformat()

    m = re.search(r"in\s+(\d+)\s+(month|months)", t)
    if m:
        n = int(m.group(1))
        target = today.replace(month=((today.month - 1 + n) % 12) + 1)
        if (today.month + n - 1) // 12 > 0:
            target = target.replace(year=today.year + (today.month + n - 1) // 12)
        return target.isoformat()

    # ── Relative: "next/this weekday" ────────────────────────────────────────
    m = re.search(r"\b(next|this)\s+(monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thurs|friday|fri|saturday|sat|sunday|sun)\b", t)
    if m:
        qualifier = m.group(1)
        day_name = m.group(2)
        target_wd = _WEEKDAYS.get(day_name)
        if target_wd is not None:
            if qualifier == "next":
                return _next_weekday(target_wd).isoformat()
            else:
                return _this_weekday(target_wd).isoformat()

    # ── Weekday alone: "Friday", "Saturday" ──────────────────────────────────
    m = re.search(r"\b(monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thurs|friday|fri|saturday|sat|sunday|sun)\b", t)
    if m:
        day_name = m.group(1)
        target_wd = _WEEKDAYS.get(day_name)
        if target_wd is not None:
            return _this_weekday(target_wd).isoformat()

    # ── "This weekend" ────────────────────────────────────────────────────────
    if re.search(r"\bthis\s+weekend\b", t):
        return _next_weekday(5).isoformat()  # Saturday

    # ── "Next weekend" ────────────────────────────────────────────────────────
    if re.search(r"\bnext\s+weekend\b", t):
        sat = _next_weekday(5)
        # If this weekend's Saturday is within 7 days, return the one after
        if (sat - today).days < 7:
            return (sat + timedelta(days=7)).isoformat()
        return sat.isoformat()

    # ── Seasonal / holiday references ─────────────────────────────────────────
    year = today.year

    if re.search(r"\bchristmas\b", t):
        d = date(year, 12, 25)
        if d < today:
            d = date(year + 1, 12, 25)
        return d.isoformat()

    if re.search(r"\bthanksgiving\b", t):
        # 4th Thursday of November
        nov1 = date(year, 11, 1)
        thursdays = [nov1 + timedelta(days=(3 - nov1.weekday()) % 7 + 7 * i) for i in range(4)]
        d = thursdays[3]
        if d < today:
            nov1 = date(year + 1, 11, 1)
            thursdays = [nov1 + timedelta(days=(3 - nov1.weekday()) % 7 + 7 * i) for i in range(4)]
            d = thursdays[3]
        return d.isoformat()

    if re.search(r"\bnew year'?s?\b", t):
        d = date(year + 1, 1, 1)
        return d.isoformat()

    if re.search(r"\beaster\b", t):
        # Approximate Easter using Gauss algorithm
        a = year % 19
        b = year // 100
        c = year % 100
        d_ = b // 4
        e = b % 4
        f = (b + 8) // 25
        g = (b - f + 1) // 3
        h = (19 * a + b - d_ - g + 15) % 30
        i = c // 4
        k = c % 4
        l = (32 + 2 * e + 2 * i - h - k) % 7
        m_ = (a + 11 * h + 22 * l) // 451
        month = (h + l - 7 * m_ + 114) // 31
        day = ((h + l - 7 * m_ + 114) % 31) + 1
        d = date(year, month, day)
        if d < today:
            year += 1
            a = year % 19
            b = year // 100
            c = year % 100
            d_ = b // 4
            e = b % 4
            f = (b + 8) // 25
            g = (b - f + 1) // 3
            h = (19 * a + b - d_ - g + 15) % 30
            i = c // 4
            k = c % 4
            l = (32 + 2 * e + 2 * i - h - k) % 7
            m_ = (a + 11 * h + 22 * l) // 451
            month = (h + l - 7 * m_ + 114) // 31
            day = ((h + l - 7 * m_ + 114) % 31) + 1
            d = date(year, month, day)
        return d.isoformat()

    if re.search(r"\bsummer\b", t):
        d = date(year, 7, 1)
        if d < today:
            d = date(year + 1, 7, 1)
        return d.isoformat()

    if re.search(r"\bwinter\b", t):
        d = date(year, 12, 15)
        if d < today:
            d = date(year + 1, 12, 15)
        return d.isoformat()

    if re.search(r"\bspring\b", t):
        d = date(year, 4, 1)
        if d < today:
            d = date(year + 1, 4, 1)
        return d.isoformat()

    if re.search(r"\bfall\b|\bautumn\b", t):
        d = date(year, 10, 1)
        if d < today:
            d = date(year + 1, 10, 1)
        return d.isoformat()

    # ── "Month Day" patterns: "June 15", "June 15th", "the 15th of June" ─────
    for month_name, month_num in _MONTHS.items():
        # "June 15", "June 15th", "Jun 15"
        m = re.search(rf"\b{month_name}\s+(\d{{1,2}})(?:st|nd|rd|th)?\b", t)
        if m:
            day = int(m.group(1))
            try:
                d = date(year, month_num, day)
                if d < today:
                    d = date(year + 1, month_num, day)
                return d.isoformat()
            except ValueError:
                return None

        # "15 June", "15th June", "15th of June"
        m = re.search(rf"\b(\d{{1,2}})(?:st|nd|rd|th)?\s+(?:of\s+)?{month_name}\b", t)
        if m:
            day = int(m.group(1))
            try:
                d = date(year, month_num, day)
                if d < today:
                    d = date(year + 1, month_num, day)
                return d.isoformat()
            except ValueError:
                return None

        # Just a month name alone: "in June" → 1st of that month
        m = re.search(rf"\b(?:in\s+)?{month_name}\b", t)
        if m and not re.search(r"\d", t):
            d = date(year, month_num, 1)
            if d < today:
                d = date(year + 1, month_num, 1)
            return d.isoformat()

    # ── "MM/DD" or "MM/DD/YYYY" ───────────────────────────────────────────────
    m = re.match(r"^(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?$", t.strip())
    if m:
        mon = int(m.group(1))
        day = int(m.group(2))
        yr = int(m.group(3)) if m.group(3) else year
        if yr < 100:
            yr += 2000
        try:
            d = date(yr, mon, day)
            if d < today and not m.group(3):
                d = date(yr + 1, mon, day)
            return d.isoformat()
        except ValueError:
            return None

    # ── "N weeks from now" / "N days from now" ────────────────────────────────
    m = re.search(r"(\d+)\s+week(?:s)?\s+from\s+now", t)
    if m:
        return (today + timedelta(weeks=int(m.group(1)))).isoformat()

    m = re.search(r"(\d+)\s+day(?:s)?\s+from\s+now", t)
    if m:
        return (today + timedelta(days=int(m.group(1)))).isoformat()

    # ── "A few weeks", "a couple of weeks" ────────────────────────────────────
    if re.search(r"\ba\s+few\s+weeks\b", t):
        return (today + timedelta(weeks=3)).isoformat()

    if re.search(r"\ba?\s*couple\s+(?:of\s+)?weeks\b", t):
        return (today + timedelta(weeks=2)).isoformat()

    if re.search(r"\ba?\s*couple\s+(?:of\s+)?days\b", t):
        return (today + timedelta(days=2)).isoformat()

    # Cannot determine
    return None
