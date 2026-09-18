"""The film's own music, synthesised rather than borrowed.

    python3 scripts/video/score.py            # writes score.wav

The reference's track is somebody else's, so this is built from scratch to the
same skeleton: 125 BPM (a beat every 0.48s, a bar every 1.92s), 46.47s long,
and arranged so its sections turn where the film cuts —

    2.37  5.27  7.87  10.23  11.70  15.00  28.87  30.20  32.03  33.53  35.03

The long shot at 20.50 gets a breakdown with the drums pulled out, because the
picture goes quiet there and music that keeps hammering through it fights the
edit instead of carrying it.

Everything is a sine, a filtered noise burst or a sum of the two. No samples,
nothing lifted.
"""
import numpy as np, struct, wave, os

SR = 44100
BPM = 125.0
BEAT = 60.0 / BPM          # 0.48
BAR = BEAT * 4             # 1.92
DUR = 46.47
N = int(DUR * SR)
CUTS = [2.37, 5.27, 7.87, 10.23, 11.70, 15.00, 20.50, 28.87, 30.20, 32.03, 33.53, 35.03]
# A transition on all twelve put a whoosh and a bang across 48% of the running
# time: the track never settled because it was always going somewhere. Only the
# four places the film actually turns get one.
TURNS = [7.87, 20.50, 28.87, 35.03]

L = np.zeros(N); R = np.zeros(N)
# the sustained parts go to their own bus 
PL = np.zeros(N); PR = np.zeros(N)
KICKS = []
rng = np.random.default_rng(7)

def add(buf, t, sig, gain=1.0, pan=0.0):
    """Drop a signal in at t seconds, panned, clipped to the timeline."""
    i = int(t * SR)
    if i >= N: return
    s = sig[:N - i]
    lg = gain * np.sqrt((1 - pan) / 2) * 1.414
    rg = gain * np.sqrt((1 + pan) / 2) * 1.414
    L[i:i + len(s)] += s * lg
    R[i:i + len(s)] += s * rg

def env(n, a=0.002, d=0.1, s=0.0, r=0.05, hold=0.0):
    """A plain ADSR, long enough in the attack that nothing clicks."""
    a_n, h_n, d_n, r_n = int(a*SR), int(hold*SR), int(d*SR), int(r*SR)
    out = np.zeros(n)
    k = 0
    def seg(vals):
        nonlocal k
        m = min(len(vals), n - k)
        if m > 0: out[k:k+m] = vals[:m]; k += m
    seg(np.linspace(0, 1, max(a_n, 1)))
    seg(np.ones(h_n))
    seg(np.linspace(1, s, max(d_n, 1)))
    if k < n: out[k:] = s
    if r_n and n > r_n:
        out[-r_n:] *= np.linspace(1, 0, r_n)
    return out

def sine(f, n, phase=0.0):
    return np.sin(2*np.pi*f*np.arange(n)/SR + phase)

def lp(x, cutoff):
    """One-pole lowpass. Crude, and exactly the colour this needs."""
    a = np.exp(-2*np.pi*cutoff/SR)
    y = np.empty_like(x); acc = 0.0
    for i in range(len(x)):
        acc = (1-a)*x[i] + a*acc
        y[i] = acc
    return y

def hp(x, cutoff):
    return x - lp(x, cutoff)

# ---------------------------------------------------------------- instruments
def kick(gain=1.0):
    n = int(0.42*SR); t = np.arange(n)/SR
    f = 46 + 108*np.exp(-t*34)                      # the drop that makes it a kick
    body = np.sin(2*np.pi*np.cumsum(f)/SR) * np.exp(-t*7.5)
    click = hp(rng.normal(0, 1, n), 2600) * np.exp(-t*160) * 0.25
    return np.tanh((body + click) * 1.5) * 0.9 * gain

def sub(f, beats, gain=1.0):
    n = int(beats*BEAT*SR)
    return sine(f, n) * env(n, .012, beats*BEAT*.7, .55, .06) * gain

