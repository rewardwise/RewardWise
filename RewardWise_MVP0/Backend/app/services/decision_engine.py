import os
import json
from typing import Any

import httpx


NVIDIA_BASE_URL = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
MODEL_NAME = os.getenv("NVIDIA_MODEL", "nvidia/llama-3.3-nemotron-super-49b-v1.5")
REQUEST_TIMEOUT_SECONDS = float(os.getenv("NVIDIA_TIMEOUT_SECONDS", "60"))


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
        print("❌ NVIDIA LLM HTTP ERROR:", response.status_code, response.text[:1000])
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
                parsed = json.loads(raw[start : end + 1])
                return parsed if isinstance(parsed, dict) else {}
            except json.JSONDecodeError:
                return {}
        return {}


async def generate_text(prompt: str) -> str:
    """Generate normal assistant text directly through NVIDIA NIM."""
    try:
        response = await _post_chat_completion(
            {
                "model": MODEL_NAME,
                "messages": [
                    {"role": "system", "content": "You are Zoe, a helpful travel rewards assistant for MyTravelWallet."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.4,
            }
        )
        return _message_content(response) or "No response"
    except Exception as e:
        print("❌ NVIDIA LLM ERROR:", str(e))
        return "I'm having trouble responding right now."


async def generate_json(
    system_prompt: str,
    user_prompt: str,
    *,
    temperature: float = 0.0,
) -> dict[str, Any]:
    """Generate strict JSON directly through NVIDIA NIM.

    Zoe uses this for trip-state interpretation only; backend code still
    validates the final state before any search/verdict call.
    """
    try:
        base_payload = {
            "model": MODEL_NAME,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
        }

        response = await _post_chat_completion({**base_payload, "response_format": {"type": "json_object"}})
        raw = _message_content(response)
        parsed = _parse_json_object(raw)
        if parsed:
            return parsed

        # Compatibility fallback if the provider/model ignores or rejects JSON mode.
        fallback_response = await _post_chat_completion(
            {
                **base_payload,
                "messages": [
                    {"role": "system", "content": system_prompt + "\nReturn valid JSON only. No markdown."},
                    {"role": "user", "content": user_prompt},
                ],
            }
        )
        return _parse_json_object(_message_content(fallback_response))
    except Exception as e:
        print("❌ NVIDIA LLM JSON ERROR:", str(e))
        return {}
