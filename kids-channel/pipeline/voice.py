"""Narration audio per scene.

TTS_PROVIDER picks the voice (or it is chosen automatically):
- elevenlabs: the most natural voice, when ELEVENLABS_API_KEY is set.
- edge:       Microsoft's neural voices through edge-tts. Free, no key.
- silent:     silence of the right length, for offline tests.
"""

import asyncio
import os
import subprocess

import requests


def provider() -> str:
    chosen = os.environ.get("TTS_PROVIDER")
    if chosen:
        return chosen
    return "elevenlabs" if os.environ.get("ELEVENLABS_API_KEY") else "edge"


def speak(config: dict, text: str, out_mp3) -> float:
    """Write the narration to out_mp3 and return its length in seconds."""
    kind = provider()
    if kind == "elevenlabs":
        _elevenlabs(config, text, out_mp3)
    elif kind == "edge":
        _edge(config, text, out_mp3)
    else:
        seconds = max(3.0, len(text.split()) / 2.3)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i",
                        "anullsrc=r=44100:cl=stereo", "-t", f"{seconds:.2f}", str(out_mp3)], check=True)
    return duration(out_mp3)


def _elevenlabs(config: dict, text: str, out_mp3) -> None:
    voice_id = config["voice"]["elevenlabs_voice_id"]
    r = requests.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
        headers={"xi-api-key": os.environ["ELEVENLABS_API_KEY"]},
        json={"text": text, "model_id": "eleven_multilingual_v2",
              "voice_settings": {"stability": 0.55, "similarity_boost": 0.8, "style": 0.35}},
        timeout=180,
    )
    r.raise_for_status()
    with open(out_mp3, "wb") as f:
        f.write(r.content)


def _edge(config: dict, text: str, out_mp3) -> None:
    import edge_tts

    async def run():
        await edge_tts.Communicate(text, config["voice"]["edge_voice"],
                                   rate=config["voice"].get("edge_rate", "+0%")).save(str(out_mp3))
    for attempt in range(3):
        try:
            asyncio.run(run())
            return
        except Exception:
            if attempt == 2:
                raise


def duration(path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "default=nw=1:nk=1", str(path)], capture_output=True, text=True, check=True)
    return float(out.stdout.strip())
