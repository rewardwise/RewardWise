"""
Zoe Voice Route
---------------
POST /api/zoe/voice

Accepts transcript text from browser Web Speech API, runs it through Zoe,
and optionally synthesizes reply audio. Browser TTS is used as the default
fallback because NVIDIA TTS may not be available on every NIM account/model.
"""

import base64
import json
import os
import re

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, Form, HTTPException, Request
from fastapi.responses import Response

from app.services.zoe_service import handle_zoe

load_dotenv(override=True)
router = APIRouter()

NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY", "")
TTS_URL = os.environ.get("ZOE_TTS_URL", "https://integrate.api.nvidia.com/v1/audio/speech")
TTS_VOICE = os.environ.get("ZOE_TTS_VOICE", "Magpie-Multilingual.EN-US.Sofia.Happy")
TTS_MODEL = os.environ.get("ZOE_TTS_MODEL", "magpie-tts-multilingual")
ENABLE_NVIDIA_TTS = os.environ.get("ZOE_ENABLE_NVIDIA_TTS", "false").lower() == "true"
TIMEOUT = httpx.Timeout(30.0)


def encode_header(value: str) -> str:
    """Encode arbitrary UTF-8 text so it is safe inside an HTTP header."""
    return base64.b64encode(value.encode("utf-8")).decode("ascii")


async def synthesize_speech(text: str) -> bytes:
    """Call NVIDIA TTS and return audio bytes. Returns b"" when unavailable."""
    if not ENABLE_NVIDIA_TTS:
        return b""

    if not NVIDIA_API_KEY:
        print("TTS disabled: NVIDIA_API_KEY not configured")
        return b""

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.post(
            TTS_URL,
            headers={
                "Authorization": f"Bearer {NVIDIA_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": TTS_MODEL,
                "input": text,
                "voice": TTS_VOICE,
                "response_format": "wav",
                "sample_rate": 22050,
            },
        )

    if resp.status_code != 200:
        print(f"TTS error {resp.status_code}: {resp.text[:300]}")
        return b""

    return resp.content


@router.post("/api/zoe/voice")
async def zoe_voice(
    request: Request,
    transcript: str = Form(...),
    conversation_id: str = Form(default=""),
    history: str = Form(default="[]"),
    user_id: str = Form(default=""),
):
    """
    Voice turn:
      transcript text -> Zoe LLM -> optional audio

    Returns metadata headers:
      X-Reply-B64: base64 UTF-8 Zoe reply text
      X-Prefill: valid JSON prefill payload or empty string

    Returns 204 when no backend audio is available so the frontend can use
    browser speechSynthesis immediately.
    """
    cleaned_transcript = transcript.strip()

    if not cleaned_transcript:
        raise HTTPException(status_code=422, detail="Empty transcript")

    try:
        history_list = json.loads(history) if history else []
    except json.JSONDecodeError:
        history_list = []

    zoe_payload = {
        "message": cleaned_transcript,
        "history": history_list,
        "conversation_id": conversation_id or None,
        "user_id": user_id or None,
    }

    try:
        zoe_result = await handle_zoe(zoe_payload, request=request)
    except Exception as e:
        print(f"Zoe LLM error: {e}")
        raise HTTPException(status_code=502, detail="Zoe failed to respond")

    reply_text = zoe_result.get("message", "Sorry, I had trouble with that.") or ""
    prefill = zoe_result.get("prefill") or ""

    tts_text = re.sub(r"[*_#`>~\[\]()]", "", reply_text).strip()
    if len(tts_text) > 500:
        tts_text = tts_text[:500] + "..."

    audio_out = b""
    try:
        audio_out = await synthesize_speech(tts_text)
    except Exception as e:
        print(f"TTS error: {e}")
        audio_out = b""

    prefill_header = json.dumps(prefill) if prefill else ""
    expose = "X-Reply-B64, X-Reply, X-Prefill"
    headers = {
        "X-Reply-B64": encode_header(reply_text[:2000]),
        # Keep X-Reply as a plain ASCII-only fallback for older frontend code.
        "X-Reply": reply_text[:1000].encode("ascii", errors="ignore").decode("ascii"),
        "X-Prefill": prefill_header,
        "Access-Control-Expose-Headers": expose,
    }

    if audio_out:
        return Response(content=audio_out, media_type="audio/wav", headers=headers)

    return Response(status_code=204, headers=headers)
