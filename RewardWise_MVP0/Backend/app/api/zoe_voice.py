"""
Zoe Voice Route
---------------
POST /api/zoe/voice

Accepts transcript text, runs it through Zoe LLM, synthesizes reply audio
via NVIDIA Riva gRPC (Magpie TTS). Falls back to 204 (browser TTS) if gRPC
is unavailable.

Security/performance:
- Requires authenticated Supabase user via Bearer token.
- Rate-limited to protect paid NVIDIA usage.
- TTS gRPC work already runs in an executor so the async event loop is not blocked.
"""

import asyncio
import base64
import json
import os
import re

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, Form, HTTPException, Request
from fastapi.responses import Response

from app.api.validators import limiter
from app.api.zoe import require_user
from app.services.zoe_service import handle_zoe

load_dotenv(override=True)

router = APIRouter()

NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY", "")
ENABLE_NVIDIA_TTS = os.environ.get("ZOE_ENABLE_NVIDIA_TTS", "false").lower() == "true"
TTS_GRPC_SERVER = os.environ.get("ZOE_TTS_GRPC_SERVER", "grpc.nvcf.nvidia.com:443")
TTS_FUNCTION_ID = os.environ.get("ZOE_TTS_FUNCTION_ID", "")
TTS_VOICE = os.environ.get("ZOE_TTS_VOICE", "Magpie-Multilingual.EN-US.Sofia")
TTS_LANGUAGE_CODE = os.environ.get("ZOE_TTS_LANGUAGE_CODE", "en-US")
TTS_SAMPLE_RATE = int(os.environ.get("ZOE_TTS_SAMPLE_RATE", "22050"))


def encode_header(value: str) -> str:
    return base64.b64encode(value.encode("utf-8")).decode("ascii")


async def synthesize_speech(text: str) -> bytes:
    """
    Call NVIDIA Riva gRPC TTS and return WAV audio bytes.
    Returns b"" on any failure so the frontend falls back to browser TTS.
    """
    if not ENABLE_NVIDIA_TTS:
        return b""

    if not NVIDIA_API_KEY or not TTS_FUNCTION_ID:
        print("TTS disabled: missing NVIDIA_API_KEY or ZOE_TTS_FUNCTION_ID")
        return b""

    try:
        import riva.client
    except ImportError:
        print("TTS disabled: nvidia-riva-client not installed. Run: pip install nvidia-riva-client")
        return b""

    try:
        auth = riva.client.Auth(
            uri=TTS_GRPC_SERVER,
            use_ssl=True,
            metadata_args=[
                ["function-id", TTS_FUNCTION_ID],
                ["authorization", f"Bearer {NVIDIA_API_KEY}"],
            ],
        )

        tts_client = riva.client.SpeechSynthesisService(auth)

        # Run blocking gRPC call in thread pool so we do not block the event loop.
        def _synthesize():
            resp = tts_client.synthesize(
                text,
                voice_name=TTS_VOICE,
                language_code=TTS_LANGUAGE_CODE,
                encoding=riva.client.AudioEncoding.LINEAR_PCM,
                sample_rate_hz=TTS_SAMPLE_RATE,
            )
            return resp.audio

        loop = asyncio.get_running_loop()
        pcm_bytes: bytes = await loop.run_in_executor(None, _synthesize)

        if not pcm_bytes:
            return b""

        # Wrap raw PCM in a proper WAV container.
        return _pcm_to_wav(pcm_bytes, sample_rate=TTS_SAMPLE_RATE)

    except Exception as e:
        print(f"TTS gRPC error: {e}")
        return b""


def _pcm_to_wav(
    pcm: bytes,
    sample_rate: int = 22050,
    channels: int = 1,
    bit_depth: int = 16,
) -> bytes:
    """Wrap raw PCM bytes in a WAV header."""
    import struct

    byte_rate = sample_rate * channels * bit_depth // 8
    block_align = channels * bit_depth // 8
    data_size = len(pcm)
    chunk_size = 36 + data_size

    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        chunk_size,
        b"WAVE",
        b"fmt ",
        16,
        1,  # PCM format
        channels,
        sample_rate,
        byte_rate,
        block_align,
        bit_depth,
        b"data",
        data_size,
    )

    return header + pcm


@router.post("/api/zoe/voice")
@limiter.limit("10/minute")
async def zoe_voice(
    request: Request,
    transcript: str = Form(...),
    conversation_id: str = Form(default=""),
    history: str = Form(default="[]"),
    auth_user_id: str = Depends(require_user),
):
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
        # Never trust user_id from the client/form. Use the verified Supabase user.
        "user_id": auth_user_id,
        "is_voice": True,
    }

    try:
        zoe_result = await handle_zoe(zoe_payload, request=request)
    except Exception as e:
        print(f"Zoe LLM error: {e}")
        raise HTTPException(status_code=502, detail="Zoe failed to respond")

    reply_text = zoe_result.get("message", "Sorry, I had trouble with that.") or ""
    prefill = zoe_result.get("prefill") or ""

    # Strip markdown before speaking.
    tts_text = re.sub(r"[*_#`>~\[\]()] ", "", reply_text).strip()
    if not tts_text:
        tts_text = re.sub(r"[*_#`>~\[\]()]","", reply_text).strip()

    if len(tts_text) > 500:
        tts_text = tts_text[:500] + "..."

    audio_out = b""
    try:
        audio_out = await synthesize_speech(tts_text)
    except Exception as e:
        print(f"TTS error (outer): {e}")

    prefill_header = json.dumps(prefill) if prefill else ""
    expose = "X-Reply-B64, X-Reply, X-Prefill"

    headers = {
        "X-Reply-B64": encode_header(reply_text[:2000]),
        "X-Reply": reply_text[:1000].encode("ascii", errors="ignore").decode("ascii"),
        "X-Prefill": prefill_header,
        "Access-Control-Expose-Headers": expose,
    }

    if audio_out:
        return Response(content=audio_out, media_type="audio/wav", headers=headers)

    # 204 means frontend falls back to browser TTS.
    return Response(status_code=204, headers=headers)