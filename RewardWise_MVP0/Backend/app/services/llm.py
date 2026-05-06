from __future__ import annotations

import json
import os
from typing import Any

import httpx


NVIDIA_BASE_URL = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
MODEL_NAME = os.getenv("NVIDIA_MODEL", "meta/llama-3.3-70b-instruct")
REQUEST_TIMEOUT_SECONDS = float(os.getenv("NVIDIA_TIMEOUT_SECONDS", "45"))

# JSON calls (state delta + Zoe's reply): compact, structured output.
JSON_MAX_TOKENS = int(os.getenv("NVIDIA_JSON_MAX_TOKENS", "400"))

# Text calls: only used for rare non-trip wallet questions. Keep short.
TEXT_MAX_TOKENS = int(os.getenv("NVIDIA_TEXT_MAX_TOKENS", "300"))


def _chat_completions_url() -> str:
    return f"{NVIDIA_BASE_URL.rstrip('/')}/chat/completions"


def _headers() -> dict[str, str] | None:
    api_key = os.getenv("NVIDIA_API_KEY")
    if not api_key:
        print("❌ NVIDIA_API_KEY missing")
        return None
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


async def _post_chat_completion(payload: dict[str, Any]) -> dict[str, Any] | None:
    headers = _headers()
    if headers is None:
        return None

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
        response = await client.post(_chat_completions_url(), headers=headers, json=payload)

    if response.status_code >= 400:
        print("❌ NVIDIA LLM HTTP ERROR:", response.status_code, response.text[:500])
        return None

    return response.json()


def _message_content(response: dict[str, Any] | None) -> str:
    if not response:
        return ""
    try:
        content = response["choices"][0]["message"].get("content")
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts: list[str] = []
            for item in content:
                if isinstance(item, dict):
                    text = item.get("text") or item.get("content")
                    if isinstance(text, str):
                        parts.append(text)
            return "".join(parts)
        return ""
    except (KeyError, IndexError, TypeError):
        return ""


def _parse_json_object(raw: str) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                parsed = json.loads(raw[start: end + 1])
                return parsed if isinstance(parsed, dict) else {}
            except json.JSONDecodeError:
                return {}
        return {}


async def generate_json(
    system_prompt: str,
    user_prompt: str,
    *,
    temperature: float = 0.0,
) -> dict[str, Any]:
    """Single NVIDIA call — returns structured JSON with both state deltas and Zoe's reply.

    This is the only LLM call in a normal Zoe turn. Keep max_tokens lean;
    the model only needs to output a compact JSON object.
    """
    try:
        response = await _post_chat_completion(
            {
                "model": MODEL_NAME,
                "messages": [
                    {"role": "system", "content": system_prompt + "\nReturn valid JSON only. No markdown. No preamble."},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": temperature,
                "max_tokens": JSON_MAX_TOKENS,
            }
        )
        return _parse_json_object(_message_content(response))
    except Exception as e:
        print("❌ NVIDIA LLM JSON ERROR:", str(e))
        return {}


async def generate_text(prompt: str) -> str:
    """Fallback text generation — only used for non-trip wallet balance questions."""
    try:
        response = await _post_chat_completion(
            {
                "model": MODEL_NAME,
                "messages": [
                    {"role": "system", "content": "You are Zoe, a concise travel rewards assistant. Answer directly and briefly."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.3,
                "max_tokens": TEXT_MAX_TOKENS,
            }
        )
        return _message_content(response) or "No response"
    except Exception as e:
        print("❌ NVIDIA LLM TEXT ERROR:", str(e))
        return "I'm having trouble responding right now."
