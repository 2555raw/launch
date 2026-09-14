#!/usr/bin/env python3
"""Writes the film's soundtrack.

    python3 video/music.py out.wav [seconds]

An original piece, synthesised here rather than sampled: nothing in it is
licensed from anyone.

D minor at 150 BPM, which is still 0.4s a beat and still exactly twelve frames
at 30fps, because the cut is counted in beats and the tempo is not free. The
arrangement is half time against that grid: the kick lands on one and on the
back half of three rather than on every beat, so the picture cuts twice for
every step the floor takes. The voices are a sub, a glass bell run through FM,
and a slow pad, with a noise swell at each place the arrangement changes.
"""

import math
import sys
import wave

import numpy as np

SR = 44100
BPM = 150.0            # 0.4s a beat, which is exactly 12 frames at 30fps
BEAT = 60.0 / BPM
BAR = BEAT * 4


def env(n, attack, decay, sustain=0.0, release=0.0):
    """A plain ADSR over n samples."""
    a = min(int(attack * SR), n)
    d = min(int(decay * SR), n - a)
    r = min(int(release * SR), n - a - d)
    out = np.zeros(n)
    if a:
        out[:a] = np.linspace(0, 1, a, endpoint=False)
    if d:
        out[a:a + d] = np.linspace(1, sustain, d, endpoint=False)
    s = n - a - d - r
    if s > 0:
        out[a + d:a + d + s] = sustain
    if r:
        out[n - r:] = np.linspace(sustain, 0, r)
    return out


def lowpass(x, cutoff):
    """One pole lowpass. The recursion is unrolled through a geometric window
    rather than a Python loop, because at 44.1kHz the loop is the whole runtime
    of this file."""
    a = math.exp(-2 * math.pi * cutoff / SR)
    if a < 1e-6:
        return x.copy()
    taps = min(len(x), int(math.ceil(-9.0 / math.log(a))) + 1)
    k = (1 - a) * a ** np.arange(taps)
    return np.convolve(x, k)[: len(x)]


def highpass(x, cutoff):
    return x - lowpass(x, cutoff)


def add(buf, sig, at):
    i = int(at * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i]


# ---- voices -----------------------------------------------------------------

def kick(at, buf, gain=1.0):
    """Long and soft rather than clicky. It has to carry a bar on its own."""
    n = int(0.60 * SR)
    t = np.arange(n) / SR
    pitch = 96 * np.exp(-t * 26) + 38
    body = np.sin(2 * np.pi * np.cumsum(pitch) / SR)
    add(buf, body * np.exp(-t * 5.0) * 0.95 * gain, at)


def clap(at, buf, gain=0.30):
    """Three noise bursts a few milliseconds apart, then a tail."""
    out = np.zeros(int(0.34 * SR))
    for k, off in enumerate((0.0, 0.009, 0.019)):
        i = int(off * SR)
        n = len(out) - i
        t = np.arange(n) / SR
        out[i:] += np.random.uniform(-1, 1, n) * np.exp(-t * (150 - k * 30))
    t = np.arange(len(out)) / SR
    out += np.random.uniform(-1, 1, len(out)) * np.exp(-t * 14) * 0.30
    add(buf, highpass(out, 900) * gain, at)


def shaker(at, buf, gain=0.16):
    n = int(0.07 * SR)
    t = np.arange(n) / SR
    noise = highpass(np.random.uniform(-1, 1, n), 5200)
    add(buf, noise * np.exp(-t * 70) * gain, at)


def sub(note, at, dur, buf, gain=0.50):
    """A sine with a little drive on it, and nothing above 120Hz."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * note * t + 0.6 * np.sin(2 * np.pi * note * t))
    tone = lowpass(tone, 120)
    add(buf, tone * env(n, 0.012, 0, 1.0, dur * 0.30) * gain, at)


def bell(note, at, dur, buf, gain=0.16):
    """Two operator FM. The modulator decays faster than the carrier, which is
    what makes it strike and then ring instead of just sounding."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    mod = np.sin(2 * np.pi * note * 2.01 * t) * np.exp(-t * 11) * 3.1
    tone = np.sin(2 * np.pi * note * t + mod)
    add(buf, tone * np.exp(-t * 3.4) * gain, at)


