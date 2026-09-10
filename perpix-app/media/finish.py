"""Second pass: puts the recording inside the window, tilts the whole desk so it
reads as seen from above, flashes every cut, lays the cards on top and adds the
track.

Order matters. The tilt is applied to the window and the desktop together,
because that is one object being looked at from an angle; the cards and the
flashes go on afterwards, because they are not part of the screen being filmed.
"""
import json, os, subprocess

FF = os.path.abspath('ff/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2')
meta = json.load(open('segs/meta.json'))
TOTAL = meta['total']
CUTS = meta['cuts']
CX, CY = 160, 112                 # where the 1600x900 recording sits in the frame
OW, OH = 1920, 1080

# Every cut gets a flash. At a beat and a half apart that is relentless, which
# is the point; one frame is enough to register without strobing.
FLASH_D = 0.05

# card, in, out, fade out at the end?
CARDS = [
    ('cards/c1-intro.png',   0.30,  3.20, True),
    ('cards/c2-market.png',  3.70,  6.60, True),
    # Nothing over the rapid-fire section: it was colliding with the index's own
    # value, and the fastest part of a cut is the part that wants no captions.
    ('cards/c4-build.png',  12.90, 17.50, True),
    ('cards/c5-trade.png',  17.90, 24.40, True),
    ('cards/c6-assets.png', 24.90, 27.90, True),
    ('cards/c7-theme.png',  28.30, 31.30, True),
    ('cards/c8-end.png',    32.60, TOTAL, False),
]

cmd = [FF, '-hide_banner', '-loglevel', 'error', '-y', '-i', 'segs/cut.mp4',
       '-loop', '1', '-t', f'{TOTAL:.3f}', '-i', 'chrome.png']
for path, *_ in CARDS:
    cmd += ['-loop', '1', '-t', f'{TOTAL:.3f}', '-i', path]
cmd += ['-f', 'lavfi', '-t', f'{TOTAL:.3f}', '-i', f'color=white:s={OW}x{OH}:r=25']
cmd += ['-i', 'music.wav']
FLASH_IN = 2 + len(CARDS)
AUDIO_IN = FLASH_IN + 1

fc = []
# the recording, dropped into the hole in the window
fc.append(f'[0:v]pad={OW}:{OH}:{CX}:{CY}:color=#0A0D1A[desk]')
fc.append('[1:v]format=rgba[frame]')
fc.append('[desk][frame]overlay=0:0[framed]')

# Seen from above: the top edge is farther away, so it is narrower and lower.
# Rendered 4% oversize first, so the corners the tilt opens up are covered
# rather than black, then cropped back to frame.
BIG_W, BIG_H = 2000, 1125
fc.append(
    f'[framed]scale={BIG_W}:{BIG_H},'
    f'perspective=x0=44:y0=27:x1={BIG_W - 44}:y1=27:x2=0:y2={BIG_H}:x3={BIG_W}:y3={BIG_H}'
    f':sense=destination,'
    f'crop={OW}:{OH}:{(BIG_W - OW) // 2}:{(BIG_H - OH) // 2}[tilted]'
)

# flashes, on every cut
windows = '+'.join(f'between(t,{t:.3f},{t + FLASH_D:.3f})' for t in CUTS)
fc.append(f'[{FLASH_IN}:v]format=rgba[flash]')
fc.append(f"[tilted][flash]overlay=0:0:enable='{windows}'[base]")

prev = 'base'
for i, (path, tin, tout, fadeout) in enumerate(CARDS, start=2):
    fades = [f'fade=t=in:st={tin:.2f}:d=0.20:alpha=1']
    if fadeout:
        fades.append(f'fade=t=out:st={tout - 0.20:.2f}:d=0.20:alpha=1')
    fc.append(f'[{i}:v]format=rgba,{",".join(fades)}[c{i}]')
    nxt = f'v{i}'
    fc.append(f"[{prev}][c{i}]overlay=0:0:enable='between(t,{tin - 0.25:.2f},{tout + 0.05:.2f})'[{nxt}]")
    prev = nxt

fc.append(f'[{AUDIO_IN}:a]atrim=0:{TOTAL:.3f},asetpts=N/SR/TB,'
          f'afade=t=in:st=0:d=0.35,afade=t=out:st={TOTAL - 1.7:.2f}:d=1.7,volume=0.92[aud]')

cmd += ['-filter_complex', ';'.join(fc), '-map', f'[{prev}]', '-map', '[aud]',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p',
        '-profile:v', 'high', '-level', '4.1', '-movflags', '+faststart',
        '-c:a', 'aac', '-b:a', '192k', '-ar', '44100',
        '-t', f'{TOTAL:.3f}', 'perpix.mp4']

r = subprocess.run(cmd, capture_output=True, text=True)
if r.returncode:
    print(r.stderr[-2500:]); raise SystemExit(1)
print(f'perpix.mp4  {os.path.getsize("perpix.mp4")/1e6:.1f} MB  {TOTAL:.2f}s  {len(CUTS)} flashes')
