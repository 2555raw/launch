#!/usr/bin/env python3
"""Cuts the film.

    node video/capture.js <raw>       # footage
    node video/cards.js <cards>       # titles
    python3 video/build.py <raw> <cards> <out.mp4>

Every cut lands on a beat. The soundtrack is 120 BPM, so a beat is exactly half
a second and exactly fifteen frames at 30fps - which is the whole reason for
that tempo. Clip lengths below are counted in beats, never in seconds, and the
cuts are hard: a crossfade on every one of them would smear the edit into a
slideshow, and the cut landing on the kick is what makes it feel cut at all.
"""

import json
import os
import pathlib
import subprocess
import sys

FF = os.environ.get("FFMPEG") or __import__("imageio_ffmpeg").get_ffmpeg_exe()
FPS = 30
W, H = 1280, 720
BEAT = 0.4                      # 150 BPM
BEAT_FRAMES = int(BEAT * FPS)   # 12

# kind, name, beats, and for footage how far into the beat's action window to
# start - the interesting second of a shot is rarely its first.
# kind, name, beats, and for footage how far into the action window to start
# plus the caption to lay over it. A shot may appear more than once: two cuts
# from different seconds of the same recording cost no extra footage and are
# what keeps the count up.
SEQUENCE = [
    ("card", "01-logo",     3, None, None),
    ("card", "02-line",     4, None, None),
    ("shot", "hero",        3, 0.10, None),
    ("shot", "ticker",      2, 0.55, None),
    ("shot", "rows",        3, 0.70, "watching"),
    ("shot", "board",       2, 0.60, None),
    ("shot", "board",       3, 0.85, "back"),
    ("shot", "flow",        3, 0.70, "threecalls"),
    ("shot", "code",        2, 0.30, None),
    ("shot", "code",        4, 0.80, "beforeswap"),
    ("shot", "chart",       3, 0.75, "fee"),
    ("shot", "app-type",    2, 0.40, None),
    ("shot", "app-type",    3, 0.80, "sepolia"),
    ("shot", "app-flip",    2, 0.55, None),
    ("shot", "app-flip",    2, 0.80, None),
    ("shot", "app-token",   3, 0.55, None),
    ("shot", "app-slip",    2, 0.45, None),
    ("shot", "app-slip",    3, 0.80, "slippage"),
    ("shot", "app-chart",   2, 0.35, None),
    ("shot", "app-chart",   2, 0.70, None),
    ("shot", "tints",       2, 0.35, None),
    ("shot", "tints",       3, 0.80, "reds"),
    ("shot", "docs",        3, 0.65, "note"),
    ("shot", "band",        3, 0.70, None),
    ("card", "09-outro",    5, None, None),
]


def run(args):
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"ffmpeg failed:\n{' '.join(args[:9])}...\n{r.stderr[-1400:]}")


def clip_from_card(png, frames, out):
    """A still, with a slow push in so a title is not a run of dead frames.

    zoompan's `d` counts output frames per *input* frame, so a looped still with
    d=frames yields minutes of video from one PNG; d=1, with the zoom driven by
    the output frame counter, is what gives one frame per frame.
    """
    run([
        FF, "-hide_banner", "-loglevel", "error", "-loop", "1", "-i", str(png),
        "-vf",
        f"fps={FPS},scale=2560:-2,"
        f"zoompan=z='min(1.0+on/{frames}*0.055,1.055)':d=1:"
        f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={W}x{H},"
        f"format=yuv420p,setsar=1",
        "-frames:v", str(frames),
        "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-r", str(FPS),
        str(out), "-y",
    ])


# capture.js shoots 88 rows taller than the film, because the recorder returns
# a canvas the page never finishes painting. Those rows come off here, which
# leaves exactly 1280x720 of real page: nothing scaled, nothing cropped off the
# sides, and no grey strip along the bottom.
BLIND = 88


def clip_from_shot(src, start, frames, out, caption=None):
    """A shot, optionally with a caption laid over it.

    The caption goes on top of the footage rather than between shots. A title
    card costs a second of the cut; a caption costs nothing, because the
    product is still on screen underneath it - which is the whole point of a
    film that is supposed to show the thing working."""
    base = f"crop={W}:{H}:0:0,fps={FPS},format=yuv420p,setsar=1"
    args = [FF, "-hide_banner", "-loglevel", "error", "-ss", f"{start:.3f}", "-i", str(src)]

    if caption:
        args += ["-i", str(caption),
                 "-filter_complex", f"[0:v]{base}[v];[v][1:v]overlay=0:0:format=auto[o]",
                 "-map", "[o]"]
    else:
        args += ["-vf", base]

    args += ["-frames:v", str(frames),
             "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-r", str(FPS),
             str(out), "-y"]
    run(args)


def main():
    raw_dir = pathlib.Path(sys.argv[1])
    cards_dir = pathlib.Path(sys.argv[2])
    target = pathlib.Path(sys.argv[3] if len(sys.argv) > 3 else "turquya.mp4")
    caps_dir = pathlib.Path(sys.argv[4]) if len(sys.argv) > 4 else cards_dir.parent / "caps"
    work = target.parent / "_clips"
    work.mkdir(parents=True, exist_ok=True)

    shots = {b["name"]: b for b in json.load(open(raw_dir / "manifest.json"))}

    clips, total_frames = [], 0
    for i, (kind, name, beats, at, cap) in enumerate(SEQUENCE):
        frames = beats * BEAT_FRAMES
        out = work / f"{i:02d}-{name}.mp4"
        if kind == "card":
            clip_from_card(cards_dir / f"{name}.png", frames, out)
        else:
            beat = shots[name]
            want = frames / FPS
            start = beat["offset"] + max(0.0, (beat["duration"] - want) * at)
            clip_from_shot(beat["file"], start, frames, out,
                           caps_dir / f"{cap}.png" if cap else None)
        clips.append(out)
        total_frames += frames
        print(f"  {i:02d} {name:<11} {beats} beats  {frames / FPS:.1f}s"
              + (f"   [{cap}]" if cap else ""))

    total = total_frames / FPS

    inputs = []
    for c in clips:
        inputs += ["-i", str(c)]
    chain = "".join(f"[{i}:v]" for i in range(len(clips)))
    graph = (
        f"{chain}concat=n={len(clips)}:v=1:a=0[c];"
        f"[c]fade=t=in:st=0:d=0.35,fade=t=out:st={total - 0.9:.3f}:d=0.9[v]"
    )

    silent = work / "silent.mp4"
    run([FF, "-hide_banner", "-loglevel", "error", *inputs,
         "-filter_complex", graph, "-map", "[v]",
         "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-pix_fmt", "yuv420p",
         "-r", str(FPS), str(silent), "-y"])
    print(f"  picture {total:.1f}s, {total_frames} frames, {len(clips)} cuts")

    wav = work / "soundtrack.wav"
    subprocess.run([sys.executable, str(pathlib.Path(__file__).parent / "music.py"),
                    str(wav), f"{total:.2f}"], check=True, capture_output=True)

    run([FF, "-hide_banner", "-loglevel", "error", "-i", str(silent), "-i", str(wav),
         "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest",
         "-movflags", "+faststart", str(target), "-y"])
    print(f"wrote {target} ({total:.1f}s, {target.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
