#!/usr/bin/env python3
"""The reel's music, synthesised rather than borrowed.

Twenty-four seconds in A minor: a koto-ish plucked figure over a slow pad,
with a soft mallet on the scene changes so the cuts have something under
them. The cut times are the ones in film.js, kept here as one list so the
two cannot drift apart.
"""
import math, struct, wave

SR = 44100
DUR = 24.0
CUTS = [0.2, 4.6, 9.0, 13.8, 18.4, 21.2]      # film.js SCENES starts

def env(t, a, d, s, r, dur):
    if t < 0 or t > dur: return 0.0
    if t < a:            return t / a
    if t < a + d:        return 1 - (1 - s) * (t - a) / d
    if t < dur - r:      return s
    return s * (dur - t) / r

def pluck(t, f, dur=1.6):
    """A plucked string: bright at the attack, and the brightness decays
    faster than the level, which is what makes it read as plucked."""
    if t < 0 or t > dur: return 0.0
    e = math.exp(-t * 2.6)
    bright = math.exp(-t * 7.0)
    return (math.sin(2 * math.pi * f * t) * e
            + 0.42 * bright * math.sin(4 * math.pi * f * t)
            + 0.18 * bright * math.sin(6 * math.pi * f * t))

def pad(t, f):
    slow = 0.5 + 0.5 * math.sin(2 * math.pi * 0.07 * t)
    return (math.sin(2 * math.pi * f * t) * 0.6
            + math.sin(2 * math.pi * f * 1.5 * t) * 0.22 * slow
            + math.sin(2 * math.pi * f * 2.0 * t) * 0.1)

def mallet(t, f, dur=1.1):
    if t < 0 or t > dur: return 0.0
    e = math.exp(-t * 4.2)
    return (math.sin(2 * math.pi * f * t) + 0.3 * math.sin(2 * math.pi * f * 2.76 * t)) * e

A = 220.0
SCALE = [A, A * 9 / 8, A * 6 / 5, A * 4 / 3, A * 3 / 2, A * 8 / 5, A * 2]   # A minor-ish
FIG = [0, 4, 2, 5, 4, 2, 0, 3]          # the repeating figure, in scale steps

samples = []
for n in range(int(SR * DUR)):
    t = n / SR
    v = 0.0

    # the pad: two low notes, moving once at the halfway turn
    root = A / 2 if t < 12.4 else A / 2 * 6 / 5
    v += pad(t, root) * 0.10 * env(t, 1.6, 2.0, 0.8, 3.0, DUR)
    v += pad(t, root * 1.5) * 0.05 * env(t, 2.4, 2.0, 0.7, 3.0, DUR)

    # the figure, every 0.75s, resting through the last scene
    if t < 20.6:
        step = int(t / 0.75)
        for k in range(step - 2, step + 1):
            if k < 0: continue
            onset = k * 0.75
            if onset < 0.9: continue
            f = SCALE[FIG[k % len(FIG)]] * (2 if (k // len(FIG)) % 2 else 1)
            v += pluck(t - onset, f) * 0.075

    # a mallet on each cut, and one last one on the end card
    for c in CUTS:
        v += mallet(t - c, A * 2) * 0.05
    v += mallet(t - 21.2, A * 3) * 0.04

    # air
    v *= 0.85
    samples.append(max(-1.0, min(1.0, v)))

# Normalise. Written straight out, the mix peaked at 0.15, which is about
# 29 dB below full scale: audible only if the listener turns everything up.
peak = max(abs(s) for s in samples) or 1.0
gain = 0.89 / peak
samples = [s * gain for s in samples]

# a short fade at both ends so nothing clicks
fade = int(SR * 0.35)
for i in range(fade):
    samples[i] *= i / fade
    samples[-1 - i] *= i / fade

with wave.open("score.wav", "w") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(b"".join(struct.pack("<h", int(s * 32767 * 0.9)) for s in samples))
print("score.wav", round(DUR, 1), "s")