def clap(gain=1.0):
    n = int(0.3*SR); t = np.arange(n)/SR
    body = lp(hp(rng.normal(0, 1, n), 900), 6500)
    e = np.exp(-t*24) + 0.5*np.exp(-t*7)
    return body * e * 0.3 * gain

def hat(open_=False, gain=1.0):
    """Band-limited rather than bright: a hat hissing up at 7k and above was a
    fifth of the whole mix's energy, which is what made it sound like tape."""
    n = int((0.15 if open_ else 0.05)*SR); t = np.arange(n)/SR
    x = lp(hp(rng.normal(0, 1, n), 3800), 9000)
    return x * np.exp(-t*(18 if open_ else 70)) * 0.085 * gain

def pluck(f, beats=1.0, gain=1.0):
    n = int(beats*BEAT*SR); t = np.arange(n)/SR
    x = sine(f, n) + 0.35*sine(2*f, n) + 0.14*sine(3*f, n)
    return x * np.exp(-t*5.5) * env(n, .004, .02, 1, .03) * 0.3 * gain

def pad(freqs, seconds, gain=1.0, cut=1500):
    n = int(seconds*SR)
    x = np.zeros(n)
    for f in freqs:                                  # detuned, so it breathes
        for d in (-0.14, 0.0, 0.16):
            x += sine(f*(1+d/100), n, rng.random()*6.28)
    x /= len(freqs)*3
    # A long attack and an almost flat sustain, so consecutive chords cross
    # into each other instead of pumping once every two bars.
    return lp(x, cut) * env(n, .9, seconds*.35, .95, 1.1) * 0.55 * gain

def riser(seconds, gain=1.0):
    n = int(seconds*SR); t = np.arange(n)/SR
    x = rng.normal(0, 1, n)
    x = lp(hp(x, 500), 5200) * (t/seconds)**2
    return x * 0.12 * gain

def impact(gain=1.0):
    n = int(1.2*SR); t = np.arange(n)/SR
    boom = np.sin(2*np.pi*np.cumsum(38 + 40*np.exp(-t*12))/SR) * np.exp(-t*3.2)
    air = lp(rng.normal(0, 1, n), 1800) * np.exp(-t*4.5) * 0.3
    return (boom + air) * 0.55 * gain

# ------------------------------------------------------------------ arrangement
# Am - F - C - G, two bars each, which is eight bars round and about 15.4s.
ROOT = {"Am": 110.00, "F": 87.31, "C": 130.81, "G": 98.00}
TRIAD = {"Am": [220.00, 261.63, 329.63], "F": [174.61, 220.00, 261.63],
         "C": [261.63, 329.63, 392.00], "G": [196.00, 246.94, 293.66]}
PROG = ["Am", "F", "C", "G"]
SCALE = [440.00, 493.88, 523.25, 587.33, 659.25, 783.99, 880.00]

def section(t):
    """How loud and how busy the music is at t, following the picture."""
    if t < 2.37:  return "intro"
    if t < 7.87:  return "build"
    if t < 15.00: return "groove"
    if t < 20.50: return "full"
    if t < 28.87: return "break"      # the long calm shot
    if t < 35.03: return "rise"
    if t < 44.60: return "final"
    return "out"

# pads, one chord every two bars, all the way through
t = 0.0; ci = 0
while t < DUR:
    ch = PROG[ci % 4]
    secs = min(BAR*2, DUR - t)
    s = section(t)
    g = {"intro": .30, "build": .45, "groove": .62, "full": .70,
         "break": .82, "rise": .68, "final": .72, "out": .45}[s]
    cut = 520 if s in ("intro", "break") else 950
    add(None if False else L, 0, np.zeros(0))       # keep the helper honest
    p = pad(TRIAD[ch], secs, g, cut)
    add(PL, t, p, 0.5, -0.25); add(PR, t, p, 0.5, 0.25)
    # a sub under every chord
    sb = sub(ROOT[ch]/2, secs/BEAT,
             {"intro": .16, "build": .30, "groove": .48, "full": .55,
              "break": .18, "rise": .50, "final": .55, "out": .25}[s])
    add(PL, t, sb, 1.0); add(PR, t, sb, 1.0)
    t += secs; ci += 1

