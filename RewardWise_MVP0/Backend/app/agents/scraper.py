"""
agents/scraper.py
──────────────────
Web scraper for the KB monitor agent.
Fetches content from official airline/card/program pages
and extracts meaningful text for comparison.

Uses httpx for async fetching + BeautifulSoup for extraction.
Respects rate limits and handles common failure modes gracefully.
"""

from __future__ import annotations

import asyncio
import re
from typing import Optional

import httpx
from bs4 import BeautifulSoup


# ── Config ────────────────────────────────────────────────────────────────────

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

TIMEOUT_SECONDS = 20
MAX_CONTENT_CHARS = 15_000   # Truncate before sending to LLM
DELAY_BETWEEN_REQUESTS = 2   # Seconds between fetches (be a polite bot)


# ── Main fetch ────────────────────────────────────────────────────────────────

async def fetch_page_text(url: str) -> Optional[str]:
    """
    Fetch a URL and extract meaningful text content.

    Returns cleaned plain text, or None on failure.
    """
    try:
        async with httpx.AsyncClient(
            headers=HEADERS,
            timeout=TIMEOUT_SECONDS,
            follow_redirects=True,
        ) as client:
            response = await client.get(url)
            response.raise_for_status()
            return _extract_text(response.text, url)

    except httpx.TimeoutException:
        print(f"⚠️ Scraper timeout: {url}")
        return None
    except httpx.HTTPStatusError as e:
        print(f"⚠️ Scraper HTTP {e.response.status_code}: {url}")
        return None
    except Exception as e:
        print(f"⚠️ Scraper error: {url} — {e}")
        return None


async def fetch_multiple(urls: list[str]) -> str:
    """
    Fetch multiple URLs for one source article and combine the text.
    Adds a delay between requests to avoid rate limiting.
    """
    combined: list[str] = []

    for i, url in enumerate(urls):
        if i > 0:
            await asyncio.sleep(DELAY_BETWEEN_REQUESTS)

        text = await fetch_page_text(url)
        if text:
            combined.append(f"[SOURCE: {url}]\n{text}")

    if not combined:
        return ""

    full = "\n\n---\n\n".join(combined)
    return full[:MAX_CONTENT_CHARS]


# ── Text extraction ───────────────────────────────────────────────────────────

def _extract_text(html: str, url: str) -> str:
    """
    Extract meaningful text from HTML.
    Removes nav, footer, scripts, ads.
    Focuses on main content areas.
    """
    soup = BeautifulSoup(html, "html.parser")

    # Remove noise elements
    for tag in soup(["script", "style", "nav", "footer", "header",
                     "aside", "noscript", "iframe", "svg", "form",
                     "button", "input", "meta", "link"]):
        tag.decompose()

    # Try to find main content area
    main_content = (
        soup.find("main")
        or soup.find("article")
        or soup.find(id=re.compile(r"(main|content|body)", re.I))
        or soup.find(class_=re.compile(r"(main|content|body)", re.I))
        or soup.body
        or soup
    )

    if not main_content:
        return ""

    # Extract text
    text = main_content.get_text(separator="\n", strip=True)

    # Clean up whitespace
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    cleaned = "\n".join(lines)

    # Remove repeated blank lines
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)

    return cleaned[:MAX_CONTENT_CHARS]
