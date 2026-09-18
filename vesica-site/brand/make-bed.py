"""Vesica — the reel's backing bed, synthesised rather than licensed.

Twenty-four seconds at 100 BPM: Dm, Bb, F, C twice round, three seconds a
chord. A warm pad holds the chord, a plucked arpeggio runs eighth notes
through it, a soft low pulse marks the beat and a filtered-noise shaker sits
on the off-beats. The parts enter one at a time over the first four seconds
and drop away over the last three, so the piece has a shape rather than just
a length. It sits around -15 dBFS to stay under the picture.

It is a bed, not a track. If you license something better, swap the file:

    python3 make-bed.py
    ffmpeg -i vid2/*.webm -i bed.wav -t 23.7 ... -c:a aac -b:a 160k -shortest out.mp4
"""
import numpy as np, wave

SR, DUR, BPM = 44100, 24.0, 100.0
BEAT = 60.0 / BPM
n = int(SR * DUR)
t = np.arange(n) / SR

CHORDS = [(293.66, 349.23, 440.00),   # Dm
          (233.08, 293.66, 349.23),   # Bb
          (174.61, 220.00, 261.63),   # F
          (261.63, 329.63, 392.00)] * 2
BAR = DUR / len(CHORDS)

def add(buf, at, wave_, gain=1.0):
    i0 = int(at * SR)
    ln = min(len(wave_), n - i0)
    if ln > 0: buf[i0:i0 + ln] += wave_[:ln] * gain

def fade(x, a, b):
    """Bring a part in over `a` seconds and take it out over the last `b`."""
    e = np.ones(n)
    ia, ib = int(a * SR), int(b * SR)
    if ia: e[:ia] = np.linspace(0, 1, ia) ** 1.5
    if ib: e[-ib:] = np.linspace(1, 0, ib) ** 1.3
    return x * e

def pad():
    out = np.zeros(n)
    for i, ch in enumerate(CHORDS):
        s, e = i * BAR, (i + 1) * BAR
        env = np.clip((t - (s - .5)) / .8, 0, 1) * np.clip(((e + .5) - t) / .8, 0, 1)
        env = np.sin(env * np.pi / 2) ** 2
        for j, f in enumerate(ch):
            for det, g in ((1.000, .52), (1.005, .28), (0.996, .24)):
                out += env * g * np.sin(2 * np.pi * f * det * t / 2 + j * 1.4) / (2.6 + j * .7)
    return out

def pluck():
    """Eighth notes up and down the chord — this is what carries the pace."""
    out = np.zeros(n)
    step = BEAT / 2
    k = 0
    shape = [0, 1, 2, 1]
    while k * step < DUR - .4:
        at = k * step
        ch = CHORDS[min(int(at / BAR), len(CHORDS) - 1)]
        f = ch[shape[k % 4]] * (2 if (k // 4) % 2 else 1)
        ln = int(.85 * SR)
        tt = np.arange(ln) / SR
        env = np.exp(-tt * 6.5) * (1 - np.exp(-tt * 420))
        v = env * (np.sin(2*np.pi*f*tt) * .62 + np.sin(2*np.pi*f*2*tt) * .20
                   + np.sin(2*np.pi*f*3*tt) * .07)
        add(out, at, v, .30 if k % 4 == 0 else .18)
        k += 1
    return out

def pulse():
    out = np.zeros(n)
    k = 0
    while k * BEAT < DUR - .3:
        ln = int(.42 * SR)
        tt = np.arange(ln) / SR
        f = 58 * np.exp(-tt * 26) + 40                 # a short drop, not a click
        v = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9)
        add(out, k * BEAT, v, .55 if k % 4 == 0 else .34)
        k += 1
    return out

def shaker():
    out = np.zeros(n)
    rng = np.random.default_rng(19)
    k = 0
    while k * BEAT + BEAT / 2 < DUR - .2:
        ln = int(.12 * SR)
        x = rng.normal(0, 1, ln)
        for _ in range(2):                              # take the rumble out
            x = x - np.convolve(x, np.ones(60) / 60, mode='same')
        add(out, k * BEAT + BEAT / 2, x * np.exp(-np.arange(ln) / SR * 42), .05)
        k += 1
    return out

mix = (fade(pad(), 0.9, 3.0) * .34
     + fade(pluck(), 2.0, 2.6) * .40
     + fade(pulse(), 3.6, 2.2) * .30
     + fade(shaker(), 4.4, 2.0) * .55)

for delay, g in ((.075, .24), (.150, .13), (.290, .06)):     # a room, cheaply
    dsamp = int(delay * SR)
    mix[dsamp:] += mix[:-dsamp] * g

mix /= np.abs(mix).max() + 1e-9
mix *= .74
fo = int(2.6 * SR)
mix[-fo:] *= np.linspace(1, 0, fo) ** 1.2

st = np.stack([mix, np.roll(mix, 300)], axis=1)              # a hair of width
st /= np.abs(st).max() + 1e-9
st *= .72

with wave.open('bed.wav', 'w') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((st * 32767).astype('<i2').tobytes())
print('bed.wav written', DUR, 's at', BPM, 'BPM')
