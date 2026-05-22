"""
zoe/router.py
─────────────
Classifies an incoming user message into one of Zoe's intent categories.

Priority order (first match wins):
  1. off_topic
  2. verdict_strategy
  3. wallet_support
  4. destination        — explicit knowledge questions OR bare place name with no trip signals
  5. trip_search        — explicit flight planning language
  6. (default)          — trip_search

IMPORTANT: short affirmative/follow-up replies ("yes", "yes please", "LGA", "december",
"just me") have no strong signals and fall through to the default — trip_search. This is
correct because they are continuing an existing trip planning conversation. The trip_search
handler reads full history to understand context.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

Intent = Literal[
    "trip_search",
    "verdict_strategy",
    "alt_dates",
    "destination",
    "wallet_support",
    "off_topic",
]


@dataclass
class RouteResult:
    intent: Intent
    needs_wallet: bool = True
    needs_verdict: bool = False
    is_voice: bool = False


# ── Signal patterns ───────────────────────────────────────────────────────────

_TRIP_SIGNALS = re.compile(
    r"\b("
    r"fly|flight|flights|flying|"
    r"travel to|trip to|going to|want to go to|"
    r"route|ticket|book(?:ing)?|depart|arrive|"
    r"airport|airline|"
    r"one.?way|round.?trip|return flight|"
    r"cheapest(?: flight)?|cheap flights?|best time to fly|"
    r"nonstop|layover|connection|stopover|"
    r"find (?:me )?(?:a |some )?flights?|search(?: for)? flights?|"
    r"look(?:ing)? for flights?|"
    r"i (?:want|need|d like) to (?:fly|go|travel)|"
    r"how (?:long|much) (?:is|does|would) (?:a )?(?:flight|trip)"
    r")\b",
    re.IGNORECASE,
)

_ALT_DATES_SIGNALS = re.compile(
    r"\b("
    r"(?:any |some |other )?alternative dates?|"
    r"alt dates?|other dates?|different dates?|"
    r"(?:any )?cheaper (?:dates?|days?|options?|alternatives?)|"
    r"nearby dates?|surrounding dates?|"
    r"(?:flex(?:ible)?|adjust(?:ing)?|shift(?:ing)?|move|change|moving) (?:my )?(?:dates?|travel dates?|departure)|"
    r"(?:save|saving)(?: money)? (?:around|near|by shifting)|"
    r"(?:on )?(?:any )?other (?:day|days)|"
    r"(?:fly|leave|depart|return)(?:[\w ]{0,20})?(?:earlier|later)|"
    r"earlier or later|"
    r"around (?:my|the|that|those) dates?"
    r")\b",
    re.IGNORECASE,
)

_VERDICT_SIGNALS = re.compile(
    r"\b("
    r"verdict|good deal|worth it|should i (?:book|use|pay|buy)|"
    r"points or cash|cash or points|use my points|redeem|"
    r"cpp|cents per point|"
    r"award (?:ticket|flight|seat|booking)|revenue (?:ticket|fare)|"
    r"better (?:deal|value|option)|is this (?:a good|worth)|"
    r"transfer (?:points|miles)|transfer to|transfer partner|"
    r"chase (?:ur|sapphire|freedom)|amex (?:mr|platinum|gold)|"
    r"capital one|citi (?:thankyou|th)?|bilt|wells fargo|"
    r"united miles|delta skymiles|american miles|alaska miles|"
    r"air france|british airways|hyatt|marriott|hilton|"
    r"how many (?:points|miles) (?:do i need|would it cost|to fly)|"
    r"what.?s (?:the )?best (?:card|program|use)|"
    r"sweet spot|business class(?: with points)?|first class(?: with points)?"
    r")\b",
    re.IGNORECASE,
)

_DESTINATION_SIGNALS = re.compile(
    r"\b("
    r"what.?s (?:it )?like (?:in|there)|things? to do(?: in)?|"
    r"places? to (?:visit|see|go)(?: in)?|"
    r"best (?:time|month|season) to visit|hidden gems?|"
    r"local (?:food|tips?|culture|transport)|"
    r"visa (?:required|needed|for)|do i need a visa|"
    r"weather in|climate in|"
    r"is (?:it )?safe(?: in| to go| to visit)?|safety in|"
    r"restaurants? in|food (?:scene|in)|"
    r"neighborhoods?|must.?see|must.?do|"
    r"itinerary for|day trip(?:s)?(?: from| to)?|"
    r"nightlife(?: in)?|beach(?:es)?(?: in)?|"
    r"hiking(?: in| near)?|museums?(?: in)?|"
    r"culture in|history of|"
    r"tell me about|what should i (?:know|do|see|eat)(?: in| about)?|"
    r"tips? (?:for|on|about)(?: visiting)?"
    r")\b",
    re.IGNORECASE,
)

_WALLET_SUPPORT_SIGNALS = re.compile(
    r"\b("
    r"how many points (?:do i|have i)|my (?:points|miles|balance|wallet|cards?)|"
    r"add (?:a )?(?:card|program|account)|remove (?:a )?(?:card|program)|"
    r"update (?:my )?(?:balance|points|card)|wrong (?:balance|points|number)|"
    r"which cards?(?: do i have)?|connected (?:cards?|programs?|accounts?)|"
    r"how (?:do i|to) (?:add|use|connect|set up)|"
    r"what (?:does|is) (?:this )?(?:app|site|platform)|"
    r"how (?:does|do) (?:this|it|you) work|"
    r"google flights?|comparison|difference between|"
    r"can (?:i|you) search|hotels?|cancel(?:lation)?|fees?|"
    r"book(?:ing)? (?:direct|through|via|on)|award (?:fee|tax)|partner site|"
    r"how do i (?:actually )?book|where do i book"
    r")\b",
    re.IGNORECASE,
)

_OFF_TOPIC_SIGNALS = re.compile(
    r"\b("
    r"write (?:me )?a (?:poem|song|essay|story)|tell me a joke|"
    r"who (?:won|won the)\b|sports? score|"
    r"stock (?:price|market)|recipe|how (?:do i )?cook|"
    r"movie(?: review)?|tv show|netflix|hulu|"
    r"music|song lyrics|lyrics to|"
    r"math problem|calcul(?:ate|ation)|solve for|"
    r"politics|election results|president of|news today|headlines?|celebrity"
    r")\b",
    re.IGNORECASE,
)

# Bare place name: short message that is likely just a destination name
# e.g. "India?", "Southeast Asia", "the Maldives"
# Catches these ONLY when there are no trip signals (not "fly to India")
_BARE_PLACE = re.compile(
    r"^(?:the\s+)?[A-Z][a-zA-Z\s\-]{2,35}[?!.]?$"
)

# Vague destination curiosity — no specific place but clearly exploring ideas
_VAGUE_DESTINATION = re.compile(
    r"\b("
    r"somewhere (?:warm|hot|cold|tropical|exotic|beautiful|cheap|fun|different|new)|"
    r"(?:beach|island|mountain) (?:destination|trip|getaway)|"
    r"(?:never|haven.?t) been to|always wanted to (?:go|visit|see)|"
    r"dream (?:trip|destination|vacation)|"
    r"not sure where(?: to go)?|don.?t know where(?: to go)?|"
    r"help me (?:decide|choose|pick)(?: where| a destination)?"
    r")\b",
    re.IGNORECASE,
)


# ── Classifier ────────────────────────────────────────────────────────────────

def classify(
    message: str,
    *,
    has_verdict_context: bool = False,
    is_voice: bool = False,
) -> RouteResult:
    text = message.strip()

    # 1. Off-topic — exit immediately
    if _OFF_TOPIC_SIGNALS.search(text) and not _TRIP_SIGNALS.search(text):
        return RouteResult(intent="off_topic", needs_wallet=False, is_voice=is_voice)

    # 1b. Alt-dates — only meaningful when an active verdict is in context.
    # Without verdict_context we have no origin/destination/date to range-search,
    # so the same phrasing falls through to trip_search where history can fill in.
    if has_verdict_context and _ALT_DATES_SIGNALS.search(text):
        return RouteResult(
            intent="alt_dates",
            needs_wallet=True,
            needs_verdict=True,
            is_voice=is_voice,
        )

    # 2. Verdict / points strategy
    verdict_lang = bool(_VERDICT_SIGNALS.search(text))
    evaluative_with_verdict = has_verdict_context and re.search(
        r"\b(should i|is this|worth|good|better|recommend|explain|why|analyse|analyze)\b",
        text, re.IGNORECASE,
    )
    if verdict_lang or evaluative_with_verdict:
        return RouteResult(
            intent="verdict_strategy",
            needs_wallet=True,
            needs_verdict=has_verdict_context,
            is_voice=is_voice,
        )

    # 3. Wallet / product / booking logistics
    if _WALLET_SUPPORT_SIGNALS.search(text) and not _TRIP_SIGNALS.search(text):
        return RouteResult(intent="wallet_support", needs_wallet=True, is_voice=is_voice)

    has_trip = bool(_TRIP_SIGNALS.search(text))

    # 4. Destination knowledge questions
    if _DESTINATION_SIGNALS.search(text) and not has_trip:
        return RouteResult(intent="destination", needs_wallet=False, is_voice=is_voice)

    # 4b. Bare proper noun with no trip signals — curiosity, not booking
    if not has_trip and _BARE_PLACE.match(text):
        return RouteResult(intent="destination", needs_wallet=False, is_voice=is_voice)

    # 4c. Vague destination curiosity
    if _VAGUE_DESTINATION.search(text) and not has_trip:
        return RouteResult(intent="destination", needs_wallet=False, is_voice=is_voice)

    # 5. Explicit trip planning
    if has_trip:
        return RouteResult(intent="trip_search", needs_wallet=True, is_voice=is_voice)

    # 6. Default — trip_search
    # Catches follow-up replies like "yes", "LGA", "december", "just me", "economy"
    # that have no strong signal but are continuing a trip planning conversation.
    # The trip_search handler reads full history to understand context correctly.
    return RouteResult(intent="trip_search", needs_wallet=True, is_voice=is_voice)
