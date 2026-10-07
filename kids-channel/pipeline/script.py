"""Writes an episode with Claude, then has a second pass review it for kids' safety."""

import json

from .claude import ask_json

SCENE_SCHEMA = {
    "type": "object",
    "properties": {
        "chapter": {"type": "string"},
        "narration": {"type": "string"},
        "visual": {"type": "string"},
        "on_screen_text": {"type": "string"},
    },
    "required": ["chapter", "narration", "visual", "on_screen_text"],
    "additionalProperties": False,
}

EPISODE_SCHEMA = {
    "type": "object",
    "properties": {
        "topic": {"type": "string"},
        "title": {"type": "string"},
        "description": {"type": "string"},
        "tags": {"type": "array", "items": {"type": "string"}},
        "thumbnail_text": {"type": "string"},
        "thumbnail_visual": {"type": "string"},
        "scenes": {"type": "array", "items": SCENE_SCHEMA},
        "short": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "scene_numbers": {"type": "array", "items": {"type": "integer"}},
            },
            "required": ["title", "scene_numbers"],
            "additionalProperties": False,
        },
    },
    "required": ["topic", "title", "description", "tags", "thumbnail_text",
                 "thumbnail_visual", "scenes", "short"],
    "additionalProperties": False,
}

REVIEW_SCHEMA = {
    "type": "object",
    "properties": {
        "approved": {"type": "boolean"},
        "problems": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["approved", "problems"],
    "additionalProperties": False,
}

WRITER_SYSTEM = """You write episodes for a faceless YouTube channel for young children. \
Every episode is narrated by one warm voice over illustrated scenes, with a recurring mascot.

What makes these episodes good, in order of importance:
1. Real value for the child: one clear idea, taught with repetition, simple words, short sentences \
and moments where the child is invited to answer, point, count or repeat out loud. Facts must be correct.
2. Warmth and calm: kind, playful, never scary, never sarcastic, no shouting, no frantic pacing.
3. Originality: a fresh angle on the topic, not a generic list. The channel must never feel mass-produced.
4. Packaging that parents search for and click, without clickbait.

Hard rules:
- Never ask the child for personal information, never tell them to go online, buy, subscribe or click.
- No brands, licensed characters, real celebrities, or copyrighted songs.
- No dangerous activities (fire, knives, medicine, climbing, water without an adult). Any hands-on \
activity must be safe and mention asking a grown-up for help.
- Write everything the viewer hears or reads in the channel's language."""

REVIEWER_SYSTEM = """You are the standards reviewer for a YouTube channel for children aged 3 to 6. \
You approve an episode only if ALL of these hold:
- Every fact is correct and age-appropriate.
- Nothing is scary, violent, mean, gross for shock value, or romantic.
- No dangerous activity, and nothing a child could imitate and get hurt.
- No requests for personal data, no commercial pressure (buy, subscribe, click, links), no brands or \
licensed characters.
- The title and thumbnail text are honest about the content (no clickbait, no ALL CAPS shouting).
- The language is simple and correct for the stated audience.
List every concrete problem you find. Approve only if the list is empty."""


def write_episode(config: dict, series: dict, past_titles: list[str], feedback: list[str]) -> dict:
    n = config["scenes_per_video"]
    past = "\n".join(f"- {t}" for t in past_titles[-60:]) or "(none yet)"
    retry = ""
    if feedback:
        retry = ("\nA reviewer rejected the previous draft for these reasons. Fix all of them:\n"
                 + "\n".join(f"- {p}" for p in feedback) + "\n")
    prompt = f"""Channel: {config['channel_name']}
Language: {config['language']}
Audience: {config['audience']}
Mascot (appears in most scenes, always drawn the same way): {config['mascot']}
Art style: {config['style']}

Series: {series['name']}
Series format: {series['brief']}

Episodes already published (do not repeat a topic):
{past}
{retry}
Write the next episode of this series.

- topic: the one subject of this episode.
- scenes: exactly {n} scenes. Each `narration` is 1-3 short sentences (about 8-14 seconds read aloud). \
Scene 1 is a hook that names the topic in the first sentence and makes the child curious. The last scene \
is a gentle goodbye that invites the child to watch the next adventure (no "subscribe").
- chapter: a short chapter name (2-4 words) on scene 1 and wherever a new part begins (aim for 4-6 \
chapters in total); an empty string on the other scenes.
- visual: an English description of the illustration for that scene: what is shown, where the mascot is \
and what it is doing, the background. One clear focal subject, no text in the picture.
- on_screen_text: one to three big words shown on screen (e.g. the color, the number, the animal name), \
or an empty string.
- title: under 60 characters, the main search phrase parents would type first, then a friendly hook. \
Natural capitalization, at most one emoji.
- description: 3 short paragraphs. The first two lines repeat the main search phrase naturally and say \
what the child will learn. Then what happens in the episode, then a note for parents. No links, no \
timestamps (they are added automatically), 3 hashtags at the end.
- tags: 12-18 search phrases parents use, from specific to broad.
- thumbnail_text: 1-3 words, huge and readable on a phone.
- thumbnail_visual: an English description of a bold, high-contrast thumbnail illustration: the mascot \
with a big happy expression next to the main subject, very simple background, room on the right third \
for the text.
- short: a vertical YouTube Short cut from this episode: a title under 60 characters, and 3-5 \
consecutive scene numbers (1-based) whose narration together lasts under 50 seconds and works on its own \
as a hook."""
    episode = ask_json(WRITER_SYSTEM, prompt, EPISODE_SCHEMA, effort="high")
    _check_shape(episode, n)
    return episode


def review_episode(config: dict, episode: dict) -> dict:
    prompt = f"""Audience: {config['audience']}. Language: {config['language']}.

Episode to review (JSON):
{json.dumps(episode, ensure_ascii=False, indent=1)}"""
    return ask_json(REVIEWER_SYSTEM, prompt, REVIEW_SCHEMA, effort="medium")


def create_episode(config: dict, series: dict, past_titles: list[str], attempts: int = 3) -> dict:
    """Write, review, and rewrite until the reviewer approves or attempts run out."""
    feedback: list[str] = []
    for attempt in range(1, attempts + 1):
        episode = write_episode(config, series, past_titles, feedback)
        review = review_episode(config, episode)
        if review["approved"] and not review["problems"]:
            print(f"  guion aprobado en el intento {attempt}: {episode['title']}")
            return episode
        feedback = review["problems"]
        print(f"  intento {attempt} rechazado: {feedback}")
    raise RuntimeError(f"El guion no pasó la revisión tras {attempts} intentos: {feedback}")


def _check_shape(episode: dict, n: int) -> None:
    scenes = episode["scenes"]
    if len(scenes) < max(4, n - 2):
        raise RuntimeError(f"Expected about {n} scenes, got {len(scenes)}")
    if not scenes[0]["chapter"]:
        scenes[0]["chapter"] = "Inicio"
    nums = [i for i in episode["short"]["scene_numbers"] if 1 <= i <= len(scenes)]
    episode["short"]["scene_numbers"] = nums or [1, 2, 3]
    episode["title"] = episode["title"].strip()[:100]
    episode["short"]["title"] = episode["short"]["title"].strip()[:90]
