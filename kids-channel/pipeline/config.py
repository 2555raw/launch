"""Channel settings (canal.json) and the paths the pipeline writes to."""

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT / "canal.json"
HISTORY_PATH = ROOT / "state" / "history.json"
MUSIC_DIR = ROOT / "assets" / "music"
OUTPUT_DIR = ROOT / "output"

MODEL = os.environ.get("CLAUDE_MODEL", "claude-opus-5-5")

WIDTH, HEIGHT = 1920, 1080
SHORT_WIDTH, SHORT_HEIGHT = 1080, 1920
FPS = 30


def load_config() -> dict:
    with open(CONFIG_PATH, encoding="utf-8") as f:
        return json.load(f)


def load_history() -> dict:
    if not HISTORY_PATH.exists():
        return {"episodes": []}
    with open(HISTORY_PATH, encoding="utf-8") as f:
        return json.load(f)


def save_history(history: dict) -> None:
    HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(HISTORY_PATH, "w", encoding="utf-8") as f:
        json.dump(history, f, ensure_ascii=False, indent=2)
        f.write("\n")


def pick_series(config: dict, history: dict, wanted: str | None) -> dict:
    """The series named on the command line, or the next one in rotation."""
    series = config["series"]
    if wanted:
        for s in series:
            if s["id"] == wanted:
                return s
        raise SystemExit(f"Serie desconocida: {wanted}. Opciones: {[s['id'] for s in series]}")
    return series[len(history["episodes"]) % len(series)]
