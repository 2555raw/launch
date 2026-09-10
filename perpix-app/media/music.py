"""Synthesises the backing track.

The requested track could not be used: this session cannot reach YouTube, and
pulling audio off it to redistribute is not something to do on a claim of "no
copyright" that cannot be verified from here. So the track is generated, which
at least makes it unambiguously clear to use.

Harder than the first one, because the cut is harder: 140 BPM, a clipped kick, a
distorted saw bass on sixteenths, an offbeat clap, and a snare roll into the
drop. Original, royalty-free. Dropping a licensed .wav in its place and re-running
finish.py is a one-file swap; the beat grid in edit.py assumes this tempo."""
import wave, struct, math, random

SR = 44100
BPM = 140
BEAT = 60.0 / BPM
BAR = BEAT * 4
BARS = 26
TOTAL = int(SR * BAR * BARS)
buf = [0.0] * TOTAL
random.seed(11)

def add(at, samples, gain=1.0):
    i = int(at * SR)
    for k, v in enumerate(samples):
        j = i + k
        if 0 <= j < TOTAL:
            buf[j] += v * gain

def decay(n, power=2.0):
    return [max(0.0, 1 - k / n) ** power for k in range(n)]

def kick(dur=0.30):
    """Pitch sweep plus a click, then clipped: the click is what carries on
    small speakers, the sweep is what carries on big ones."""
    n = int(SR * dur); e = decay(n, 1.7); out = []
    for k in range(n):
        t = k / SR
        f = 190 * math.exp(-13.0 * t) + 44
        body = math.sin(2 * math.pi * f * t)
        click = math.sin(2 * math.pi * 1400 * t) * math.exp(-260 * t) * 0.5
        out.append(math.tanh((body + click) * 2.4) * e[k])
    return out

def hat(dur=0.04, tone=1.0):
    n = int(SR * dur); e = decay(n, 3.0); prev = 0.0; out = []
    for k in range(n):
        x = random.uniform(-1, 1)
        hp = x - prev * 0.92; prev = x
        out.append(hp * e[k] * tone)
    return out

def clap(dur=0.19):
    n = int(SR * dur); out = [0.0] * n
    for off in (0, 0.008, 0.017):          # three bursts: that is what a clap is
        s = int(off * SR)
        e = decay(n - s, 2.6)
        for k in range(n - s):
            out[s + k] += random.uniform(-1, 1) * e[k] * 0.5
    prev = 0.0
    for k in range(n):                      # thin it out so it cuts through
        v = out[k]; out[k] = v - prev * 0.6; prev = v
    return out

def snare(dur=0.13, tone=1.0):
    n = int(SR * dur); e = decay(n, 2.2)
    return [(random.uniform(-1, 1) * 0.75 + math.sin(2 * math.pi * 210 * k / SR) * 0.4) * e[k] * tone
            for k in range(n)]

def saw(f, t):
    v = 0.0
    for h in range(1, 11):
        if f * h > SR / 2.2: break
        v += math.sin(2 * math.pi * f * h * t) / h
    return v * 0.55

def bass(f, dur, drive=3.2):
    n = int(SR * dur); e = decay(n, 1.1)
    return [math.tanh((math.sin(2 * math.pi * f * k / SR) * 0.8 + saw(f, k / SR) * 0.6) * drive) * e[k] * 0.55
            for k in range(n)]

def stab(f, dur):
    """A short bright chord hit, for the top of a bar."""
    n = int(SR * dur); e = decay(n, 2.4)
    return [(saw(f, k / SR) + saw(f * 1.5, k / SR) * 0.6 + saw(f * 2, k / SR) * 0.35) * e[k] * 0.3
            for k in range(n)]

NOTE = lambda m: 440.0 * 2 ** ((m - 69) / 12.0)
# F minor, four bars: i - VI - III - VII, the same shape but darker than before
PROG = [41, 37, 44, 39]
SIXTEENTH = [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1]   # bass pattern

for b in range(BARS):
    bar = b * BAR
    root = PROG[b % 4]
    intro = b < 2
    build = 2 <= b < 4
    drop = b >= 4
    for beat in range(4):
        t = bar + beat * BEAT
        if not intro:
            add(t, kick(), 1.0)
        if drop:
            add(t + BEAT * 0.5, clap(), 0.30)
            for s in range(4):              # sixteenth hats, accented off the beat
                add(t + s * BEAT / 4, hat(tone=0.7 if s % 2 else 0.35), 0.20)
        elif build:
            add(t + BEAT * 0.5, hat(tone=0.5), 0.16)
    # bass on sixteenths
    if not intro:
        for i, on in enumerate(SIXTEENTH):
            if on:
                add(bar + i * BEAT / 4, bass(NOTE(root - 12), BEAT / 4 * 1.05), 0.40)
    # a stab on the downbeat, and one pushed late in the bar
    if drop:
        for n in (root + 12, root + 15, root + 19):
            add(bar, stab(NOTE(n), BEAT * 0.7), 0.16)
            add(bar + BEAT * 2.75, stab(NOTE(n), BEAT * 0.35), 0.11)

# snare roll through the bar before the drop: sixteenths, then thirty-seconds
roll_start = 3 * BAR
step = BEAT / 4
k = 0; t = roll_start
while t < roll_start + BAR:
    frac = (t - roll_start) / BAR
    add(t, snare(0.10, 0.5 + frac * 0.9), 0.34)
    t += step * (1.0 if frac < 0.5 else 0.5)
    k += 1

# and one hit of silence right before the drop, which is what makes a drop land
gap_from = int((4 * BAR - BEAT * 0.28) * SR)
for i in range(gap_from, int(4 * BAR * SR)):
    if i < TOTAL: buf[i] *= 0.06

peak = max(abs(v) for v in buf) or 1.0
scale = 1.0 / peak
frames = bytearray()
for v in buf:
    x = math.tanh(v * scale * 1.9) * 0.9
    frames += struct.pack('<h', int(max(-1, min(1, x)) * 32767))

with wave.open('music.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(bytes(frames))
print(f'music.wav  {TOTAL / SR:.1f}s  {BPM} BPM  beat {BEAT:.4f}s  bar {BAR:.4f}s  drop at {4 * BAR:.2f}s')
