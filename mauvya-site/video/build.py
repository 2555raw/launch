#!/usr/bin/env python3
"""Cuts the film.

    node video/capture.js <raw>      # footage
    node video/cards.js <cards>      # titles
    python3 video/build.py <raw> <cards> <out.mp4>

Every beat is normalised to the same 1280x720/30fps clip first, then the whole
thing is chained with crossfades in one pass, and the soundtrack is written to
the length the picture actually came out at.
"""

import json
import os
import pathlib
import subprocess
import sys

FF = os.environ.get("FFMPEG") or __import__("imageio_ffmpeg").get_ffmpeg_exe()
FPS = 30
W, H = 1280, 720
XFADE = float(os.environ.get("XFADE", 0.26))   # the crossfade between every beat

# name, source, seconds. Footage seconds are trimmed from the recording's own
# action window; card seconds are how long the title holds.
SEQUENCE = [
    ("card", "01-logo", 1.4),
    ("card", "02-line", 2.0),
    ("shot", "hero", 2.8),
    ("card", "03-split", 1.1),
    ("shot", "state", 2.0),
    ("card", "04-ledger", 1.1),
    ("shot", "ledger", 2.6),
    ("card", "05-hook", 1.1),
    ("shot", "hook", 2.6),
    ("shot", "theme", 2.2),
    ("card", "06-registry", 1.1),
    ("shot", "registry", 2.0),
    ("card", "07-app", 1.1),
    ("shot", "app", 2.6),
    ("shot", "docs", 2.0),
    ("card", "08-outro", 2.2),
]

# The app film: the interface being used rather than the page being read, so
# it is nearly all footage and the cuts are shorter.
APP_SEQUENCE = [
    ("card", "01-logo", 1.2),
    ("shot", "open", 2.4),
    ("shot", "pick", 2.6),
    ("shot", "amount", 2.6),
    ("shot", "settings", 2.2),
    ("shot", "wallet", 2.6),
    ("shot", "confirm", 3.0),
    ("shot", "chart", 2.4),
    ("shot", "theme", 2.2),
    ("card", "08-outro", 2.0),
]

if os.environ.get("SEQ") == "app":
    SEQUENCE = APP_SEQUENCE


def run(args):
    subprocess.run(args, check=True, capture_output=True)


def clip_from_card(png, seconds, out):
    """A still, with a slow push in so the titles are not dead frames.

    zoompan's `d` is output frames per *input* frame, so a looped still with
    d=frames yields minutes of video; d=1 with the zoom driven by the output
    frame counter is what gives one frame per frame.
    """
    frames = int(seconds * FPS)
    run([
        FF, "-hide_banner", "-loglevel", "error", "-loop", "1", "-t", f"{seconds}",
        "-i", str(png),
        "-vf",
        f"fps={FPS},scale=2560:-2,"
        f"zoompan=z='min(1.0+on/{frames}*0.05,1.05)':d=1:"
        f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={W}x{H},"
        f"format=yuv420p,setsar=1",
        "-frames:v", str(frames),
        "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-r", str(FPS), str(out), "-y",
    ])


def clip_from_shot(src, start, seconds, out):
    run([
        FF, "-hide_banner", "-loglevel", "error", "-ss", f"{start}", "-t", f"{seconds}",
        "-i", str(src),
        "-vf", f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS},"
               f"format=yuv420p,setsar=1",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-r", str(FPS), str(out), "-y",
    ])


def main():
    raw_dir = pathlib.Path(sys.argv[1])
    cards_dir = pathlib.Path(sys.argv[2])
    target = pathlib.Path(sys.argv[3] if len(sys.argv) > 3 else "mauvya.mp4")
    work = target.parent / "_clips"
    work.mkdir(parents=True, exist_ok=True)

    shots = {b["name"]: b for b in json.load(open(raw_dir / "manifest.json"))}

    clips = []
    for i, (kind, name, seconds) in enumerate(SEQUENCE):
        out = work / f"{i:02d}-{name}.mp4"
        if kind == "card":
            clip_from_card(cards_dir / f"{name}.png", seconds, out)
        else:
            beat = shots[name]
            # start a beat into the action, so the shot opens already moving
            start = beat["offset"] + max(0.0, (beat["duration"] - seconds) * 0.35)
            clip_from_shot(beat["file"], start, seconds, out)
        clips.append((out, seconds))
        print(f"  clip {i:02d} {name} {seconds:.1f}s")

    # one xfade chain over the lot
    inputs = []
    for path, _ in clips:
        inputs += ["-i", str(path)]

    steps = []
    acc = clips[0][1]
    label = "0:v"
    for i in range(1, len(clips)):
        offset = acc - XFADE
        nxt = f"x{i}"
        steps.append(
            f"[{label}][{i}:v]xfade=transition=fade:duration={XFADE}:offset={offset:.3f}[{nxt}]"
        )
        acc = acc + clips[i][1] - XFADE
        label = nxt

    total = acc
    steps.append(f"[{label}]fade=t=in:st=0:d=0.4,fade=t=out:st={total - 0.8:.3f}:d=0.8[v]")
    silent = work / "silent.mp4"
    run([FF, "-hide_banner", "-loglevel", "error", *inputs,
         "-filter_complex", ";".join(steps), "-map", "[v]",
         "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-pix_fmt", "yuv420p",
         "-r", str(FPS), str(silent), "-y"])
    print(f"  picture {total:.1f}s")

    # the soundtrack is written to the length the picture came out at
    wav = work / "soundtrack.wav"
    subprocess.run([sys.executable, str(pathlib.Path(__file__).parent / "music.py"),
                    str(wav), f"{total:.2f}"], check=True, capture_output=True)

    run([FF, "-hide_banner", "-loglevel", "error", "-i", str(silent), "-i", str(wav),
         "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest",
         "-movflags", "+faststart", str(target), "-y"])
    size = target.stat().st_size / 1e6
    print(f"wrote {target} ({total:.1f}s, {size:.1f} MB)")


if __name__ == "__main__":
    main()
