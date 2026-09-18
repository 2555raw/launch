"""A second, slower piece — for the horizontal cut.

    python3 scripts/video/score2.py          # writes score2.wav

The long film's score is 125 BPM in A minor and built to carry hard cuts. This
one is 100 BPM in D minor and built to sit under slow ones: a beat every 0.6s,
a bar every 2.4s, and six bars exactly, so the picture and the music end on the
same frame rather than one of them being faded out.

Different in character on purpose — warmer, mallets instead of a pluck, no
whooshes at all. The lesson from the first one was that a transition on every
cut leaves a track with nowhere to be.
"""
import numpy as np, wave, os

SR = 44100
BPM = 100.0
BEAT = 60.0 / BPM              # 0.6
BAR = BEAT * 4                 # 2.4
DUR = BAR * 6                  # 14.4 — the exact length of the picture
N = int(DUR * SR)
L = np.zeros(N); R = np.zeros(N)
PL = np.zeros(N); PR = np.zeros(N)     # the sustained bus, ducked under the kick
KICKS = []
rng = np.random.default_rng(11)

def add(buf, t, sig, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N: return
    s = sig[:N - i]
    buf[i:i + len(s)] += s * gain * (np.sqrt((1 - pan) / 2) * 1.414 if buf is L
                                     else np.sqrt((1 + pan) / 2) * 1.414)

def sine(f, n, ph=0.0): return np.sin(2*np.pi*f*np.arange(n)/SR + ph)

def lp(x, f):
    a = np.exp(-2*np.pi*f/SR); y = np.empty_like(x); acc = 0.0
    for i in range(len(x)):
        acc = (1-a)*x[i] + a*acc; y[i] = acc
    return y
def hp(x, f): return x - lp(x, f)

def kick(g=1.0):
    n = int(0.5*SR); t = np.arange(n)/SR
    f = 44 + 96*np.exp(-t*28)
    body = np.sin(2*np.pi*np.cumsum(f)/SR) * np.exp(-t*6.0)
    return np.tanh(body*1.4) * 0.85 * g

def sub(f, beats, g=1.0):
    n = int(beats*BEAT*SR); t = np.arange(n)/SR
    e = np.minimum(t/0.03, 1) * np.exp(-t*0.5)
    return sine(f, n) * e * g

def mallet(f, g=1.0):
    """A struck tone rather than a plucked one: a couple of inharmonic partials
    over a fast decay, which is what makes it read as wood or glass."""
    n = int(1.4*SR); t = np.arange(n)/SR
    x = (sine(f, n) + .5*sine(f*2.01, n) + .22*sine(f*3.03, n) + .1*sine(f*4.7, n))
    return x * np.exp(-t*3.4) * 0.38 * g

def pad(freqs, seconds, g=1.0, cut=2100):
    n = int(seconds*SR); t = np.arange(n)/SR
    x = np.zeros(n)
    for f in freqs:
        for d in (-0.12, 0.0, 0.13):
            x += sine(f*(1+d/100), n, rng.random()*6.28)
    x /= len(freqs)*3
    e = np.minimum(t/1.1, 1) * np.minimum((seconds-t)/1.1, 1).clip(0, 1)
    return lp(x, cut) * e * 0.62 * g

def shaker(g=1.0):
    n = int(0.09*SR); t = np.arange(n)/SR
    return lp(hp(rng.normal(0, 1, n), 4200), 8500) * np.exp(-t*42) * 0.09 * g

# Dm - Bb - F - C - Gm - Dm, one per bar, so the harmony turns with the picture
ROOT  = {"Dm": 73.42, "Bb": 58.27, "F": 87.31, "C": 65.41, "Gm": 98.00}
TRIAD = {"Dm": [293.66, 349.23, 440.00], "Bb": [233.08, 293.66, 349.23],
         "F":  [261.63, 349.23, 440.00], "C":  [261.63, 329.63, 392.00],
         "Gm": [293.66, 349.23, 466.16]}
PROG = ["Dm", "Bb", "F", "C", "Gm", "Dm"]

for i, ch in enumerate(PROG):
    t = i * BAR
    g = 0.55 if i == 0 else (0.95 if i >= 4 else 0.8)
    p = pad(TRIAD[ch], BAR + 0.35, g)
    add(PL, t, p, 0.5, -0.3); add(PR, t, p, 0.5, 0.3)
    sb = sub(ROOT[ch], (BAR + 0.2)/BEAT, 0.42 if i else 0.22)
    add(PL, t, sb); add(PR, t, sb)

# drums: nothing in the first bar, then a slow half-time pulse
b = 0.0
while b < DUR:
    i = round(b/BEAT)
    if b >= BAR:
        if i % 2 == 0:
            add(L, b, kick(.85 if b >= BAR*2 else .6)); add(R, b, kick(.85 if b >= BAR*2 else .6))
            KICKS.append(b)
        if b >= BAR*2 and i % 4 == 2:
            s = shaker(1.0); add(L, b, s, 1, .35); add(R, b, s, 1, -.35)
        if b >= BAR*3:
            s = shaker(.7); add(L, b + BEAT/2, s, 1, -.35); add(R, b + BEAT/2, s, 1, .35)
    b += BEAT

# the melody: five notes across the whole thing, not one per beat
SCALE = {"D4": 293.66, "F4": 349.23, "G4": 392.00, "A4": 440.00, "C5": 523.25, "D5": 587.33}
for t, note, g in [(BAR*1, "A4", .9), (BAR*1 + BEAT*2, "F4", .7),
                   (BAR*2, "D5", 1.0), (BAR*2 + BEAT*3, "C5", .7),
                   (BAR*3, "A4", .9), (BAR*3 + BEAT*2, "G4", .7),
                   (BAR*4, "D5", 1.0), (BAR*4 + BEAT*2, "C5", .8),
                   (BAR*5, "D4", .9)]:
    m = mallet(SCALE[note], g)
    add(L, t, m, 1, -.2); add(R, t, m, 1, .2)

# the pad steps out of the kick's way; it is the only reason a mix this plain breathes
duck = np.ones(N)
rec = np.linspace(0.35, 1.0, int(BEAT*0.95*SR)) ** 0.7
for k in KICKS:
    i = int(k*SR); seg = rec[:N-i]
    duck[i:i+len(seg)] = np.minimum(duck[i:i+len(seg)], seg)
L += PL*duck; R += PR*duck

def finish(x):
    x = hp(x, 26)
    p = np.abs(x).max()
    if p > 0: x = x/p * 0.9
    x = np.tanh(x*1.12)/np.tanh(1.12)
    f = int(0.03*SR); x[:f] *= np.linspace(0, 1, f)
    f = int(0.5*SR);  x[-f:] *= np.linspace(1, 0, f)
    return x

L, R = finish(L), finish(R)
inter = np.empty(N*2); inter[0::2] = L; inter[1::2] = R
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "score2.wav")
with wave.open(out, "w") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(inter, -1, 1)*32767).astype("<i2").tobytes())
print(f"{out}  {DUR:.2f}s  peak {np.abs(inter).max():.3f}  rms {np.sqrt((inter**2).mean()):.3f}")
