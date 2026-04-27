"""Audio extraction → faster-whisper transcription → Gemini analysis → R2 upload."""

from __future__ import annotations

import json
import logging
import mimetypes
import os
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any, Optional

import db
import r2

log = logging.getLogger("contributions.pipeline")

_whisper_model = None


def _get_whisper_model():
    global _whisper_model
    if _whisper_model is not None:
        return _whisper_model

    from faster_whisper import WhisperModel

    model_size = os.environ.get("WHISPER_MODEL", "small")
    device = os.environ.get("WHISPER_DEVICE", "auto")
    compute_type = os.environ.get("WHISPER_COMPUTE_TYPE", "int8")
    log.info("Loading faster-whisper model=%s device=%s compute=%s", model_size, device, compute_type)
    _whisper_model = WhisperModel(model_size, device=device, compute_type=compute_type)
    return _whisper_model


def _ffmpeg_extract_audio(src: Path, dst: Path) -> None:
    if shutil.which("ffmpeg") is None:
        raise RuntimeError("ffmpeg not found on PATH")
    cmd = [
        "ffmpeg", "-y", "-i", str(src),
        "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le",
        str(dst),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {proc.stderr.strip()[:500]}")


def _transcribe_with_whisper(audio_path: Path) -> dict[str, Any]:
    model = _get_whisper_model()
    segments_iter, info = model.transcribe(
        str(audio_path),
        beam_size=1,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
    )
    segments = []
    text_parts: list[str] = []
    for seg in segments_iter:
        segments.append({
            "start": round(float(seg.start), 3),
            "end": round(float(seg.end), 3),
            "text": seg.text.strip(),
        })
        text_parts.append(seg.text.strip())
    return {
        "language": getattr(info, "language", None),
        "segments": segments,
        "text": " ".join(text_parts).strip(),
    }


_GEMINI_TRANSCRIBE_PROMPT = (
    "Transcribe this audio file verbatim. "
    "Return a single JSON object (no prose, no markdown fences) with these keys:\n"
    '{"language": "en", "text": "full transcript as one string", '
    '"segments": [{"start": 0.0, "end": 5.0, "text": "segment text"}, ...]}\n'
    "Estimate timestamps as best you can — divide the total duration evenly if unsure. "
    "Keep each segment 5-15 seconds. Language should be the BCP-47 code (e.g. 'en', 'hi', 'es')."
)


def _transcribe_with_gemini_audio(audio_path: Path) -> dict[str, Any]:
    """Fallback transcription via Gemini Files API when Whisper is unavailable."""
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set — cannot use Gemini transcription fallback")

    from google import genai
    from google.genai import types as genai_types

    client = genai.Client(api_key=api_key)

    log.info("Uploading audio to Gemini Files API for transcription: %s", audio_path.name)
    uploaded = client.files.upload(
        file=audio_path,
        config=genai_types.UploadFileConfig(mime_type="audio/wav", display_name=audio_path.name),
    )

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            genai_types.Part.from_uri(file_uri=uploaded.uri, mime_type="audio/wav"),
            _GEMINI_TRANSCRIBE_PROMPT,
        ],
        config=genai_types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.1,
        ),
    )

    # Clean up the uploaded file (best-effort)
    try:
        client.files.delete(name=uploaded.name)
    except Exception:
        pass

    raw = _coerce_json((response.text or "").strip())
    # Normalise to standard shape
    return {
        "language": raw.get("language") or "en",
        "segments": raw.get("segments") or [],
        "text": raw.get("text") or "",
    }


def _transcribe(audio_path: Path) -> dict[str, Any]:
    """Transcribe audio: Whisper first, Gemini as automatic fallback."""
    try:
        result = _transcribe_with_whisper(audio_path)
        log.info("Whisper transcription succeeded")
        return result
    except Exception as whisper_err:
        log.warning("Whisper transcription failed (%s) — falling back to Gemini", whisper_err)
        try:
            result = _transcribe_with_gemini_audio(audio_path)
            log.info("Gemini transcription fallback succeeded")
            # Tag the language to indicate it was Gemini-transcribed
            result["_source"] = "gemini_fallback"
            return result
        except Exception as gemini_err:
            # Both failed — raise a combined error that includes both messages
            raise RuntimeError(
                f"Whisper: {whisper_err} | Gemini fallback: {gemini_err}"
            ) from gemini_err


