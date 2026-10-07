"""ffmpeg steps: one gently moving clip per scene, joined, with music under the narration."""

import subprocess

from .config import FPS

LEAD_IN = 0.25   # seconds of quiet before each narration starts
TAIL = 0.6       # seconds the picture holds after the narration ends

# Slow camera moves, cycled through the scenes so no two neighbours move the same way.
MOTIONS = [
    ("1+0.10*on/{d}", "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"),           # zoom in
    ("1.10-0.10*on/{d}", "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"),        # zoom out
    ("1.08", "(iw-iw/zoom)*on/{d}", "ih/2-(ih/zoom/2)"),                  # pan right
    ("1.08", "(iw-iw/zoom)*(1-on/{d})", "ih/2-(ih/zoom/2)"),              # pan left
]


def run(args: list[str]) -> None:
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *args], check=True)


def scene_clip(frame_png, audio, narration_seconds: float, out_mp4, index: int,
               width: int, height: int) -> float:
    """Render one scene and return its length in seconds."""
    seconds = LEAD_IN + narration_seconds + TAIL
    frames = int(round(seconds * FPS))
    z, x, y = (part.format(d=frames) for part in MOTIONS[index % len(MOTIONS)])
    lead_ms = int(LEAD_IN * 1000)
    run([
        "-i", str(frame_png), "-i", str(audio),
        "-filter_complex",
        f"[0:v]scale={width * 2}:{height * 2},zoompan=z='{z}':x='{x}':y='{y}':d={frames}:"
        f"s={width}x{height}:fps={FPS},format=yuv420p[v];"
        f"[1:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay={lead_ms}|{lead_ms},"
        f"apad=whole_dur={seconds:.3f}[a]",
        "-map", "[v]", "-map", "[a]", "-t", f"{seconds:.3f}",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-r", str(FPS),
        "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2",
        str(out_mp4),
    ])
    return frames / FPS


def concat(clips: list, out_mp4, workdir) -> None:
    listing = workdir / f"{out_mp4.stem}-list.txt"
    listing.write_text("".join(f"file '{c.resolve()}'\n" for c in clips))
    run(["-f", "concat", "-safe", "0", "-i", str(listing), "-c", "copy", str(out_mp4)])


def add_music(video_mp4, music, out_mp4, volume: float = 0.13) -> None:
    run([
        "-i", str(video_mp4), "-stream_loop", "-1", "-i", str(music),
        "-filter_complex",
        f"[1:a]aformat=sample_rates=44100:channel_layouts=stereo,volume={volume}[m];"
        "[0:a][m]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-15:TP=-1.5:LRA=11,"
        "aresample=44100[a]",
        "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart", str(out_mp4),
    ])


def chapters(scenes: list[dict], lengths: list[float]) -> str:
    """YouTube chapter lines (0:00 Inicio ...). YouTube needs 3+ chapters of 10+ seconds each."""
    marks, t = [], 0.0
    for scene, length in zip(scenes, lengths):
        name = scene["chapter"].strip()
        if name and (not marks or t - marks[-1][0] >= 10):
            marks.append((t, name))
        t += length
    while marks and t - marks[-1][0] < 10:
        marks.pop()
    if len(marks) < 3 or marks[0][0] != 0:
        return ""
    return "\n".join(f"{int(s // 60)}:{int(s % 60):02d} {name}" for s, name in marks)
