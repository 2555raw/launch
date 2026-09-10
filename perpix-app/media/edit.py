"""Cuts the takes to the music's grid. Output is 1600x900: the size the
recording sits at inside the window frame, which finish.py builds around it.

140 BPM, so a beat is 0.4286s. The table is in beats because the cut is made to
the track. The nine perpetuals get a beat and a half each and the drop lands on
the first of them.

Alternating shots are punched in — a centre crop rather than a zoom, so the cut
between wide and tight is a hard change of framing on the beat. That is what
makes the sequence read as aggressive rather than merely fast."""
import json, os, subprocess, glob, shutil

FF = os.path.abspath('ff/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2')
BEAT = 60.0 / 140
BAR = BEAT * 4
W, H, FPS = 1600, 900, 25
SEG = 'segs'
shutil.rmtree(SEG, ignore_errors=True)
os.makedirs(SEG, exist_ok=True)

take = lambda n: glob.glob(f'takes/{n}/*.webm')[0]
A, B, C, D = (take(n) for n in ('a-open', 'b-market', 'c-build', 'd-theme'))
marks = {}
for f in glob.glob('takes/marks-*.json'):
    for m in json.load(open(f)):
        marks[m['label']] = m['t']

IX = ['CRYPTOBETA', 'PRECIOUS', 'SILICON', 'BATTERY', 'MAG5', 'GOLDTWICE', 'LUXURY', 'CRAVING', 'IBERIA']

# (source, in, beats, motion, tight)
#   motion: 'push' | 'pull' | None
#   tight:  centre crop factor, or None for the whole frame
CUTS = [
    (A, 1.20, 8, None,   None),                 # the dashboard, cold
    (B, 0.55, 8, 'pull', None),                 # the market, over the snare roll
]
for i, sym in enumerate(IX):                    # the drop
    t = marks[f'b.ix.{sym}']
    CUTS.append((B, t - 0.70, 1.5, None, 0.72 if i % 2 else None))
CUTS += [
    (C, 1.60,  4, None,   None),                # naming it
    (C, 9.90,  4, None,   0.66),                # the legs going in, tight
    (C, 15.30, 4, 'push', None),                # the preview, then listed
    (C, 20.90, 4, None,   0.62),                # the leverage slider, tight
    (C, 24.90, 4, None,   None),                # the long opens
    (C, 26.70, 4, None,   None),                # the position
    (C, 28.80, 4, None,   0.70),                # closed, tight
    (D, 1.00,  4, None,   None),                # stocks
    (D, 3.30,  4, None,   0.68),                # metals, tight
    (D, 8.00,  4, None,   None),                # the lights go out
    (D, 10.20, 4, None,   0.72),                # the dark market, tight
    (D, 9.60,  8, 'push', None),                # and out on the X mark
]

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        print(' '.join(cmd[:12]), '...'); print(r.stderr[-1200:]); raise SystemExit(1)

parts, t, plan = [], 0.0, []
for i, (src, ss, beats, motion, tight) in enumerate(CUTS):
    dur = beats * BEAT
    out = f'{SEG}/{i:02d}.mp4'
    steps = [f'fps={FPS}']
    if tight:
        steps.append(f'crop=iw*{tight}:ih*{tight}:(iw-iw*{tight})/2:(ih-ih*{tight})/2')
    if motion == 'push':
        steps += [f'scale={W*2}:{H*2}',
                  f"zoompan=z='min(1.0+0.06*on/{max(int(dur*FPS),1)},1.065)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS}"]
    elif motion == 'pull':
        steps += [f'scale={W*2}:{H*2}',
                  f"zoompan=z='max(1.075-0.07*on/{max(int(dur*FPS),1)},1.0)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS}"]
    else:
        steps.append(f'scale={W}:{H}')
    run([FF, '-hide_banner', '-loglevel', 'error', '-y', '-ss', f'{ss:.3f}', '-t', f'{dur:.3f}', '-i', src,
         '-vf', ','.join(steps), '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16',
         '-pix_fmt', 'yuv420p', '-r', str(FPS), out])
    parts.append(out)
    plan.append((t, t + dur, os.path.basename(src)[:6], motion or '-', tight or '-'))
    t += dur

TOTAL = t
with open(f'{SEG}/list.txt', 'w') as f:
    for p in parts: f.write(f"file '{os.path.abspath(p)}'\n")
run([FF, '-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0',
     '-i', f'{SEG}/list.txt', '-c', 'copy', f'{SEG}/cut.mp4'])

# Where every cut falls, so finish.py can flash exactly on them.
cuts_at = [p[0] for p in plan][1:]
json.dump({'total': TOTAL, 'beat': BEAT, 'bar': BAR, 'cuts': cuts_at,
           'content': {'w': W, 'h': H}}, open(f'{SEG}/meta.json', 'w'))
print(f'cut.mp4  {TOTAL:.2f}s  {len(parts)} cuts  ({TOTAL/BAR:.2f} bars)')
for a, b, s, m, ti in plan: print(f'  {a:6.2f} → {b:6.2f}  {s:6}  motion {m:5}  tight {ti}')
