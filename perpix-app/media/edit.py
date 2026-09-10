"""Assembles the video.

Every cut lands on the music's grid: the track is 124 BPM, so a beat is
0.483871s and a bar is four of those. The segment table below is written in
beats for that reason — the edit is cut to the track, not laid next to it.

Two stages, because one enormous filter graph is impossible to debug: each
segment is encoded on its own with whatever motion it needs, then they are
concatenated and the overlays, flashes and audio go on in a second pass."""
import json, os, subprocess, glob, shutil

FF = os.path.abspath('ff/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2')
BEAT = 60.0 / 124
BAR = BEAT * 4
W, H, FPS = 1920, 1080, 25
SEG = 'segs'
shutil.rmtree(SEG, ignore_errors=True)
os.makedirs(SEG, exist_ok=True)

take = lambda name: glob.glob(f'takes/{name}/*.webm')[0]
A, B, C, D = (take(n) for n in ('a-open', 'b-market', 'c-build', 'd-theme'))
marks = {}
for f in glob.glob('takes/marks-*.json'):
    for m in json.load(open(f)):
        marks[m['label']] = m['t']

IX = ['CRYPTOBETA', 'PRECIOUS', 'SILICON', 'BATTERY', 'MAG5', 'GOLDTWICE', 'LUXURY', 'CRAVING', 'IBERIA']

# (source, source-in, length in beats, motion)
#   push  = slow zoom in, for a shot that would otherwise sit still
#   pull  = slow zoom out, to open a section
#   None  = as recorded
CUTS = [
    (A, 1.00,  8, None),                       # the gate, while the track is still bare
    (A, 4.87,  8, 'push'),                     # accept, and the app arrives as the beat comes in
    (B, 0.55,  8, 'pull'),                     # the market list, over the riser
]
# the drop: every perpetual, half a bar each
for sym in IX:
    t = marks[f'b.ix.{sym}']
    CUTS.append((B, t - 1.02, 2, None))
CUTS += [
    (C, 0.80,  8, None),                       # naming it
    (C, 8.70,  8, None),                       # the legs, and the preview drawing itself
    (C, 15.00, 4, 'push'),                     # listed
    (C, 20.50, 8, None),                       # leverage, then size
    (C, 24.60, 4, None),                       # the long opens
    (C, 26.60, 6, None),                       # the position, in the portfolio
    (C, 28.60, 4, None),                       # closed
    (D, 0.90,  8, None),                       # stocks, then metals
    (D, 4.80,  4, None),                       # crypto
    (D, 7.60,  8, None),                       # the lights go out
    (D, 10.00, 8, 'push'),                     # the market in the dark, and the X mark
]

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        print(' '.join(cmd[:14]), '...')
        print(r.stderr[-1400:])
        raise SystemExit(1)

parts, t = [], 0.0
plan = []
for i, (src, ss, beats, motion) in enumerate(CUTS):
    dur = beats * BEAT
    out = f'{SEG}/{i:02d}.mp4'
    # A still page can be stretched without anyone noticing; a page with the
    # pointer moving cannot, so only shots marked for motion are slowed.
    if motion == 'push':
        vf = (f"scale={W*2}:{H*2},zoompan=z='min(1.0+0.055*on/{int(dur*FPS)},1.06)'"
              f":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS}")
    elif motion == 'pull':
        vf = (f"scale={W*2}:{H*2},zoompan=z='max(1.07-0.06*on/{int(dur*FPS)},1.0)'"
              f":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS}")
    else:
        vf = f"fps={FPS},scale={W}:{H}"
    run([FF, '-hide_banner', '-loglevel', 'error', '-y', '-ss', f'{ss:.3f}', '-t', f'{dur:.3f}', '-i', src,
         '-vf', vf, '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17',
         '-pix_fmt', 'yuv420p', '-r', str(FPS), out])
    parts.append(out)
    plan.append((t, t + dur, os.path.basename(src)[:6], motion or '-'))
    t += dur

TOTAL = t
with open(f'{SEG}/list.txt', 'w') as f:
    for p in parts: f.write(f"file '{os.path.abspath(p)}'\n")
run([FF, '-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0',
     '-i', f'{SEG}/list.txt', '-c', 'copy', f'{SEG}/cut.mp4'])
print(f'cut.mp4  {TOTAL:.2f}s  {len(parts)} segments  ({TOTAL/BAR:.1f} bars)')
for a, b, s, m in plan: print(f'  {a:6.2f} → {b:6.2f}  {s:6}  {m}')
json.dump({'total': TOTAL, 'beat': BEAT, 'bar': BAR}, open(f'{SEG}/meta.json', 'w'))