def pad(root, at, dur, buf, gain=0.13):
    """Triangles rather than saws: the same body without the fizz on top."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    voices = np.zeros(n)
    for mult, det in ((1, 0.0), (1, 0.0035), (1.5, -0.003), (2, 0.002),
                      (3, 0.004), (4, -0.002)):
        f = root * mult * (1 + det)
        tri = 2 / np.pi * np.arcsin(np.sin(2 * np.pi * f * t))
        voices += tri / mult
    sweep = lowpass(voices / 4.0, 520 + 380 * math.sin(at * 0.35))
    add(buf, sweep * env(n, dur * 0.40, 0, 1.0, dur * 0.50) * gain, at)


def swell(at, dur, buf, gain=0.13):
    """Filtered noise rising into a change."""
    n = int(dur * SR)
    noise = lowpass(np.random.uniform(-1, 1, n), 1400)
    ramp = np.linspace(0, 1, n) ** 2.4
    add(buf, noise * ramp * gain, at)


# ---- the piece --------------------------------------------------------------
# D minor, i - VI - III - VII, one chord a bar.
ROOTS = [36.71, 43.65, 29.14, 32.70]        # D1, F1, D1 an octave under Bb, C1
CHORDS = [73.42, 87.31, 58.27, 65.41]       # D2, F2, Bb1, C2
# D minor pentatonic, high enough that the bell never fights the sub.
FIGURE = [587.33, 880.00, 698.46, 1174.66, 880.00, 698.46]


def render(seconds):
    n = int(seconds * SR)
    buf = np.zeros(n + SR)
    bars = int(seconds / BAR) + 2

    for b in range(bars):
        t0 = b * BAR
        if t0 > seconds:
            break
        c = b % 4

        pad(CHORDS[c], t0, BAR * 1.04, buf, 0.09 if b < 2 else 0.13)

        if b in (3, 7, 11):                       # into each new section
            swell(t0 + BAR * 0.5, BAR * 0.5, buf)

        if b >= 1:                                 # shaker, offbeat sixteenths
            for e in range(8):
                if e % 4 == 0:
                    continue
                shaker(t0 + e * BEAT / 2 + BEAT * 0.12, buf,
                       0.17 if e % 2 else 0.11)

        if b >= 2:                                 # half time floor
            kick(t0, buf, 1.0)
            kick(t0 + BEAT * 2.5, buf, 0.80)
            clap(t0 + BEAT * 2, buf)
            if b % 4 == 3:
                kick(t0 + BEAT * 3.5, buf, 0.62)

        if b >= 2:                                 # the sub follows the chord
            sub(ROOTS[c], t0, BEAT * 1.9, buf)
            sub(ROOTS[c], t0 + BEAT * 2.5, BEAT * 1.4, buf, 0.42)

        if b >= 4:                                 # the bell figure on top
            for i, note in enumerate(FIGURE):
                if b % 4 == 3 and i % 2:
                    continue                       # thin it every fourth bar
                bell(note, t0 + i * BEAT * 0.75, BEAT * 2.4, buf,
                     0.15 if i else 0.18)

    out = buf[:n]

    # one echo of the whole top end, in time, for depth without a reverb
    tail = np.zeros(n)
    d = int(BEAT * 1.5 * SR)
    tail[d:] = highpass(out, 700)[:n - d] * 0.26
    out = out + tail

    # duck on each kick so the low end stays clean under the pad
    duck = np.ones(n)
    for b in range(bars):
        for off in (0.0, BEAT * 2.5):
            at = int((b * BAR + off) * SR)
            if 0 <= at < n:
                m = min(int(0.22 * SR), n - at)
                duck[at:at + m] *= np.linspace(0.66, 1.0, m)
    out *= duck

    out *= env(n, 1.1, 0, 1.0, 2.8)                # fade in, fade out
    peak = np.max(np.abs(out)) or 1.0
    out = np.tanh(out / peak * 1.3) * 0.86         # gentle limiting

    stereo = np.stack([out, np.roll(out, 300)], axis=1)   # a little width
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
