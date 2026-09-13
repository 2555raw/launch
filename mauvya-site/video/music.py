#!/usr/bin/env python3
"""Writes the film's soundtrack.

    python3 video/music.py out.wav [seconds]

An original piece, synthesised here rather than sampled or licensed: nothing in
it is anyone else's audio. D minor at 118 BPM, built around a sonar
ping, because the thing the film is about is a hook that looks. The parts
arrive one at a time, the way the picture does.
"""

import math
import sys
import wave

import numpy as np

SR = 44100
BPM = 118.0
BEAT = 60.0 / BPM
BAR = BEAT * 4


def env(n, attack, decay, sustain=0.0, release=0.0):
    """A plain ADSR over n samples."""
    out = np.zeros(n)
    a = min(int(attack * SR), n)
    out[:a] = np.linspace(0, 1, a, endpoint=False)
    d = min(int(decay * SR), n - a)
    if d > 0:
        out[a : a + d] = np.linspace(1, sustain, d, endpoint=False)
    r = min(int(release * SR), n - a - d)
    s = n - a - d - r
    if s > 0:
        out[a + d : a + d + s] = sustain
    if r > 0:
        out[n - r :] = np.linspace(sustain, 0, r)
    return out


def lowpass(x, cutoff):
    """One pole lowpass, enough to take the edge off a saw."""
    a = math.exp(-2 * math.pi * cutoff / SR)
    b = 1 - a
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc = b * v + a * acc
        y[i] = acc
    return y


def saw(freq, n, detune=0.0):
    t = np.arange(n) / SR
    return 2.0 * ((t * freq * (1 + detune)) % 1.0) - 1.0


def add(buf, sig, at):
    i = int(at * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i]


def ping(at, buf, note=880.00, gain=0.24):
    """The signature: a struck sine that rings out, and answers itself twice."""
    n = int(2.6 * SR)
    t = np.arange(n) / SR
    tone = (
        np.sin(2 * np.pi * note * t)
        + 0.30 * np.sin(2 * np.pi * note * 2.01 * t)
        + 0.10 * np.sin(2 * np.pi * note * 3.02 * t)
    )
    struck = tone * np.exp(-t * 2.6) * gain
    add(buf, struck, at)
    add(buf, struck * 0.30, at + BEAT * 1.5)
    add(buf, struck * 0.12, at + BEAT * 3.0)


def drone(root, at, dur, buf, gain=0.12):
    n = int(dur * SR)
    voices = np.zeros(n)
    for mult, det in ((1, 0.0), (1, 0.003), (1.5, -0.002), (2, 0.004), (3, -0.004)):
        voices += saw(root * mult, n, det)
    voices = lowpass(voices / 5.0, 760)
    add(buf, voices * env(n, dur * 0.40, 0, 1.0, dur * 0.40) * gain, at)


def sub(at, buf, gain=0.9):
    """Soft and low. The film is calm, so the floor is felt, not heard."""
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    pitch = 98 * np.exp(-t * 30) + 39
    body = np.sin(2 * np.pi * np.cumsum(pitch) / SR)
    add(buf, body * np.exp(-t * 6.0) * 0.82 * gain, at)


def tick(at, buf, gain=0.16):
    """A clock, not a hi hat."""
    n = int(0.035 * SR)
    t = np.arange(n) / SR
    noise = np.random.uniform(-1, 1, n)
    noise = noise - lowpass(noise, 3400)
    add(buf, noise * np.exp(-t * 150) * gain, at)


def bass(note, at, dur, buf, gain=0.40):
    n = int(dur * SR)
    tone = saw(note, n) * 0.55 + np.sin(2 * np.pi * note * np.arange(n) / SR) * 0.55
    tone = lowpass(tone, 230)
    add(buf, tone * env(n, 0.006, dur * 0.85, 0.28, dur * 0.14) * gain, at)


def bell(note, at, dur, buf, gain=0.15):
    n = int(dur * SR)
    t = np.arange(n) / SR
    tone = (
        np.sin(2 * np.pi * note * t)
        + 0.42 * np.sin(2 * np.pi * note * 2.76 * t)
        + 0.16 * np.sin(2 * np.pi * note * 5.4 * t)
    )
    shaped = tone * np.exp(-t * 7.0) * gain
    add(buf, shaped, at)
    add(buf, shaped * 0.26, at + BEAT * 0.75)


# D minor: the root and the fifth underneath, a pentatonic figure above.
E1, E2, G2, B2, D3 = 36.71, 73.42, 87.31, 110.00, 130.81
FIGURE = [587.33, 880.00, 698.46, 523.25, 440.00, 698.46, 587.33, 392.00]


def render(seconds):
    n = int(seconds * SR)
    buf = np.zeros(n + 3 * SR)
    bars = int(seconds / BAR) + 2

    for b in range(bars):
        t0 = b * BAR
        if t0 > seconds:
            break

        # The drone holds the whole way and drops a tone near the end, so the
        # last third settles instead of just stopping.
        root = E1 if b % 8 < 6 else 32.70                # D, then C for the fall
        drone(root * 2, t0, BAR * 1.04, buf, 0.10 if b < 2 else 0.13)

        if b == 0 or b % 4 == 0:                         # the ping, every four bars
            ping(t0 + BEAT * 0.5, buf, gain=0.26 if b == 0 else 0.19)

        if b >= 1:                                       # the clock
            for e in range(8):
                tick(t0 + e * BEAT / 2, buf, 0.16 if e % 2 else 0.11)

        if b >= 2:                                       # the floor
            for beat in (0, 2):
                sub(t0 + beat * BEAT, buf, 1.0 if beat == 0 else 0.8)
            for i, off in enumerate((0.0, 1.5, 2.0, 3.5)):
                note = (E2, E2, G2, B2)[i] if b % 4 != 3 else (E2, D3, G2, B2)[i]
                bass(note, t0 + off * BEAT, BEAT * 0.5, buf)

        if b >= 4:                                       # the figure on top
            for i, note in enumerate(FIGURE):
                if b % 4 == 3 and i % 2:
                    continue                             # thin it every fourth bar
                bell(note, t0 + i * BEAT / 2, BEAT * 1.1, buf, 0.14)

    out = buf[:n]

    # Duck a touch under each sub, so the low end stays clean.
    duck = np.ones(n)
    for b in range(bars):
        for beat in (0, 2):
            at = int((b * BAR + beat * BEAT) * SR)
            if 0 <= at < n:
                m = min(int(0.18 * SR), n - at)
                duck[at : at + m] *= np.linspace(0.74, 1.0, m)
    out *= duck

    out *= env(n, 0.7, 0, 1.0, 2.2)                      # fade in, fade out
    peak = np.max(np.abs(out)) or 1.0
    out = np.tanh(out / peak * 1.2) * 0.86               # gentle limiting

    stereo = np.stack([out, np.roll(out, 260)], axis=1)  # a little width
    return np.clip(stereo, -1, 1)


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else "soundtrack.wav"
    seconds = float(sys.argv[2]) if len(sys.argv) > 2 else 26.0
    audio = (render(seconds) * 32767).astype(np.int16)
    with wave.open(target, "w") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(audio.tobytes())
    print(f"wrote {target} ({seconds:.1f}s)")


if __name__ == "__main__":
    main()
