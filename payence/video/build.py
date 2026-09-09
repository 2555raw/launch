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
XFADE = 0.42          # the crossfade between every beat

# name, source, seconds. Footage seconds are trimmed from the recording's own
# action window; card seconds are how long the title holds.
SEQUENCE = [
    ("card", "01-logo", 2.2),
    ("card", "02-line", 2.6),
    ("shot", "hero", 4.0),
    ("card", "03-cards", 1.7),
    ("shot", "colours", 5.4),
    ("card", "04-network", 1.5),
    ("shot", "network", 2.8),
    ("card", "05-policy", 1.6),
    ("shot", "policy", 3.6),
    ("card", "06-auth", 1.5),
    ("shot", "terminal", 3.9),
    ("card", "07-console", 1.4),
    ("shot", "platform", 3.7),
    ("shot", "monitor", 3.4),
    ("card", "08-outro", 3.2),
]


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
    target = pathlib.Path(sys.argv[3] if len(sys.argv) > 3 else "payence.mp4")
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
    steps.append(f"[{label}]fade=t=in:st=0:d=0.5,fade=t=out:st={total - 0.9:.3f}:d=0.9[v]")
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
