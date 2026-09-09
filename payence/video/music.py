#!/usr/bin/env python3
"""Writes the film's soundtrack.

    python3 video/music.py out.wav [seconds]

An original piece, synthesised here rather than sampled: nothing in it is
licensed from anyone. Minimal and dark, in the register the film sits in.
A minor at 124 BPM, arranged so the parts arrive one at a time, the way the
picture does.
"""

import math
import struct
import sys
import wave

import numpy as np

SR = 44100
BPM = 124.0
BEAT = 60.0 / BPM
BAR = BEAT * 4


def env(n, attack, decay, sustain=0.0, release=0.0, total=None):
    """A plain ADSR over n samples."""
    total = total or n
    a = int(attack * SR)
    d = int(decay * SR)
    r = int(release * SR)
    out = np.zeros(n)
    a = min(a, n)
    out[:a] = np.linspace(0, 1, a, endpoint=False)
    d = min(d, n - a)
    if d > 0:
        out[a : a + d] = np.linspace(1, sustain, d, endpoint=False)
    s = n - a - d - r
    if s > 0:
        out[a + d : a + d + s] = sustain
    if r > 0:
        out[n - r :] = np.linspace(sustain, 0, r)
    return out


def lowpass(x, cutoff):
    """One-pole lowpass, enough to take the edge off a saw."""
    a = math.exp(-2 * math.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return y


def saw(freq, n, detune=0.0):
    t = np.arange(n) / SR
    f = freq * (1 + detune)
    return 2.0 * ((t * f) % 1.0) - 1.0


def add(buf, sig, at):
    i = int(at * SR)
    j = min(len(buf), i + len(sig))
    if i < len(buf):
        buf[i:j] += sig[: j - i]


def kick(at, buf, gain=1.0):
    n = int(0.42 * SR)
    t = np.arange(n) / SR
    pitch = 118 * np.exp(-t * 34) + 42          # the drop that makes it a kick
    body = np.sin(2 * np.pi * np.cumsum(pitch) / SR)
    click = np.random.uniform(-1, 1, n) * np.exp(-t * 420) * 0.25
    add(buf, (body * np.exp(-t * 7.5) + click) * 0.9 * gain, at)


def hat(at, buf, gain=0.32, length=0.05):
    n = int(length * SR)
    t = np.arange(n) / SR
    noise = np.random.uniform(-1, 1, n)
    noise = noise - lowpass(noise, 2600)         # crude highpass
    add(buf, noise * np.exp(-t * 90) * gain, at)


def bass(note, at, dur, buf, gain=0.42):
    n = int(dur * SR)
    tone = saw(note, n) * 0.6 + np.sin(2 * np.pi * note * np.arange(n) / SR) * 0.5
    tone = lowpass(tone, 260)
    add(buf, tone * env(n, 0.004, dur * 0.9, 0.25, dur * 0.1) * gain, at)


def pluck(note, at, dur, buf, gain=0.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    tone = (
        np.sin(2 * np.pi * note * t)
        + 0.5 * np.sin(2 * np.pi * note * 2 * t)
        + 0.22 * np.sin(2 * np.pi * note * 3 * t)
    )
    shaped = tone * np.exp(-t * 9.5) * gain
    add(buf, shaped, at)
    add(buf, shaped * 0.34, at + BEAT * 0.75)    # one echo, in time
    add(buf, shaped * 0.14, at + BEAT * 1.5)


def pad(root, at, dur, buf, gain=0.11):
    n = int(dur * SR)
    voices = np.zeros(n)
    for mult, det in ((1, 0.0), (1, 0.004), (1.5, -0.003), (2, 0.002), (2.5, 0.005)):
        voices += saw(root * mult, n, det)
    voices = lowpass(voices / 5.0, 900)
    add(buf, voices * env(n, dur * 0.35, 0, 1.0, dur * 0.45) * gain, at)


# A minor: the root, the fifth, and a pentatonic run above it.
A1, A2, C3, E3, G3 = 55.00, 110.00, 130.81, 164.81, 196.00
ARP = [440.00, 523.25, 659.25, 587.33, 523.25, 659.25, 880.00, 659.25]


def render(seconds):
    n = int(seconds * SR)
    buf = np.zeros(n + SR)
    bars = int(seconds / BAR) + 1

    for b in range(bars):
        t0 = b * BAR
        if t0 > seconds:
            break

        # the pad holds the whole way, moving once in the middle
        root = A1 if b % 8 < 6 else 61.74           # A, then B flat for lift
        pad(root * 2, t0, BAR * 1.02, buf, 0.10 if b < 2 else 0.13)

        if b >= 1:                                   # hats from the second bar
            for e in range(8):
                hat(t0 + e * BEAT / 2, buf, 0.20 if e % 2 else 0.30)

        if b >= 3:                                   # the floor arrives
            for beat in range(4):
                kick(t0 + beat * BEAT, buf, 1.0 if beat % 2 == 0 else 0.85)
            for i, off in enumerate((0.5, 1.5, 2.5, 3.5)):
                note = (A2, A2, C3, E3)[i] if b % 4 != 3 else (A2, G3, C3, E3)[i]
                bass(note, t0 + off * BEAT, BEAT * 0.45, buf)

        if b >= 5:                                   # the melody on top
            for i, note in enumerate(ARP):
                if b % 4 == 3 and i % 2:
                    continue                          # thin it out every fourth bar
                pluck(note, t0 + i * BEAT / 2, BEAT * 0.9, buf, 0.16)

    out = buf[:n]

    # duck everything a touch on each kick, so the low end stays clean
    duck = np.ones(n)
    for b in range(bars):
        for beat in range(4):
            at = int((b * BAR + beat * BEAT) * SR)
            if 0 <= at < n:
                m = min(int(0.16 * SR), n - at)
                duck[at : at + m] *= np.linspace(0.72, 1.0, m)
    out *= duck

    out *= env(n, 0.9, 0, 1.0, 2.6)                  # fade in, fade out
    peak = np.max(np.abs(out)) or 1.0
    out = np.tanh(out / peak * 1.25) * 0.86          # gentle limiting

    stereo = np.stack([out, np.roll(out, 240)], axis=1)  # a little width
    return np.clip(stereo, -1, 1)


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else "soundtrack.wav"
    seconds = float(sys.argv[2]) if len(sys.argv) > 2 else 36.0
    audio = (render(seconds) * 32767).astype(np.int16)
    with wave.open(target, "w") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(audio.tobytes())
    print(f"wrote {target} ({seconds:.1f}s)")


if __name__ == "__main__":
    main()
