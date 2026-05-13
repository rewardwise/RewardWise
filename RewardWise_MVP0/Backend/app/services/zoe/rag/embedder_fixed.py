"""
zoe/rag/embedder.py  (FIXED — 4096 dimensions for nvidia/nv-embed-v1)
"""
from __future__ import annotations
import os
from typing import Optional
import httpx

NVIDIA_EMBED_URL   = os.getenv("NVIDIA_EMBED_URL", "https://integrate.api.nvidia.com/v1/embeddings")
NVIDIA_API_KEY     = os.getenv("NVIDIA_API_KEY")
EMBED_MODEL        = os.getenv("NVIDIA_EMBED_MODEL", "nvidia/nv-embed-v1")
OPENAI_API_KEY     = os.getenv("OPENAI_API_KEY")
OPENAI_EMBED_URL   = "https://api.openai.com/v1/embeddings"
# text-embedding-3-large = 3072d, but nv-embed-v1 = 4096d
# Use whichever matches your DB column (currently 4096)
OPENAI_EMBED_MODEL = "text-embedding-3-large"
TIMEOUT            = float(os.getenv("NVIDIA_TIMEOUT_SECONDS", "30"))


async def embed(text: str) -> Optional[list[float]]:
    text = text.strip()[:8000]
    if NVIDIA_API_KEY:
        result = await _embed_nvidia(text)
        if result:
            return result
    if OPENAI_API_KEY:
        result = await _embed_openai(text)
        if result:
            return result
    print("⚠️ ZOE EMBED: no provider available")
    return None


async def embed_batch(texts: list[str]) -> list[Optional[list[float]]]:
    results = []
    for text in texts:
        results.append(await embed(text))
    return results


async def _embed_nvidia(text: str) -> Optional[list[float]]:
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(
                NVIDIA_EMBED_URL,
                headers={"Authorization": f"Bearer {NVIDIA_API_KEY}", "Content-Type": "application/json"},
                json={"model": EMBED_MODEL, "input": text, "encoding_format": "float"},
            )
        if resp.status_code >= 400:
            print(f"⚠️ NVIDIA embed {resp.status_code}:", resp.text[:200])
            return None
        return resp.json()["data"][0]["embedding"]
    except Exception as exc:
        print("⚠️ NVIDIA embed error:", exc)
        return None


async def _embed_openai(text: str) -> Optional[list[float]]:
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(
                OPENAI_EMBED_URL,
                headers={"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"},
                json={"model": OPENAI_EMBED_MODEL, "input": text},
            )
        if resp.status_code >= 400:
            print(f"⚠️ OpenAI embed {resp.status_code}:", resp.text[:200])
            return None
        return resp.json()["data"][0]["embedding"]
    except Exception as exc:
        print("⚠️ OpenAI embed error:", exc)
        return None
