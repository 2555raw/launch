"""Uploads to YouTube through the Data API v3, marked as made for kids.

Needs YT_CLIENT_ID, YT_CLIENT_SECRET and YT_REFRESH_TOKEN (see tools/get_youtube_token.py).
Quota: an upload costs about 1,600 of the default 10,000 daily units, so ~5 uploads a day at most.
"""

import datetime as dt
import os

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

SCOPES = ["https://www.googleapis.com/auth/youtube"]


def configured() -> bool:
    return all(os.environ.get(k) for k in ("YT_CLIENT_ID", "YT_CLIENT_SECRET", "YT_REFRESH_TOKEN"))


def _service():
    creds = Credentials(
        token=None,
        refresh_token=os.environ["YT_REFRESH_TOKEN"],
        client_id=os.environ["YT_CLIENT_ID"],
        client_secret=os.environ["YT_CLIENT_SECRET"],
        token_uri="https://oauth2.googleapis.com/token",
        scopes=SCOPES,
    )
    return build("youtube", "v3", credentials=creds, cache_discovery=False)


def status_for(config: dict, mode: str) -> dict:
    """private (you review and publish by hand), public, or scheduled (next publish_hour_utc)."""
    status = {"selfDeclaredMadeForKids": True, "embeddable": True, "license": "youtube"}
    if config.get("contains_synthetic_media"):
        status["containsSyntheticMedia"] = True
    if mode == "public":
        status["privacyStatus"] = "public"
    elif mode == "scheduled":
        now = dt.datetime.now(dt.timezone.utc)
        when = now.replace(hour=config.get("publish_hour_utc", 15), minute=0, second=0, microsecond=0)
        if when <= now + dt.timedelta(minutes=30):
            when += dt.timedelta(days=1)
        status["privacyStatus"] = "private"
        status["publishAt"] = when.isoformat().replace("+00:00", "Z")
    else:
        status["privacyStatus"] = "private"
    return status


def upload(config: dict, video_path, title: str, description: str, tags: list[str],
           mode: str, thumbnail_path=None, playlist_name: str | None = None) -> str:
    yt = _service()
    lang = config["language"]
    body = {
        "snippet": {
            "title": title[:100],
            "description": description[:4900],
            "tags": _fit_tags(tags),
            "categoryId": config.get("category_id", "27"),
            "defaultLanguage": lang,
            "defaultAudioLanguage": lang,
        },
        "status": status_for(config, mode),
    }
    request = yt.videos().insert(part="snippet,status", body=body,
                                 media_body=MediaFileUpload(str(video_path), chunksize=8 * 1024 * 1024,
                                                            resumable=True, mimetype="video/mp4"))
    response = None
    while response is None:
        _, response = request.next_chunk()
    video_id = response["id"]
    print(f"  subido: https://youtu.be/{video_id} ({body['status']['privacyStatus']})")

    if thumbnail_path:
        try:
            yt.thumbnails().set(videoId=video_id, media_body=MediaFileUpload(str(thumbnail_path))).execute()
        except HttpError as e:
            # Custom thumbnails need a phone-verified channel.
            print(f"  miniatura no aplicada (¿canal verificado?): {e}")
    if playlist_name:
        try:
            _add_to_playlist(yt, playlist_name, video_id, lang)
        except HttpError as e:
            print(f"  no se pudo añadir a la lista {playlist_name!r}: {e}")
    return video_id


def _fit_tags(tags: list[str]) -> list[str]:
    """YouTube rejects tag lists over ~500 characters in total."""
    out, total = [], 0
    for tag in dict.fromkeys(t.strip().replace("<", "").replace(">", "") for t in tags if t.strip()):
        cost = len(tag) + (2 if " " in tag else 0) + 1
        if total + cost > 480:
            break
        out.append(tag)
        total += cost
    return out


def _add_to_playlist(yt, name: str, video_id: str, lang: str) -> None:
    playlist_id = None
    page = None
    while True:
        res = yt.playlists().list(part="snippet", mine=True, maxResults=50, pageToken=page).execute()
        for p in res.get("items", []):
            if p["snippet"]["title"] == name:
                playlist_id = p["id"]
        page = res.get("nextPageToken")
        if playlist_id or not page:
            break
    if not playlist_id:
        playlist_id = yt.playlists().insert(part="snippet,status", body={
            "snippet": {"title": name, "defaultLanguage": lang},
            "status": {"privacyStatus": "public"},
        }).execute()["id"]
    yt.playlistItems().insert(part="snippet", body={
        "snippet": {"playlistId": playlist_id, "resourceId": {"kind": "youtube#video", "videoId": video_id}},
    }).execute()
