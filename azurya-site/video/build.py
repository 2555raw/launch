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
BEAT = 0.5                      # 120 BPM
BEAT_FRAMES = int(BEAT * FPS)   # 15

# kind, name, beats, and for footage how far into the beat's action window to
# start - the interesting second of a shot is rarely its first.
SEQUENCE = [
    ("card", "01-logo",    3, None),
    ("card", "02-line",    4, None),
    ("shot", "hero",       5, 0.05),   # the headline builds itself at load
    ("shot", "ticker",     2, 0.62),
    ("card", "04-nobody",  3, None),
    ("shot", "cards",      4, 0.86),   # the three cards, once they have landed
    ("card", "03-cost",    3, None),
    ("shot", "board",      4, 0.72),
    ("card", "05-first",   3, None),
    ("shot", "flow",       3, 0.78),
    ("shot", "code",       2, 0.70),
    ("card", "06-auction", 3, None),
    ("shot", "chart",      3, 0.74),
    ("card", "07-back",    3, None),
    ("shot", "band",       3, 0.72),   # the figures counting up
    ("shot", "tints",      4, 0.86),   # the page changing colour, into the night flip
    ("shot", "app",        4, 0.46),
    ("shot", "docs",       2, 0.58),
    ("shot", "registry",   2, 0.68),
    ("card", "08-state",   3, None),
    ("card", "09-outro",   5, None),
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


def clip_from_shot(src, start, frames, out):
    run([
        FF, "-hide_banner", "-loglevel", "error", "-ss", f"{start:.3f}", "-i", str(src),
        "-vf", f"crop={W}:{H}:0:0,fps={FPS},format=yuv420p,setsar=1",
        "-frames:v", str(frames),
        "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-r", str(FPS),
        str(out), "-y",
    ])


def main():
    raw_dir = pathlib.Path(sys.argv[1])
    cards_dir = pathlib.Path(sys.argv[2])
    target = pathlib.Path(sys.argv[3] if len(sys.argv) > 3 else "beyga.mp4")
    work = target.parent / "_clips"
    work.mkdir(parents=True, exist_ok=True)

    shots = {b["name"]: b for b in json.load(open(raw_dir / "manifest.json"))}

    clips, total_frames = [], 0
    for i, (kind, name, beats, at) in enumerate(SEQUENCE):
        frames = beats * BEAT_FRAMES
        out = work / f"{i:02d}-{name}.mp4"
        if kind == "card":
            clip_from_card(cards_dir / f"{name}.png", frames, out)
        else:
            beat = shots[name]
            want = frames / FPS
            start = beat["offset"] + max(0.0, (beat["duration"] - want) * at)
            clip_from_shot(beat["file"], start, frames, out)
        clips.append(out)
        total_frames += frames
        print(f"  {i:02d} {name:<11} {beats} beats  {frames / FPS:.1f}s")

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
