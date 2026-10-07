"""Makes one episode end to end: script, review, art, voice, video, Short, upload.

    python -m pipeline                    # next series in rotation, publish per canal.json
    python -m pipeline --series animales  # a specific series
    python -m pipeline --no-upload        # render only, leave the files in output/
    python -m pipeline --demo             # offline test: sample script, no API keys needed
"""

import argparse
import datetime as dt
import json
import re
import shutil
import unicodedata
from concurrent.futures import ThreadPoolExecutor

from . import art, music, video, voice, youtube
from .config import (HEIGHT, OUTPUT_DIR, SHORT_HEIGHT, SHORT_WIDTH, WIDTH, load_config,
                     load_history, pick_series, save_history)
from .demo import demo_episode
from .script import create_episode

SHORT_MAX_SECONDS = 59


def slug(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:50] or "episodio"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--series")
    ap.add_argument("--mode", choices=["private", "public", "scheduled"])
    ap.add_argument("--no-upload", action="store_true")
    ap.add_argument("--demo", action="store_true")
    args = ap.parse_args()

    config = load_config()
    history = load_history()
    series = pick_series(config, history, args.series)
    mode = args.mode or config.get("publish_mode", "private")
    print(f"Serie: {series['name']}")

    print("1/6 Guion y revisión")
    if args.demo:
        episode = demo_episode()
        art_kind = "basic"
    else:
        past = [e["title"] for e in history["episodes"]]
        episode = create_episode(config, series, past)
        art_kind = None
    scenes = episode["scenes"]

    work = OUTPUT_DIR / f"{dt.date.today().isoformat()}-{slug(episode['topic'])}"
    if work.exists():
        shutil.rmtree(work)
    work.mkdir(parents=True)
    (work / "episode.json").write_text(json.dumps(episode, ensure_ascii=False, indent=2))

    print(f"2/6 Ilustraciones ({art_kind or art.provider()})")
    jobs = [(s["visual"], work / f"art-{i:02d}.png") for i, s in enumerate(scenes)]
    jobs.append((episode["thumbnail_visual"], work / "art-thumb.png"))
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(lambda j: art.illustrate(config, j[0], j[1], art_kind), jobs))

    print(f"3/6 Narración ({voice.provider()})")
    narration = []
    for i, s in enumerate(scenes):
        narration.append(voice.speak(config, s["narration"], work / f"voice-{i:02d}.mp3"))

    print("4/6 Video principal")
    clips, lengths = [], []
    for i, s in enumerate(scenes):
        art.frame(work / f"art-{i:02d}.png", s["on_screen_text"], work / f"frame-{i:02d}.png")
        clip = work / f"clip-{i:02d}.mp4"
        lengths.append(video.scene_clip(work / f"frame-{i:02d}.png", work / f"voice-{i:02d}.mp3",
                                        narration[i], clip, i, WIDTH, HEIGHT))
        clips.append(clip)
    total = sum(lengths)
    video.concat(clips, work / "body.mp4", work)
    track = music.pick_track(total + 2, work / "music.wav", seed=len(history["episodes"]))
    final = work / "video.mp4"
    video.add_music(work / "body.mp4", track, final)
    art.thumbnail(work / "art-thumb.png", episode["thumbnail_text"], work / "thumbnail.jpg")

    description = episode["description"].strip()
    marks = video.chapters(scenes, lengths)
    if marks:
        description += "\n\n" + marks
    (work / "description.txt").write_text(description)
    print(f"  {final} ({total:.0f} s)")

    short_path = None
    if config.get("make_short"):
        print("5/6 Short vertical")
        short_clips = []
        for n, idx in enumerate(episode["short"]["scene_numbers"]):
            i = idx - 1
            vframe = work / f"vframe-{i:02d}.png"
            art.vertical(work / f"art-{i:02d}.png", episode["short"]["title"], vframe)
            clip = work / f"sclip-{i:02d}.mp4"
            video.scene_clip(vframe, work / f"voice-{i:02d}.mp3", narration[i], clip, n,
                             SHORT_WIDTH, SHORT_HEIGHT)
            short_clips.append(clip)
        video.concat(short_clips, work / "short-body.mp4", work)
        video.run(["-i", str(work / "short-body.mp4"), "-t", str(SHORT_MAX_SECONDS), "-c", "copy",
                   str(work / "short-cut.mp4")])
        short_path = work / "short.mp4"
        video.add_music(work / "short-cut.mp4", track, short_path)
        print(f"  {short_path}")

    entry = {
        "date": dt.date.today().isoformat(),
        "series": series["id"],
        "topic": episode["topic"],
        "title": episode["title"],
        "seconds": round(total),
    }

    if args.no_upload or args.demo:
        print("6/6 Subida omitida (--no-upload / --demo)")
    elif not youtube.configured():
        print("6/6 Subida omitida: faltan YT_CLIENT_ID / YT_CLIENT_SECRET / YT_REFRESH_TOKEN")
    else:
        print(f"6/6 Subiendo a YouTube (modo {mode})")
        tags = episode["tags"] + config.get("default_tags", [])
        video_id = youtube.upload(config, final, episode["title"], description, tags, mode,
                                  thumbnail_path=work / "thumbnail.jpg", playlist_name=series["name"])
        entry["video_id"] = video_id
        if short_path:
            short_desc = (f"{episode['short']['title']}\n\nEpisodio completo: https://youtu.be/{video_id}\n\n"
                          "#shorts #niños #aprender")
            entry["short_id"] = youtube.upload(config, short_path, episode["short"]["title"], short_desc,
                                               tags, mode)

    if not args.demo and not args.no_upload:
        history["episodes"].append(entry)
        save_history(history)
    (work / "result.json").write_text(json.dumps(entry, ensure_ascii=False, indent=2))
    print("Listo.")


if __name__ == "__main__":
    main()
