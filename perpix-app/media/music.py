"""Synthesises the backing track.

I cannot license a song from here, and shipping someone else's would be worse
than useless, so the track is generated: 124 BPM, a four-on-the-floor kick, an
offbeat hat, a plucked bass and an arpeggio over a i-VI-III-VII loop in A minor.
Original, royalty-free, and swappable in one ffmpeg command.

Everything is plain stdlib: no numpy here."""
import wave, struct, math, random

SR = 44100
BPM = 124
BEAT = 60.0 / BPM
BARS = 30                      # comfortably longer than the edit
TOTAL = int(SR * BEAT * 4 * BARS)
buf = [0.0] * TOTAL
random.seed(7)

def add(at, samples, gain=1.0):
    i = int(at * SR)
    for k, v in enumerate(samples):
        j = i + k
        if 0 <= j < TOTAL:
            buf[j] += v * gain

def env(n, a, d, s=0.0, sl=1.0):
    """Attack/decay/sustain envelope, in samples."""
    out = []
    for k in range(n):
        if k < a:      out.append(k / max(a, 1))
        elif k < a + d: out.append(1 - (1 - sl) * ((k - a) / max(d, 1)))
        else:           out.append(sl * max(0.0, 1 - (k - a - d) / max(n - a - d, 1)))
    return out

def kick(dur=0.22):
    n = int(SR * dur); e = env(n, 40, n - 40)
    return [math.sin(2 * math.pi * (145 * math.exp(-9.0 * k / SR)) * k / SR) * e[k] ** 1.8 for k in range(n)]

def hat(dur=0.055, bright=1.0):
    n = int(SR * dur); e = env(n, 12, n - 12)
    prev = 0.0; out = []
    for k in range(n):                        # noise through a crude high-pass
        x = random.uniform(-1, 1)
        hp = x - prev; prev = x
        out.append(hp * e[k] ** 2.2 * bright)
    return out

def snare(dur=0.16):
    n = int(SR * dur); e = env(n, 20, n - 20); out = []
    for k in range(n):
        t = k / SR
        out.append((random.uniform(-1, 1) * 0.7 + math.sin(2 * math.pi * 185 * t) * 0.5) * e[k] ** 1.6)
    return out

def saw(f, t):
    """Band-limited-ish saw: a few harmonics, so it does not alias into mush."""
    v = 0.0
    for h in range(1, 9):
        if f * h > SR / 2.2: break
        v += math.sin(2 * math.pi * f * h * t) / h
    return v * 0.55

def bass(f, dur):
    n = int(SR * dur); e = env(n, 60, int(SR * 0.06), 0, 0.65)
    return [(math.sin(2 * math.pi * f * k / SR) * 0.75 + saw(f, k / SR) * 0.25) * e[k] for k in range(n)]

def pluck(f, dur):
    n = int(SR * dur); e = env(n, 24, n - 24)
    return [saw(f, k / SR) * e[k] ** 1.4 for k in range(n)]

def pad(f, dur):
    n = int(SR * dur); e = env(n, int(SR * 0.25), int(SR * 0.1), 0, 0.8)
    return [(math.sin(2 * math.pi * f * k / SR) + math.sin(2 * math.pi * f * 1.5 * k / SR) * 0.4) * e[k] * 0.5
            for k in range(n)]

NOTE = lambda n: 440.0 * 2 ** ((n - 69) / 12.0)      # midi to hertz
# A minor: Am - F - C - G, one bar each
PROG = [(57, [69, 72, 76]), (53, [65, 69, 72]), (60, [67, 72, 76]), (55, [67, 71, 74])]
ARP = [0, 1, 2, 1, 2, 1, 0, 2]

for b in range(BARS):
    bar = b * 4 * BEAT
    root, chord = PROG[b % 4]
    intro = b < 2                     # first two bars come in bare
    drop = b >= 6                     # the beat opens up here
    for beat in range(4):
        t = bar + beat * BEAT
        if not intro:
            add(t, kick(), 0.95)
            add(t + BEAT / 2, hat(bright=0.55), 0.32)
            if drop:
                add(t + BEAT / 4, hat(0.035, 0.4), 0.16)
                add(t + BEAT * 0.75, hat(0.04, 0.5), 0.2)
        if drop and beat in (1, 3):
            add(t, snare(), 0.34)
        # bass on every beat, an octave under the chord root
        if not intro:
            add(t, bass(NOTE(root - 12), BEAT * 0.9), 0.42)
    # arpeggio in eighths
    for i, step in enumerate(ARP):
        if intro and i % 2: continue
        add(bar + i * BEAT / 2, pluck(NOTE(chord[step]), BEAT * 0.45), 0.20 if drop else 0.13)
    # a pad holding the chord under everything
    for n in chord:
        add(bar, pad(NOTE(n - 12), BEAT * 4), 0.055)

# a short riser into the drop
rn = int(SR * BEAT * 4)
start = 4 * 4 * BEAT
for k in range(rn):
    t = k / SR
    f = 220 + 700 * (k / rn) ** 2
    g = 0.16 * (k / rn) ** 2
    buf[int(start * SR) + k] += math.sin(2 * math.pi * f * t) * g

# soft-clip, then normalise: keeps the peaks from squaring off
peak = max(abs(v) for v in buf) or 1.0
scale = 1.0 / peak
frames = bytearray()
for v in buf:
    x = math.tanh(v * scale * 1.6) * 0.89
    frames += struct.pack('<h', int(max(-1, min(1, x)) * 32767))

with wave.open('music.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(bytes(frames))
print(f'music.wav  {TOTAL / SR:.1f}s  {BPM} BPM  bar = {BEAT * 4:.3f}s')
