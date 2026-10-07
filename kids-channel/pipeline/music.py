"""Background music: a track from assets/music/ if there is one, otherwise a soft generated tune.

Tracks you add must be ones you have the rights to use on YouTube (YouTube Audio Library, or your own
music made with a tool whose plan grants commercial use).
"""

import random
import wave

import numpy as np

from .config import MUSIC_DIR

RATE = 44100
# C major pentatonic across two octaves: never sounds wrong, whatever order the notes come in.
SCALE = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00]


def pick_track(seconds: float, out_wav, seed: int) -> str:
    tracks = sorted(p for p in MUSIC_DIR.glob("*") if p.suffix.lower() in (".mp3", ".wav", ".m4a", ".ogg"))
    if tracks:
        return str(random.Random(seed).choice(tracks))
    generate(seconds, out_wav, seed)
    return str(out_wav)


def generate(seconds: float, out_wav, seed: int) -> None:
    """A gentle music-box melody over soft pad chords."""
    rnd = random.Random(seed)
    bpm = rnd.choice([84, 92, 100])
    beat = 60 / bpm
    n = int(seconds * RATE)
    track = np.zeros(n)

    phrase = [rnd.randrange(len(SCALE)) for _ in range(16)]
    i, t = 0, 0.0
    while t < seconds:
        note = SCALE[phrase[i % len(phrase)]]
        length = beat * rnd.choice([1, 1, 1, 2])
        _add(track, t, length * 1.6, note, 0.16, bell=True)
        t += length
        i += 1
        if i % 32 == 0:  # vary the tune a little every couple of phrases
            phrase[rnd.randrange(len(phrase))] = rnd.randrange(len(SCALE))

    chords = [(130.81, 164.81, 196.00), (110.00, 130.81, 164.81), (87.31, 110.00, 130.81), (98.00, 123.47, 146.83)]
    t, c = 0.0, 0
    while t < seconds:
        for f in chords[c % len(chords)]:
            _add(track, t, beat * 4.2, f, 0.05, bell=False)
        t += beat * 4
        c += 1

    fade = int(min(3.0, seconds / 4) * RATE)
    track[:fade] *= np.linspace(0, 1, fade)
    track[-fade:] *= np.linspace(1, 0, fade)
    track /= max(1e-9, np.abs(track).max()) / 0.8
    pcm = (track * 32767).astype(np.int16)
    with wave.open(str(out_wav), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(pcm.tobytes())


def _add(track, start, length, freq, amp, bell):
    a = int(start * RATE)
    b = min(len(track), a + int(length * RATE))
    if b <= a:
        return
    t = np.arange(b - a) / RATE
    if bell:
        env = np.exp(-t * 3.2) * np.minimum(1, t * 200)
        wave_ = np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(2 * np.pi * freq * 2 * t)
    else:
        env = np.minimum(1, t * 2) * np.minimum(1, (length - t) * 2)
        wave_ = np.sin(2 * np.pi * freq * t)
    track[a:b] += amp * env * wave_
