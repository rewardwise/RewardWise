"""
Zoe STT Route
-------------
POST /api/zoe/stt

Accepts uploaded browser audio, converts it to WAV PCM, sends it to NVIDIA
Parakeet via hosted Riva gRPC, and returns {"transcript": "..."}.
"""

import os
import subprocess
import tempfile
from pathlib import Path

import imageio_ffmpeg
import riva.client
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

router = APIRouter()

NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY", "")
STT_GRPC_SERVER = os.environ.get("ZOE_STT_GRPC_SERVER", "grpc.nvcf.nvidia.com:443")
STT_FUNCTION_ID = os.environ.get("ZOE_STT_FUNCTION_ID", "")
STT_LANGUAGE_CODE = os.environ.get("ZOE_STT_LANGUAGE_CODE", "en-US")


@router.post("/api/zoe/stt")
async def transcribe_audio(audio: UploadFile = File(...)):
    audio_bytes = await audio.read()

    if not audio_bytes or len(audio_bytes) < 500:
        raise HTTPException(status_code=400, detail="Audio too short or empty")

    if not NVIDIA_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="STT not configured — missing NVIDIA_API_KEY",
        )

    if not STT_FUNCTION_ID:
        raise HTTPException(
            status_code=503,
            detail="STT not configured — missing ZOE_STT_FUNCTION_ID",
        )

    suffix = Path(audio.filename or "audio.webm").suffix or ".webm"
    temp_path = None
    wav_path = None

    try:
        # 1. Save uploaded browser audio temporarily.
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_audio:
            temp_audio.write(audio_bytes)
            temp_path = temp_audio.name

        # 2. Convert browser WebM/Opus audio into WAV PCM 16k mono.
        # Riva/Parakeet was failing because it could not detect WebM encoding.
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        wav_path = f"{temp_path}.wav"

        ffmpeg_result = subprocess.run(
            [
                ffmpeg_exe,
                "-y",
                "-err_detect", "ignore_err",
                "-fflags", "+discardcorrupt",
                "-i",
                temp_path,
                "-ac",
                "1",
                "-ar",
                "16000",
                "-sample_fmt",
                "s16",
                wav_path,
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
        )

        if ffmpeg_result.returncode != 0:
            print("❌ FFmpeg audio conversion failed:")
            print(ffmpeg_result.stderr[-1000:])
            raise HTTPException(
                status_code=400,
                detail="Could not convert uploaded audio for transcription",
            )

        # 3. Connect to NVIDIA hosted Riva/Parakeet gRPC.
        auth = riva.client.Auth(
            use_ssl=True,
            uri=STT_GRPC_SERVER,
            metadata_args=[
                ["function-id", STT_FUNCTION_ID],
                ["authorization", f"Bearer {NVIDIA_API_KEY}"],
            ],
        )

        asr_service = riva.client.ASRService(auth)

        # 4. Tell Riva exactly what we are sending: WAV PCM, 16k, mono.
        config = riva.client.RecognitionConfig(
            encoding=riva.client.AudioEncoding.LINEAR_PCM,
            sample_rate_hertz=16000,
            language_code=STT_LANGUAGE_CODE,
            max_alternatives=1,
            enable_automatic_punctuation=True,
            audio_channel_count=1,
        )

        with open(wav_path, "rb") as f:
            audio_data = f.read()

        response = asr_service.offline_recognize(audio_data, config)

        transcript_parts = []
        for result in response.results:
            if result.alternatives:
                transcript_parts.append(result.alternatives[0].transcript)

        transcript = " ".join(transcript_parts).strip()

        return JSONResponse({"transcript": transcript})

    except HTTPException:
        raise

    except Exception as e:
        import traceback

        print("❌ Parakeet/Riva STT full error:")
        traceback.print_exc()

        raise HTTPException(
            status_code=502,
            detail=f"STT request failed: {type(e).__name__}: {e}",
        )

    finally:
        for path in [temp_path, wav_path]:
            try:
                if path and os.path.exists(path):
                    os.remove(path)
            except Exception:
                pass