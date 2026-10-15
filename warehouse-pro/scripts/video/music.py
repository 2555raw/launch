# Pista musical sintetizada: electrónica suave a 124 BPM (kick, hi-hat, bajo y pad), 60 s.
import numpy as np, wave
sr = 48000; bpm = 124; beat = 60 / bpm; total = 60.0
n = int(sr * total); t = np.arange(n) / sr
out = np.zeros(n)
def env(length, a=0.005, d=0.25):
    x = np.arange(int(sr*length))/sr
    return np.minimum(x/a, 1) * np.exp(-x/d)
# progresión (Am, F, C, G) por compás, frecuencias de bajo
chords = [[220.0, 261.63, 329.63], [174.61, 220.0, 261.63], [130.81, 164.81, 196.0], [196.0, 246.94, 293.66]]
bass = [55.0, 43.65, 65.41, 49.0]
bars = int(total / (beat*4)) + 1
for b in range(bars):
    start = b*beat*4
    ch = chords[b % 4]; bf = bass[b % 4]
    # pad
    L = beat*4; i0 = int(start*sr); x = np.arange(int(L*sr))/sr
    pad = sum(np.sin(2*np.pi*f*x)*0.5 + np.sin(2*np.pi*f*2.005*x)*0.15 for f in ch) / 3
    pad *= np.minimum(x/0.4, 1) * np.minimum((L - x)/0.6, 1)
    seg = out[i0:i0+len(pad)]; seg += pad[:len(seg)] * 0.12
    for k in range(4):
        ts = start + k*beat; i = int(ts*sr)
        # kick
        e = env(0.35, 0.002, 0.12); x2 = np.arange(len(e))/sr
        kick = np.sin(2*np.pi*(55 + 120*np.exp(-x2*30))*x2) * e
        seg = out[i:i+len(kick)]; seg += kick[:len(seg)] * 0.9
        # bajo en corcheas
        for h in range(2):
            ib = int((ts + h*beat/2)*sr); eb = env(beat/2*0.9, 0.004, 0.18); xb = np.arange(len(eb))/sr
            f = bf * (2 if (k*2+h) % 4 == 3 else 1)
            bs = (np.sign(np.sin(2*np.pi*f*xb))*0.4 + np.sin(2*np.pi*f*xb)*0.6) * eb
            seg = out[ib:ib+len(bs)]; seg += bs[:len(seg)] * 0.35
        # hi-hat en corcheas (más fuerte en contratiempo)
        for h in range(2):
            ih = int((ts + h*beat/2)*sr); eh = env(0.06, 0.001, 0.025)
            noise = np.random.default_rng(b*100+k*10+h).uniform(-1, 1, len(eh)) * eh
            seg = out[ih:ih+len(noise)]; seg += noise[:len(seg)] * (0.25 if h else 0.12)
        # clap en 2 y 4
        if k in (1, 3):
            ec = env(0.18, 0.002, 0.06); cl = np.random.default_rng(b*7+k).uniform(-1, 1, len(ec)) * ec
            seg = out[i:i+len(cl)]; seg += cl[:len(seg)] * 0.3
# filtro suave (media móvil) para quitar aspereza y normalizar
kernel = np.ones(6)/6; out = np.convolve(out, kernel, mode='same')
out = out / np.max(np.abs(out)) * 0.8
# fundido final
fade = int(sr*2.5); out[-fade:] *= np.linspace(1, 0, fade)
data = (out * 32767).astype(np.int16)
with wave.open('musica.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(data.tobytes())
print('musica.wav', total, 's')
