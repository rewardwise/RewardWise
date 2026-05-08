"""
Zoe Voice Route
---------------
POST /api/zoe/voice

Accepts transcript text (from browser Web Speech API),
runs it through Zoe LLM, then synthesizes reply via NVIDIA Magpie TTS.

Browser handles STT (Web Speech API) — no gRPC needed.
Backend handles: Zoe LLM + NVIDIA Magpie TTS (HTTP).

Branch: feature/zoe-voice-nvidia-nim
"""

import os
import re
import json

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, Form, HTTPException, Request
from fastapi.responses import Response
from app.services.zoe_service import handle_zoe

load_dotenv(override=True)
router = APIRouter()

NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY", "")
TTS_URL = "https://integrate.api.nvidia.com/v1/audio/speech"
TTS_VOICE = os.environ.get("ZOE_TTS_VOICE", "Magpie-Multilingual.EN-US.Sofia.Happy")
TTS_MODEL = "magpie-tts-multilingual"
TIMEOUT = httpx.Timeout(30.0)


async def synthesize_speech(text: str) -> bytes:
    """Call NVIDIA Magpie TTS and return WAV bytes."""
    if not NVIDIA_API_KEY:
        raise HTTPException(status_code=500, detail="NVIDIA_API_KEY not configured")

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
      transcript (text from browser STT) → Zoe LLM → Magpie TTS audio

    Returns WAV audio with metadata in headers:
      X-Reply: Zoe's text reply
      X-Prefill: JSON prefill payload if Zoe extracted trip info
    """
    if not transcript.strip():
        raise HTTPException(status_code=422, detail="Empty transcript")

    # Parse history
    try:
        history_list = json.loads(history) if history else []
    except json.JSONDecodeError:
        history_list = []

    # Zoe LLM
    zoe_payload = {
        "message": transcript,
        "history": history_list,
        "conversation_id": conversation_id or None,
        "user_id": user_id or None,
    }

    try:
        zoe_result = await handle_zoe(zoe_payload, request=request)
    except Exception as e:
        print(f"Zoe LLM error: {e}")
        raise HTTPException(status_code=502, detail="Zoe failed to respond")

    reply_text = zoe_result.get("message", "Sorry, I had trouble with that.")
    prefill = zoe_result.get("prefill") or ""

    # Strip markdown for TTS
    tts_text = re.sub(r"[*_#`>~\[\]()]", "", reply_text).strip()
    if len(tts_text) > 500:
        tts_text = tts_text[:500] + "…"

    # NVIDIA Magpie TTS
    try:
        audio_out = await synthesize_speech(tts_text)
    except Exception as e:
        print(f"TTS error: {e}")
        audio_out = b""

    expose = "X-Reply, X-Prefill"
    headers = {
        "X-Reply": reply_text[:2000],
        "X-Prefill": str(prefill),
        "Access-Control-Expose-Headers": expose,
    }

    if audio_out:
        return Response(content=audio_out, media_type="audio/wav", headers=headers)
    else:
        # No audio — 204 so frontend falls back to browser TTS
        return Response(status_code=204, headers=headers)
