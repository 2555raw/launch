"""The voice-over, spoken by the machine that has the coordinates.

    python3 scripts/video/voice.py           # writes voice.wav and mix.wav

No neural voice is reachable from here, so this is espeak-ng, which is formant
synthesis: perfectly clear and unmistakably a computer. Rather than fight that,
it is treated as the point — band-limited like a radio link, pitched down a
little, with a short room on it, so it reads as the terminal reading out what
is on chain rather than as a person doing a bad job of sounding like one.

Every line is placed against the cut it belongs to, and the music ducks under
it, so the words never fight the track.
"""
import numpy as np, os, subprocess, wave, tempfile

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
DUR = 46.47

# lines are (start seconds, text); overlaps are reported rather than silently stacked
LINES = [
    (0.30,  "Can a coin name a real lake?"),
    (3.00,  "Cheap enough. Yes."),
    (5.60,  "This is Hydropad."),
    (8.10,  "But the question is..."),
    (10.40, "Why water?"),
    (12.10, "Because it is real."),
    (15.20, "Bind a coin to a real place."),
    (18.20, "Not a coin named after nothing."),
    (21.20, "Thirty two sources. Twenty six pairable."),
    (25.20, "Reservoirs. Aquifers. Glaciers."),
    (29.10, "Each carries its own plate."),
    (32.10, "Lake Mead. Thirty one percent."),
    (35.60, "The pairing is in the contract."),
    (38.60, "Not a footer. The contract."),
    (41.60, "It names the water. Nothing more."),
    (44.75, "Pick a lake."),
]

def say(text, speed=155, pitch=34):
    """One line out of espeak, resampled to the film's rate."""
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        path = f.name
    subprocess.run(["espeak-ng", "-v", "en-us", "-s", str(speed), "-p", str(pitch),
                    "-w", path, text], check=True, capture_output=True)
    with wave.open(path) as w:
        sr0 = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), "<i2").astype(np.float64) / 32768
    os.unlink(path)
    if sr0 != SR:                                   # linear resample is plenty here
        n = int(len(x) * SR / sr0)
        x = np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x)
    return x

def lp(x, f):
    a = np.exp(-2 * np.pi * f / SR); y = np.empty_like(x); acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc; y[i] = acc
    return y

def hp(x, f): return x - lp(x, f)

def voice_colour(x):
    """What turns a formant synthesiser into a deliberate choice: take the top
    and the bottom off it like a radio link, push it into a soft clip so it
    sits forward, and give it a small room so it is somewhere rather than
    nowhere."""
    x = hp(lp(x, 4200), 190)
    x = np.tanh(x * 2.4) / np.tanh(2.4)
    room = np.zeros(len(x) + int(0.25 * SR))
    room[:len(x)] = x
    for d, g in ((0.031, .22), (0.047, .16), (0.071, .11), (0.101, .07)):
        i = int(d * SR)
        room[i:i + len(x)] += x * g
    return room * 0.8

def main():
    N = int(DUR * SR)
    vox = np.zeros(N)
    gate = np.zeros(N)                              # where the music has to get out of the way
    prev_end = 0.0
    for t, text in LINES:
        x = voice_colour(say(text))
        if t < prev_end - 0.05:
            print(f"  overlap: {t:.2f}s starts before {prev_end:.2f}s  ({text[:34]}…)")
        i = int(t * SR)
        seg = x[:N - i]
        vox[i:i + len(seg)] += seg
        prev_end = t + len(x) / SR
        g = np.ones(len(seg))
        gate[i:i + len(seg)] = np.maximum(gate[i:i + len(seg)], g)
        print(f"  {t:5.2f}  {len(x)/SR:4.2f}s  {text}")
    print(f"  last line ends at {prev_end:.2f}s of {DUR}s")

    peak = np.abs(vox).max()
    if peak > 0: vox = vox / peak * 0.72
    wr(os.path.join(HERE, "voice.wav"), vox, vox)

    # duck the score under the voice, with a little lead and a slow release
    with wave.open(os.path.join(HERE, "score.wav")) as w:
        a = np.frombuffer(w.readframes(w.getnframes()), "<i2").astype(np.float64) / 32768
    sl, sr_ = a[0::2], a[1::2]
    n = min(len(sl), N)
    duck = np.ones(N)
    smooth = lp(gate, 3.0)                          # a slope rather than a step
    duck = 1 - 0.62 * np.clip(smooth / max(smooth.max(), 1e-9), 0, 1)
    mixL = sl[:n] * duck[:n] + vox[:n]
    mixR = sr_[:n] * duck[:n] + vox[:n]
    for ch in (mixL, mixR):
        p = np.abs(ch).max()
        if p > 0.99: ch /= p / 0.99
    wr(os.path.join(HERE, "mix.wav"), mixL, mixR)

def wr(path, l, r):
    n = min(len(l), len(r))
    inter = np.empty(n * 2); inter[0::2] = l[:n]; inter[1::2] = r[:n]
    with wave.open(path, "w") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(inter, -1, 1) * 32767).astype("<i2").tobytes())
    print(f"{path}  {n/SR:.2f}s")

main()
