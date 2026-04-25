import os
import json
import asyncio
from typing import Any

from openai import OpenAI


MODEL_NAME = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


async def generate_text(prompt: str) -> str:
    """Generate normal assistant text with gpt-4o-mini."""
    try:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            print("❌ OPENAI_API_KEY missing")
            return "AI service not configured."

        client = OpenAI(api_key=api_key)
        response = await asyncio.to_thread(
            client.chat.completions.create,
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": "You are a helpful travel rewards assistant."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.4,
        )
        return response.choices[0].message.content or "No response"
    except Exception as e:
        print("❌ LLM ERROR:", str(e))
        return "I'm having trouble responding right now."


async def generate_json(
    system_prompt: str,
    user_prompt: str,
    *,
    temperature: float = 0.0,
) -> dict[str, Any]:
    """Generate strict JSON with gpt-4o-mini.

    The helper is intentionally small and defensive. Zoe uses this for trip-state
    interpretation only; backend code still validates the final state before any
    search/verdict call.
    """
    try:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            print("❌ OPENAI_API_KEY missing")
            return {}

        client = OpenAI(api_key=api_key)

        def _call_with_json_mode():
            return client.chat.completions.create(
                model=MODEL_NAME,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=temperature,
                response_format={"type": "json_object"},
            )

        try:
            response = await asyncio.to_thread(_call_with_json_mode)
        except Exception:
            # Older SDK / provider compatibility fallback.
            response = await asyncio.to_thread(
                client.chat.completions.create,
                model=MODEL_NAME,
                messages=[
                    {"role": "system", "content": system_prompt + "\nReturn valid JSON only."},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=temperature,
            )

        raw = response.choices[0].message.content or "{}"
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            start = raw.find("{")
            end = raw.rfind("}")
            if start != -1 and end != -1 and end > start:
                return json.loads(raw[start : end + 1])
            return {}
    except Exception as e:
        print("❌ LLM JSON ERROR:", str(e))
        return {}
