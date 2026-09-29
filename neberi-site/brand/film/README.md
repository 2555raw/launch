# Nebari film and GIF

| File | What it is |
| --- | --- |
| `nebari.mp4` | 30 s film, 1920x1080, 30 fps, H.264 + AAC, with an original soundtrack. |
| `nebari.gif` | 3 s loop of the real home page banner, 960x540, 20 fps. |
| `film.html` | The film itself: every frame is `render(t)`, a pure function of time. |
| `build.js` | Renders `film.html` frame by frame and encodes it with the music. |
| `gif.js` | Serves the site, pauses every CSS animation, steps it frame by frame and writes the GIF. |
| `shots/` | Screenshots of the real site used in the film (home, launch form, token page). |

```bash
node build.js nebari.mp4           # the film (about 3 minutes)
node build.js --stills 5,12,20     # PNG stills at those seconds, to check a scene
node gif.js nebari.gif             # the GIF
```

Needs Chromium (`CHROME`), ffmpeg (`FFMPEG`, or `pip install imageio-ffmpeg`) and numpy for
the soundtrack, which is synthesised by `payence/video/music.py`: original, nothing licensed.

The film follows the reference's grammar in the site's own palette: words that arrive one by
one out of a blur, a ruler with a playhead, real screens zooming in, a word that turns into an
asset chip, typing, a halftone word that settles to solid, and an end card with the mark.