# drums
beat = 0.0
while beat < DUR:
    b = round(beat/BEAT)
    s = section(beat)
    if s not in ("intro", "break", "out"):
        if b % 2 == 0:
            add(L, beat, kick(.9), 1, 0); add(R, beat, kick(.9), 1, 0); KICKS.append(beat)
        if b % 4 == 2:
            c = clap(.9 if s in ("full", "final") else .6)
            add(L, beat, c, 1, -.15); add(R, beat, c, 1, .15)
        if s in ("groove", "full", "final", "rise") and b % 2 == 1:
            h = hat(b % 8 == 7)
            add(L, beat, h, 1, .3); add(R, beat, h, 1, -.3)
    elif s == "break" and b % 8 == 0:
        add(L, beat, kick(.45), 1, 0); add(R, beat, kick(.45), 1, 0); KICKS.append(beat)
    beat += BEAT

# a plucked line, one note per beat, sitting above everything
# A bar of eight half-beats; None is a rest, and most of them are rests. A note
# on every beat for forty-two seconds is a ringtone, not a melody.
PHRASE = [0, None, 2, None, None, 4, None, 2,
          None, 4, None, None, 5, None, 4, None]
beat, i = 7.87, 0
while beat < 44.0:
    s = section(beat)
    n = PHRASE[i % len(PHRASE)]
    if n is not None and s in ("groove", "full", "rise", "final"):
        g = {"groove": .5, "full": .55, "rise": .5, "final": .6}[s]
        pk = pluck(SCALE[n] / 2, 1.0, g)             # an octave down: less glassy
        add(L, beat, pk, 1, -.25 if i % 2 else .25)
        add(R, beat, pk, 1, .25 if i % 2 else -.25)
    beat += BEAT / 2; i += 1

# the cuts themselves: a riser into each one and something to land on
for c in TURNS:
    r = riser(0.7, .34)
    add(L, c - 0.7, r, 1, -.4); add(R, c - 0.7, r, 1, .4)
    im = impact(0.8)
    add(L, c, im, 1, 0); add(R, c, im, 1, 0)

# and the last one, on the end card
add(L, 46.07, impact(1.1), 1, 0); add(R, 46.07, impact(1.1), 1, 0)

# The pad and the sub are the loudest thing in the mix by duration, and without
# this they sit on top of the kick and the whole thing turns to porridge. Every
# kick pulls them down and lets them back up over a beat, which is the pump the
# genre runs on and the reason a mix this simple still breathes.
duck = np.ones(N)
recover = np.linspace(0.28, 1.0, int(BEAT * 0.9 * SR)) ** 0.6
for k in KICKS:
    i = int(k * SR)
    seg = recover[:N - i]
    duck[i:i + len(seg)] = np.minimum(duck[i:i + len(seg)], seg)
L += PL * duck; R += PR * duck

# ------------------------------------------------------------------- mastering
def finish(x):
    x = hp(x, 28)                                    # nothing useful lives below
    peak = np.abs(x).max()
    x = x / peak * 0.92 if peak > 0 else x
    x = np.tanh(x * 1.18) / np.tanh(1.18)            # gentle glue, no clipping
    n_fade = int(0.02*SR)
    x[:n_fade] *= np.linspace(0, 1, n_fade)
    x[-int(0.35*SR):] *= np.linspace(1, 0, int(0.35*SR))
    return x

L, R = finish(L), finish(R)
inter = np.empty(N*2); inter[0::2] = L; inter[1::2] = R
pcm = np.clip(inter, -1, 1)
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "score.wav")
with wave.open(out, "w") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((pcm * 32767).astype("<i2").tobytes())
print(f"{out}  {DUR:.2f}s  peak {np.abs(pcm).max():.3f}  rms {np.sqrt((pcm**2).mean()):.3f}")
