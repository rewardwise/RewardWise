"""
zoe/router.py
─────────────
Classifies an incoming user message into one of Zoe's intent categories,
and returns which supporting context layers to inject alongside the handler.

Intent categories
  trip_search       – flight search, dates, origin/destination, travelers
  verdict_strategy  – verdict interpretation + points/wallet/transfer strategy
  destination       – destination Q&A, tips, visa, best-time-to-visit
  wallet_support    – balance lookups, card management, product FAQ, booking logistics
  off_topic         – anything unrelated → generic LLM, no special context

Supporting context flags (any handler can request these)
  needs_wallet      – inject user's wallet balances
  needs_verdict     – inject current verdict context if one exists
  needs_history     – inject recent conversation turns (always true)
  is_voice          – caller is the voice endpoint; responses must be short + plain
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal

Intent = Literal[
    "trip_search",
    "verdict_strategy",
    "destination",
    "wallet_support",
    "off_topic",
]


@dataclass
class RouteResult:
    intent: Intent
    needs_wallet: bool = True        # almost always useful
    needs_verdict: bool = False      # only when a verdict exists + question references it
    is_voice: bool = False


# ── Keyword signal sets ───────────────────────────────────────────────────────

_TRIP_SIGNALS = re.compile(
    r"\b("
    r"fly|flight|flights|flying|travel|trip|route|ticket|book(?:ing)?|depart|arrive|"
    r"airport|airline|from .+ to|to .+ from|one.?way|round.?trip|return flight|"
    r"cheapest|cheap flights?|best time to fly|nonstop|layover|connection|"
    r"when (?:is|are|can) (?:i|we|you)|how (?:long|much) (?:is|does|would)|"
    r"find (?:me )?(?:a |some )?flights?|search flights?|look(?:ing)? for flights?"
    r")\b",
    re.IGNORECASE,
)

_VERDICT_SIGNALS = re.compile(
    r"\b("
    r"verdict|deal|good deal|worth it|should i (?:book|use|pay|buy)|"
    r"points or cash|cash or points|use my points|redeem|cpp|cents per point|"
    r"award (?:ticket|flight|seat|booking)|revenue (?:ticket|fare)|"
    r"better (?:deal|value|option)|is this (?:a good|worth)|"
    r"transfer (?:points|miles)|transfer to|transfer partner|"
    r"chase (?:ur|sapphire|freedom)|amex (?:mr|platinum|gold)|"
    r"capital one|citi (?:th)?ank(?:you)?|bilt|wells fargo|"
    r"united miles|delta skymiles|american miles|alaska miles|"
    r"air france|british airways|hyatt|marriott|hilton|"
    r"how many (?:points|miles)|what.?s (?:the )?best (?:card|program|use)|"
    r"sweet spot|business class(?: with points)?|first class(?: with points)?"
    r")\b",
    re.IGNORECASE,
)

_DESTINATION_SIGNALS = re.compile(
    r"\b("
    r"what.?s (?:it )?like in|things? to do|places? to (?:visit|see|go)|"
    r"best (?:time|month|season) to visit|hidden gems?|local (?:food|tips?|culture)|"
    r"visa (?:required|needed|for)|do i need a visa|weather in|climate in|"
    r"safe(?:ty)? in|is .+ safe|restaurants? in|food (?:scene|in)|"
    r"neighborhoods?|must.?see|must.?do|itinerary for|day trip|"
    r"nightlife|beach(?:es)?|hiking|museums?|culture in|history of"
    r")\b",
    re.IGNORECASE,
)

_WALLET_SUPPORT_SIGNALS = re.compile(
    r"\b("
    r"how many points (?:do i|have i)|my (?:points|miles|balance|wallet|cards?)|"
    r"add (?:a )?(?:card|program|account)|remove (?:a )?(?:card|program)|"
    r"update (?:my )?(?:balance|points|card)|wrong (?:balance|points|number)|"
    r"which cards?(?: do i have)?|connected (?:cards?|programs?|accounts?)|"
    r"how (?:do i|to) (?:add|use|connect|set up)|what (?:does|is) (?:this )?(?:app|site|platform)|"
    r"how (?:does|do) (?:this|it|you) work|google flights?|comparison|difference|"
    r"can (?:i|you) search|hotels?|cancel(?:lation)?|fees?|"
    r"book(?:ing)? (?:direct|through|via|on)|award (?:fee|tax)|partner site|"
    r"how do i (?:actually )?book|where do i book"
    r")\b",
    re.IGNORECASE,
)

_OFF_TOPIC_SIGNALS = re.compile(
    r"\b("
    r"write (?:me )?a poem|tell me a joke|who (?:won|won the)|sports?|"
    r"weather (?:today|tomorrow|this week)|stock (?:price|market)|recipe|"
    r"movie|tv show|netflix|music|song|lyrics|math|calcul|"
    r"politics|election|news|headline|celebrity"
    r")\b",
    re.IGNORECASE,
)


def classify(
    message: str,
    *,
    has_verdict_context: bool = False,
    is_voice: bool = False,
) -> RouteResult:
    """
    Classify a user message and return a RouteResult.

    Priority order (first match wins):
      1. off_topic
      2. verdict_strategy   (if verdict context present OR explicit points/deal language)
      3. destination
      4. wallet_support
      5. trip_search
      (default) trip_search — Zoe's core mode
    """
    text = message.strip()

    # 1. Off-topic — bail out early, no special context needed
    if _OFF_TOPIC_SIGNALS.search(text) and not _TRIP_SIGNALS.search(text):
        return RouteResult(intent="off_topic", needs_wallet=False, is_voice=is_voice)

    # 2. Verdict / points strategy
    #    Fires when: user is asking about a deal/points/transfers,
    #    OR when a verdict exists and user asks anything evaluative.
    verdict_lang = bool(_VERDICT_SIGNALS.search(text))
    evaluative_with_verdict = has_verdict_context and re.search(
        r"\b(should i|is this|worth|good|better|recommend|explain|why)\b",
        text,
        re.IGNORECASE,
    )
    if verdict_lang or evaluative_with_verdict:
        return RouteResult(
            intent="verdict_strategy",
            needs_wallet=True,
            needs_verdict=has_verdict_context,
            is_voice=is_voice,
        )

    # 3. Destination knowledge
    if _DESTINATION_SIGNALS.search(text) and not _TRIP_SIGNALS.search(text):
        return RouteResult(
            intent="destination",
            needs_wallet=False,
            is_voice=is_voice,
        )

    # 4. Destination + trip hybrid (destination question but also trip signals)
    if _DESTINATION_SIGNALS.search(text) and _TRIP_SIGNALS.search(text):
        return RouteResult(
            intent="destination",
            needs_wallet=True,
            is_voice=is_voice,
        )

    # 5. Wallet / product support / booking logistics
    if _WALLET_SUPPORT_SIGNALS.search(text) and not _TRIP_SIGNALS.search(text):
        return RouteResult(
            intent="wallet_support",
            needs_wallet=True,
            is_voice=is_voice,
        )

    # 6. Trip search (also the default)
    return RouteResult(
        intent="trip_search",
        needs_wallet=True,
        is_voice=is_voice,
    )