def _format_timestamp(seconds: float) -> str:
    seconds = max(0.0, float(seconds))
    m = int(seconds // 60)
    s = int(seconds % 60)
    return f"[{m:02d}:{s:02d}]"


def _render_pretty_transcript(segments: list[dict[str, Any]]) -> str:
    """Group whisper segments into [mm:ss]-prefixed paragraphs.

    Starts a new paragraph when the running joined text gets long (>280 chars)
    or there's a >1.5s pause between adjacent segments.
    """
    if not segments:
        return ""
    paragraphs: list[str] = []
    current_start: Optional[float] = None
    current_lines: list[str] = []
    prev_end: Optional[float] = None
    for seg in segments:
        text = seg["text"].strip()
        if not text:
            continue
        if current_start is None:
            current_start = seg["start"]
            current_lines = [text]
            prev_end = seg["end"]
            continue
        joined = " ".join(current_lines)
        long_pause = prev_end is not None and (seg["start"] - prev_end) > 1.5
        if len(joined) > 280 or long_pause:
            paragraphs.append(f"{_format_timestamp(current_start)} {joined}")
            current_start = seg["start"]
            current_lines = [text]
        else:
            current_lines.append(text)
        prev_end = seg["end"]
    if current_lines and current_start is not None:
        paragraphs.append(f"{_format_timestamp(current_start)} {' '.join(current_lines)}")
    return "\n\n".join(paragraphs)


# ---------------------------------------------------------------------------
# Gemini analysis
# ---------------------------------------------------------------------------

GEMINI_SYSTEM = (
    "You are an editor for an internal knowledge library called Hyvemind. "
    "You are given the transcript of a how-to video. Return a single JSON object "
    "with these exact keys and shapes (no prose, no markdown fences):\n"
    "{\n"
    '  "title": string,                 // concise improved title\n'
    '  "summary": string,               // 2-4 sentence summary\n'
    '  "tags": string[],                // 3-8 lowercase tags, no leading #\n'
    '  "topics": string[],              // higher-level topics\n'
    '  "keyTakeaways": string[],        // 3-6 bullet takeaways\n'
    '  "actionItems": string[],         // concrete next actions\n'
    '  "notableInsights": string[],     // surprising or non-obvious points\n'
    '  "qualityFlags": string[],        // e.g. "audio unclear", "missing context" — empty if none\n'
    '  "chapters": [                    // 3-8 chapters covering the video\n'
    '    { "startSeconds": number, "title": string, "summary": string }\n'
    "  ],\n"
    '  "steps": [                       // 3-8 instructional steps\n'
    "    { \"title\": string, \"body\": string, \"tags\": string[], \"keyStep\": boolean }\n"
    "  ]\n"
    "}\n"
    "Be specific. Prefer verbs in step titles. Mark at most 2 steps as keyStep:true."
)


def _analyze_with_gemini(*, transcript: str, title: str, filename: str, language: Optional[str]) -> dict[str, Any]:
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")

    from google import genai
    from google.genai import types as genai_types

    client = genai.Client(api_key=api_key)
    user_prompt = (
        f"Original filename: {filename}\n"
        f"User-provided title: {title or '(none)'}\n"
        f"Detected language: {language or 'unknown'}\n\n"
        "TRANSCRIPT:\n"
        f"{transcript}"
    )

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=user_prompt,
        config=genai_types.GenerateContentConfig(
            system_instruction=GEMINI_SYSTEM,
            response_mime_type="application/json",
            temperature=0.3,
        ),
    )

    return _coerce_json((response.text or "").strip())


_FENCE_RE = re.compile(r"^```(?:json)?\s*(.*?)\s*```$", re.DOTALL)


def _coerce_json(raw: str) -> dict[str, Any]:
    if not raw:
        raise RuntimeError("Gemini returned empty response")
    m = _FENCE_RE.match(raw.strip())
    if m:
        raw = m.group(1)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}")
        if start >= 0 and end > start:
            return json.loads(raw[start : end + 1])
        raise


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------


def _r2_key(user_id: str, job_id: str, name: str) -> str:
    safe_user = re.sub(r"[^A-Za-z0-9_-]", "_", user_id)
    return f"users/{safe_user}/contributions/{job_id}/{name}"


def run_job(job_id: str) -> None:
    job = db.get_contribution(job_id)
    if job is None:
        log.error("run_job: missing job %s", job_id)
        return

    try:
        if not job.original_path:
            raise RuntimeError("job has no uploaded video")
        original_path = Path(job.original_path)

        # 1. Extract audio
        db.update_contribution(job_id, status="extracting_audio", stage_label="Extracting audio", progress=18)
        audio_path = original_path.parent / "audio.wav"
        _ffmpeg_extract_audio(original_path, audio_path)
        db.update_contribution(job_id, audio_path=str(audio_path), progress=35)

        # 2. Transcribe (Whisper primary, Gemini fallback)
        db.update_contribution(job_id, status="transcribing", stage_label="Transcribing audio", progress=42)
        result = _transcribe(audio_path)
        used_fallback = result.pop("_source", None) == "gemini_fallback"
        stage = "Transcribed via Gemini (Whisper unavailable)" if used_fallback else "Transcribed"
        transcript_text = _render_pretty_transcript(result["segments"]) or result["text"]
        db.update_contribution(
            job_id,
            transcript=transcript_text,
            transcript_segments=result["segments"],
            detected_language=result["language"],
            stage_label=stage,
            progress=68,
        )

        # 3. Upload to R2 in parallel-ish (non-fatal if it fails)
        if r2.is_configured():
            db.update_contribution(job_id, stage_label="Uploading to storage", progress=72)
            ext = original_path.suffix.lower() or ".bin"
            ctype, _ = mimetypes.guess_type(original_path.name)
            orig_key = _r2_key(job.user_clerk_id, job_id, f"original{ext}")
            audio_key = _r2_key(job.user_clerk_id, job_id, "audio.wav")
            uploaded_orig = r2.upload_file(original_path, orig_key, content_type=ctype or "video/mp4")
            uploaded_audio = r2.upload_file(audio_path, audio_key, content_type="audio/wav")
            db.update_contribution(
                job_id,
                original_r2_key=uploaded_orig,
                audio_r2_key=uploaded_audio,
                progress=80,
            )

        # 4. Analyze
        db.update_contribution(job_id, status="analyzing", stage_label="Analyzing with Gemini", progress=85)
        try:
            analysis = _analyze_with_gemini(
                transcript=result["text"] or transcript_text,
                title=job.title,
                filename=job.original_file_name,
                language=result["language"],
            )
        except Exception as gem_err:
            log.exception("Gemini analysis failed for job %s", job_id)
            db.update_contribution(
                job_id,
                status="done",
                stage_label="Transcription complete (analysis unavailable)",
                progress=100,
                analysis=None,
                error=f"analysis_unavailable: {gem_err}",
            )
            return

        db.update_contribution(
            job_id,
            status="done",
            stage_label="Done",
            progress=100,
            analysis=analysis,
        )

    except Exception as err:
        log.exception("Pipeline failed for job %s", job_id)
        db.update_contribution(job_id, status="error", error=str(err), stage_label="Failed")
