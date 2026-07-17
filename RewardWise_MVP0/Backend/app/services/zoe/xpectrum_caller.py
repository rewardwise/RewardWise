"""
zoe/xpectrum_caller.py
──────────────────────
Client for the Xpectrum Toolkit chat API (Dify-compatible `/chat-messages`).

Xpectrum is an *agent platform*, not a raw chat-completions endpoint: the model,
system prompt, temperature, and knowledge base all live server-side in the
Xpectrum agent ("TravelAgent", mode=agent-chat). This module just forwards the
user's query (plus per-user context as `inputs`) and assembles the streamed
answer back into a plain string — so it can stand in for `llm_caller` at the
pipeline level during the NVIDIA → Xpectrum migration.

Key facts about the upstream contract (verified live 2026-06-25):
  • Agent-chat apps support STREAMING ONLY. `response_mode:"blocking"` returns
    HTTP 400 "Agent Chat App does not support blocking mode".
  • SSE events: `agent_message` (answer deltas in `.answer`), `agent_thought`,
    `message_end` (carries metadata.usage), `error`.
  • Multi-turn continuity is via the upstream `conversation_id` — persist it on
    the Zoe session and pass it back on the next turn.

Functions:
  call_xpectrum() — send one user turn, return assembled answer + conv id + usage
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any, Optional

import httpx

XPECTRUM_BASE_URL = os.getenv("XPECTRUM_BASE_URL", "https://cloud.xpectrum.co/v1")
TIMEOUT = float(os.getenv("XPECTRUM_TIMEOUT_SECONDS", "60"))

_FALLBACK_MSG = "I'm having a little trouble right now — give me a second and try again."
_CONNECT_MSG  = "I'm having trouble connecting right now — please try again in a moment."


@dataclass
class XpectrumReply:
    """Result of a single Xpectrum chat turn."""
    answer: str
    conversation_id: Optional[str] = None
    message_id: Optional[str] = None
    usage: dict[str, Any] = field(default_factory=dict)
    ok: bool = True
    error: Optional[str] = None


def _url() -> str:
    return f"{XPECTRUM_BASE_URL.rstrip('/')}/chat-messages"


def _headers() -> dict[str, str] | None:
    key = os.getenv("XPECTRUM_API_KEY")
    if not key:
        return None
    return {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def _payload(
    query: str,
    *,
    user: str,
    conversation_id: Optional[str],
    inputs: Optional[dict[str, Any]],
) -> dict[str, Any]:
    return {
        # `inputs` map to the agent's prompt variables (wallet, verdict_context).
        # Unknown keys are tolerated by the upstream when no input form is set.
        "inputs": inputs or {},
        "query": query,
        "response_mode": "streaming",  # agent-chat: streaming is the ONLY valid mode
        "user": user,
        # Empty string starts a new upstream conversation; a real id resumes one.
        "conversation_id": conversation_id or "",
    }


def _parse_sse_line(line: str) -> dict | None:
    """Parse a single `data: {...}` SSE line into an event dict, or None."""
    if not line or not line.startswith("data:"):
        return None
    payload = line[5:].strip()
    if not payload or payload == "[DONE]":
        return None
    try:
        return json.loads(payload)
    except json.JSONDecodeError:
        return None


async def call_xpectrum(
    query: str,
    *,
    user: str,
    conversation_id: Optional[str] = None,
    inputs: Optional[dict[str, Any]] = None,
) -> XpectrumReply:
    """
    Send one user turn to the Xpectrum agent and return the assembled reply.

    Streams the SSE response, concatenating `agent_message` / `message` answer
    deltas. Never raises — connection/HTTP/parse failures degrade to a friendly
    fallback message with ok=False so the caller can decide whether to retry or
    fall through to another provider.

    Args:
        query:           The user's latest message.
        user:            Stable per-end-user identifier (Xpectrum scopes
                         conversations + rate limits by this).
        conversation_id: Upstream conversation id to resume, or None to start new.
        inputs:          Prompt variables for the agent (e.g. wallet, verdict).

    Returns:
        XpectrumReply with answer, conversation_id (persist this!), usage.
    """
    headers = _headers()
    if not headers:
        return XpectrumReply(
            answer=_CONNECT_MSG, ok=False, error="Missing XPECTRUM_API_KEY",
        )

    body = _payload(query, user=user, conversation_id=conversation_id, inputs=inputs)

    answer_parts: list[str] = []
    out_conv_id: Optional[str] = conversation_id
    out_msg_id: Optional[str] = None
    usage: dict[str, Any] = {}

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            async with client.stream("POST", _url(), headers=headers, json=body) as resp:
                if resp.status_code >= 400:
                    detail = (await resp.aread()).decode("utf-8", "replace")[:300]
                    print(f"❌ XPECTRUM {resp.status_code}:", detail)
                    return XpectrumReply(
                        answer=_CONNECT_MSG, conversation_id=conversation_id,
                        ok=False, error=f"HTTP {resp.status_code}: {detail}",
                    )

                async for line in resp.aiter_lines():
                    ev = _parse_sse_line(line)
                    if ev is None:
                        continue

                    etype = ev.get("event")
                    out_conv_id = ev.get("conversation_id") or out_conv_id
                    out_msg_id = ev.get("message_id") or ev.get("id") or out_msg_id

                    # agent-chat streams the answer as incremental deltas on
                    # `agent_message` (verified live: only agent_message /
                    # agent_thought / message_end fire). `message_replace` (used
                    # for moderation/annotation rewrites) carries the FULL answer
                    # and must REPLACE, not append, to avoid duplicated text.
                    if etype == "agent_message":
                        answer_parts.append(ev.get("answer", "") or "")
                    elif etype == "message_replace":
                        answer_parts = [ev.get("answer", "") or ""]
                    elif etype == "message_end":
                        usage = (ev.get("metadata") or {}).get("usage") or {}
                    elif etype == "error":
                        msg = ev.get("message") or "upstream error"
                        print("❌ XPECTRUM stream error:", msg)
                        return XpectrumReply(
                            answer=_FALLBACK_MSG, conversation_id=out_conv_id,
                            message_id=out_msg_id, ok=False, error=str(msg),
                        )
    except Exception as exc:
        print("❌ XPECTRUM ERROR:", exc)
        return XpectrumReply(
            answer=_CONNECT_MSG, conversation_id=conversation_id,
            ok=False, error=str(exc),
        )

    answer = "".join(answer_parts).strip()
    if not answer:
        return XpectrumReply(
            answer=_FALLBACK_MSG, conversation_id=out_conv_id,
            message_id=out_msg_id, usage=usage, ok=False, error="empty answer",
        )

    return XpectrumReply(
        answer=answer, conversation_id=out_conv_id,
        message_id=out_msg_id, usage=usage, ok=True,
    )
