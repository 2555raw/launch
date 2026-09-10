"""Second pass: the overlays, the flashes on the section cuts, and the track."""
import json, os, subprocess

FF = os.path.abspath('ff/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2')
meta = json.load(open('segs/meta.json'))
TOTAL = meta['total']

# Where a section begins, the cut gets a single frame of white. It is the plainest
# way to make a hard cut read as deliberate rather than as a dropped frame.
FLASH = [11.613, 20.323, 40.645, 46.452]

# card, in, out, fade-out?  (times on the finished timeline)
CARDS = [
    ('cards/c1-intro.png',   0.40,  3.60, True),
    ('cards/c2-market.png',  8.10, 11.45, True),
    ('cards/c3-legs.png',   11.75, 20.10, True),
    ('cards/c4-build.png',  20.70, 27.90, True),
    ('cards/c5-trade.png',  30.30, 38.50, True),
    ('cards/c6-assets.png', 41.00, 46.20, True),
    ('cards/c7-theme.png',  46.80, 50.10, True),
    ('cards/c8-end.png',    51.70, TOTAL, False),
]

cmd = [FF, '-hide_banner', '-loglevel', 'error', '-y', '-i', 'segs/cut.mp4']
for path, *_ in CARDS:
    cmd += ['-loop', '1', '-t', f'{TOTAL:.3f}', '-i', path]
# A white frame to punch the section cuts with, and the track.
cmd += ['-f', 'lavfi', '-t', f'{TOTAL:.3f}', '-i', f'color=white:s={1920}x{1080}:r=25']
cmd += ['-i', 'music.wav']

fc = []
# Not the fade filter: fade=t=in renders every frame BEFORE its start time as
# the fade colour, so four of them chained turn the first forty-six seconds
# white. Two opaque frames, gated by enable, is what a flash cut actually is.
windows = '+'.join(f'between(t,{t:.3f},{t + 0.08:.3f})' for t in FLASH)
fc.append(f"[{len(CARDS) + 1}:v]format=rgba[flash]")
fc.append(f"[0:v][flash]overlay=0:0:enable='{windows}'[base]")
prev = 'base'
for i, (path, tin, tout, fadeout) in enumerate(CARDS, start=1):
    fades = [f'fade=t=in:st={tin:.2f}:d=0.28:alpha=1']
    if fadeout:
        fades.append(f'fade=t=out:st={tout - 0.28:.2f}:d=0.28:alpha=1')
    fc.append(f'[{i}:v]format=rgba,{",".join(fades)}[c{i}]')
    nxt = f'v{i}'
    fc.append(f'[{prev}][c{i}]overlay=0:0:enable=\'between(t,{tin - 0.3:.2f},{tout + 0.05:.2f})\'[{nxt}]')
    prev = nxt
# the track: in under the gate, out under the end card
fc.append(f'[{len(CARDS) + 2}:a]atrim=0:{TOTAL:.3f},asetpts=N/SR/TB,'
          f'afade=t=in:st=0:d=0.6,afade=t=out:st={TOTAL - 2.2:.2f}:d=2.2,volume=0.9[aud]')

cmd += ['-filter_complex', ';'.join(fc), '-map', f'[{prev}]', '-map', '[aud]',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p',
        '-profile:v', 'high', '-level', '4.1', '-movflags', '+faststart',
        '-c:a', 'aac', '-b:a', '192k', '-ar', '44100',
        '-t', f'{TOTAL:.3f}', 'perpix.mp4']

r = subprocess.run(cmd, capture_output=True, text=True)
if r.returncode:
    print(r.stderr[-2500:]); raise SystemExit(1)
size = os.path.getsize('perpix.mp4')
print(f'perpix.mp4  {size/1e6:.1f} MB  {TOTAL:.2f}s')
