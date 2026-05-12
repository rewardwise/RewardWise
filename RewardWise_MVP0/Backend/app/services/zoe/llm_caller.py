"""
zoe/llm_caller.py
─────────────────
Thin wrapper around the NVIDIA NIM chat-completions endpoint used by every
Zoe handler. Keeps all HTTP logic in one place so handlers stay clean.
"""

from __future__ import annotations

import json
import os
from typing import Any

import httpx

NVIDIA_BASE_URL = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
MODEL_NAME = os.getenv("NVIDIA_MODEL", "meta/llama-3.3-70b-instruct")
TIMEOUT = float(os.getenv("NVIDIA_TIMEOUT_SECONDS", "45"))
MAX_TOKENS = int(os.getenv("NVIDIA_MAX_TOKENS", "700"))


def _url() -> str:
    return f"{NVIDIA_BASE_URL.rstrip('/')}/chat/completions"


def _headers() -> dict[str, str] | None:
    key = os.getenv("NVIDIA_API_KEY")
    if not key:
        return None
    return {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def _extract_text(response: dict | None) -> str:
    if not response:
        return ""
    try:
        content = response["choices"][0]["message"].get("content", "")
        if isinstance(content, str):
            return content.strip()
        if isinstance(content, list):
            return "".join(
                item.get("text", "") for item in content if isinstance(item, dict)
            ).strip()
    except (KeyError, IndexError, TypeError):
        pass
    return ""


def _parse_json(raw: str) -> dict:
    """Best-effort JSON extraction from a raw LLM string."""
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start, end = raw.find("{"), raw.rfind("}")
        if start != -1 and end > start:
            try:
                return json.loads(raw[start : end + 1])
            except json.JSONDecodeError:
                pass
    return {}


async def call_llm(
    system: str,
    user: str,
    *,
    temperature: float = 0.7,
    max_tokens: int | None = None,
) -> str:
    """Single text-mode call. Returns the model's reply as a plain string."""
    headers = _headers()
    if not headers:
        return "I'm having trouble connecting right now — please try again in a moment."

    payload: dict[str, Any] = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens or MAX_TOKENS,
    }

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(_url(), headers=headers, json=payload)
        if resp.status_code >= 400:
            print(f"❌ NVIDIA {resp.status_code}:", resp.text[:300])
            return "I'm having a little trouble right now — give me a second and try again."
        return _extract_text(resp.json())
    except Exception as exc:
        print("❌ ZOE LLM ERROR:", exc)
        return "I'm having a little trouble right now — give me a second and try again."


async def call_llm_json(
    system: str,
    user: str,
    *,
    temperature: float = 0.2,
    max_tokens: int = 400,
) -> dict:
    """Call the LLM and parse the result as JSON. Returns {} on failure."""
    headers = _headers()
    if not headers:
        return {}

    payload: dict[str, Any] = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": system + "\nReturn valid JSON only. No markdown. No preamble."},
            {"role": "user", "content": user},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(_url(), headers=headers, json=payload)
        if resp.status_code >= 400:
            print(f"❌ NVIDIA JSON {resp.status_code}:", resp.text[:300])
            return {}
        return _parse_json(_extract_text(resp.json()))
    except Exception as exc:
        print("❌ ZOE LLM JSON ERROR:", exc)
        return {}


def build_messages(
    system: str,
    history: list[dict],
    user_message: str,
    *,
    max_history_turns: int = 10,
) -> list[dict]:
    """Build a full messages array with history for multi-turn calls."""
    msgs = [{"role": "system", "content": system}]
    for turn in history[-max_history_turns:]:
        role = turn.get("role", "")
        content = str(turn.get("content") or "").strip()[:1000]
        if role in ("user", "assistant") and content:
            msgs.append({"role": role, "content": content})
    msgs.append({"role": "user", "content": user_message})
    return msgs
