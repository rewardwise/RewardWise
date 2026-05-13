"""
zoe/rag/embedder.py
────────────────────
Embedding generation for RAG retrieval.

Uses the NVIDIA NIM embeddings endpoint (text-embedding-ada-002 compatible).
Falls back to the OpenAI embeddings API if OPENAI_API_KEY is set and
NVIDIA_EMBED_URL is not.

Embedding model: text-embedding-ada-002 (1536 dimensions)
This matches the vector(1536) column in kb_articles and kb_interactions_corpus.
"""

from __future__ import annotations

import os
from typing import Optional

import httpx

NVIDIA_EMBED_URL = os.getenv(
    "NVIDIA_EMBED_URL",
    "https://integrate.api.nvidia.com/v1/embeddings",
)
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")
EMBED_MODEL = os.getenv("NVIDIA_EMBED_MODEL", "nvidia/nv-embed-v1")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_EMBED_URL = "https://api.openai.com/v1/embeddings"
OPENAI_EMBED_MODEL = "text-embedding-ada-002"

TIMEOUT = float(os.getenv("NVIDIA_TIMEOUT_SECONDS", "30"))


async def embed(text: str) -> Optional[list[float]]:
    """
    Generate a 1536-dimensional embedding for `text`.

    Returns a list of floats, or None on failure.
    Tries NVIDIA NIM first, falls back to OpenAI if configured.
    """
    text = text.strip()[:8000]  # token safety cap

    # Try NVIDIA NIM
    if NVIDIA_API_KEY:
        result = await _embed_nvidia(text)
        if result:
            return result

    # Fallback: OpenAI
    if OPENAI_API_KEY:
        result = await _embed_openai(text)
        if result:
            return result

    print("⚠️ ZOE EMBED: No embedding provider available (NVIDIA_API_KEY or OPENAI_API_KEY required)")
    return None


async def embed_batch(texts: list[str]) -> list[Optional[list[float]]]:
    """Embed multiple texts. Returns a list of embeddings (or None for failures)."""
    results = []
    for text in texts:
        results.append(await embed(text))
    return results


async def _embed_nvidia(text: str) -> Optional[list[float]]:
    """Call NVIDIA NIM embeddings endpoint."""
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(
                NVIDIA_EMBED_URL,
                headers={
                    "Authorization": f"Bearer {NVIDIA_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": EMBED_MODEL,
                    "input": text,
                    "encoding_format": "float",
                },
            )
        if resp.status_code >= 400:
            print(f"⚠️ NVIDIA embed {resp.status_code}:", resp.text[:200])
            return None
        data = resp.json()
        return data["data"][0]["embedding"]
    except Exception as exc:
        print("⚠️ NVIDIA embed error:", exc)
        return None


async def _embed_openai(text: str) -> Optional[list[float]]:
    """Call OpenAI embeddings endpoint as fallback."""
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(
                OPENAI_EMBED_URL,
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": OPENAI_EMBED_MODEL,
                    "input": text,
                },
            )
        if resp.status_code >= 400:
            print(f"⚠️ OpenAI embed {resp.status_code}:", resp.text[:200])
            return None
        data = resp.json()
        return data["data"][0]["embedding"]
    except Exception as exc:
        print("⚠️ OpenAI embed error:", exc)
        return None
