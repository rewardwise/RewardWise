"""
zoe/llm_caller.py
─────────────────
Thin wrapper around the NVIDIA NIM chat-completions endpoint used by every
Zoe handler. Keeps all HTTP logic in one place so handlers stay clean.

Functions:
  call_llm()              — single turn, text response (existing, kept for compatibility)
  call_llm_json()         — single turn, JSON response (existing, kept for compatibility)
  call_llm_with_history() — multi-turn with real message array (new — use this in all handlers)
  build_messages()        — builds proper multi-turn message array
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

_FALLBACK_MSG = "I'm having a little trouble right now — give me a second and try again."
_CONNECT_MSG  = "I'm having trouble connecting right now — please try again in a moment."


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
                return json.loads(raw[start: end + 1])
            except json.JSONDecodeError:
                pass
    return {}


# ── Core HTTP call ────────────────────────────────────────────────────────────

async def _post(payload: dict) -> dict | None:
    """Make a single HTTP call to the NVIDIA NIM endpoint."""
    headers = _headers()
    if not headers:
        return None
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(_url(), headers=headers, json=payload)
        if resp.status_code >= 400:
            print(f"❌ NVIDIA {resp.status_code}:", resp.text[:300])
            return None
        return resp.json()
    except Exception as exc:
        print("❌ ZOE LLM ERROR:", exc)
        return None


# ── Public API ────────────────────────────────────────────────────────────────

async def call_llm(
    system: str,
    user: str,
    *,
    temperature: float = 0.7,
    max_tokens: int | None = None,
) -> str:
    """
    Single-turn text call. Returns the model's reply as a plain string.
    Kept for backwards compatibility — prefer call_llm_with_history() in handlers.
    """
    payload: dict[str, Any] = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens or MAX_TOKENS,
    }
    result = await _post(payload)
    if result is None:
        return _CONNECT_MSG
    text = _extract_text(result)
    return text or _FALLBACK_MSG


async def call_llm_json(
    system: str,
    user: str,
    *,
    temperature: float = 0.2,
    max_tokens: int = 400,
) -> dict:
    """
    Single-turn JSON call. Returns parsed dict or {} on failure.
    Kept for backwards compatibility — used by parse_call.py.
    """
    payload: dict[str, Any] = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": system + "\nReturn valid JSON only. No markdown. No preamble."},
            {"role": "user", "content": user},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    # Try with json_object response format first
    try:
        json_payload = {**payload, "response_format": {"type": "json_object"}}
        result = await _post(json_payload)
        if result:
            text = _extract_text(result)
            parsed = _parse_json(text)
            if parsed:
                return parsed
    except Exception:
        pass

    # Fallback: plain call with JSON instruction
    result = await _post(payload)
    if result is None:
        return {}
    text = _extract_text(result)
    return _parse_json(text)


def build_messages(
    system: str,
    history: list[dict],
    user_message: str,
    *,
    max_history_turns: int = 12,
    max_content_chars: int = 600,
) -> list[dict]:
    """
    Build a proper multi-turn messages array for the respond call.

    This is the correct way to pass conversation history — as real
    role: user / assistant message objects, not serialized text.

    Args:
        system:            System prompt string
        history:           Conversation history [{role, content}]
        user_message:      The user's latest message
        max_history_turns: Maximum turns to include (default 12)
        max_content_chars: Maximum chars per turn (truncated for token budget)

    Returns:
        List of message dicts ready for the chat completions API
    """
    msgs: list[dict] = [{"role": "system", "content": system}]

    for turn in history[-max_history_turns:]:
        role = turn.get("role", "")
        content = str(turn.get("content") or "").strip()
        if role in ("user", "assistant") and content:
            # Truncate very long turns to keep within token budget
            if len(content) > max_content_chars:
                content = content[:max_content_chars] + "…"
            msgs.append({"role": role, "content": content})

    msgs.append({"role": "user", "content": user_message})
    return msgs


async def call_llm_with_history(
    system: str,
    history: list[dict],
    user_message: str,
    *,
    temperature: float = 0.45,
    max_tokens: int | None = None,
    max_history_turns: int = 12,
) -> str:
    """
    Multi-turn respond call with real conversation history.

    This is the primary call used by all Zoe handlers for generating
    user-facing responses. History is passed as proper role: user/assistant
    message objects — NOT serialized text in the user prompt.

    Args:
        system:            System prompt (Zoe personality + injected ground truth)
        history:           Conversation history [{role, content}]
        user_message:      The user's latest message
        temperature:       Response temperature (default 0.45 — warm but consistent)
        max_tokens:        Token limit (defaults to MAX_TOKENS env var)
        max_history_turns: How many turns of history to include

    Returns:
        Zoe's response as a plain string
    """
    messages = build_messages(
        system,
        history,
        user_message,
        max_history_turns=max_history_turns,
    )

    payload: dict[str, Any] = {
        "model": MODEL_NAME,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens or MAX_TOKENS,
    }

    result = await _post(payload)
    if result is None:
        return _CONNECT_MSG

    text = _extract_text(result)
    return text or _FALLBACK_MSG
