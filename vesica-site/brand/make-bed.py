"""Vesica — the reel's backing bed, synthesised rather than licensed.

Thirty-one seconds of Am · F · C · G, one chord every seven and a half: a
detuned sine pad, a soft tone every three quarters of a second picked out of
the chord above it, a whisper of filtered noise so the sines do not sound
like a test signal, and three delayed copies standing in for a room. It sits
at about -15 dBFS so it stays under the picture.

It is a bed, not a track. If you license something better, swap the file:

    python3 make-bed.py
    ffmpeg -i vid/*.webm -i bed.wav ... -c:a aac -b:a 160k -shortest out.mp4
"""
import numpy as np, wave

SR, DUR = 44100, 31.0
n = int(SR * DUR)
t = np.arange(n) / SR

CHORDS = [(220.00, 261.63, 329.63),   # Am
          (174.61, 220.00, 261.63),   # F
          (130.81, 164.81, 196.00),   # C
          (196.00, 246.94, 293.66)]   # G
BAR = DUR / len(CHORDS)

def pad():
    out = np.zeros(n)
    for i, ch in enumerate(CHORDS):
        s, e = i * BAR, (i + 1) * BAR
        env = np.clip((t - (s - .9)) / 1.4, 0, 1) * np.clip(((e + .9) - t) / 1.4, 0, 1)
        env = np.sin(env * np.pi / 2) ** 2          # one chord walks into the next
        for j, f in enumerate(ch):
            for det, gain in ((1.000, .55), (1.004, .30), (0.997, .26)):
                out += env * gain * np.sin(2 * np.pi * f * det * t + j * 1.7) / (2.4 + j * .8)
        out += env * .16 * np.sin(2 * np.pi * (ch[0] / 2) * t)
    return out

def bells():
    out = np.zeros(n); step = .75
    rng = np.random.default_rng(7); k = 0
    while k * step < DUR - 1:
        at = k * step
        ch = CHORDS[min(int(at / BAR), len(CHORDS) - 1)]
        f = ch[rng.integers(0, 3)] * (2 if k % 4 in (1, 3) else 4)
        i0, ln = int(at * SR), int(1.5 * SR)
        ln = min(ln, n - i0)
        tt = np.arange(ln) / SR
        env = np.exp(-tt * 3.1) * (1 - np.exp(-tt * 260))
        out[i0:i0 + ln] += env * (np.sin(2*np.pi*f*tt) * .55 + np.sin(2*np.pi*f*2*tt) * .16) \
                           * (.30 if k % 4 == 0 else .17)
        k += 1
    return out

def air():
    x = np.random.default_rng(3).normal(0, 1, n)
    for _ in range(6):
        x = np.convolve(x, np.ones(220) / 220, mode='same')
    return x / (np.abs(x).max() + 1e-9) * .035

mix = pad() * .30 + bells() * .34 + air()
for delay, g in ((.085, .26), (.170, .14), (.310, .07)):     # a room, cheaply
    dsamp = int(delay * SR)
    mix[dsamp:] += mix[:-dsamp] * g

mix /= np.abs(mix).max() + 1e-9
mix *= .72
fi, fo = int(1.6 * SR), int(3.2 * SR)
mix[:fi] *= np.linspace(0, 1, fi) ** 1.6
mix[-fo:] *= np.linspace(1, 0, fo) ** 1.4

st = np.stack([mix, np.roll(mix, 320)], axis=1)              # a hair of width
st /= np.abs(st).max() + 1e-9
st *= .70

with wave.open('bed.wav', 'w') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((st * 32767).astype('<i2').tobytes())
print('bed.wav written')
