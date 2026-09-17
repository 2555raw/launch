# media/

Drop a filmed backdrop here and the site uses it instead of the drawn scene:

| File | What it is |
| --- | --- |
| `scene.mp4` | The loop. 1920x1080, H.264 (yuv420p), no audio track, `+faststart`. |
| `scene-poster.jpg` | First frame, ~120 KB. Shown before the video decodes and when a viewer has reduced motion or a metered connection. |

`motion.js` looks for `scene.mp4` on every page load. If it plays, the scene
gets the `filmed` class and the SVG layers and the water canvas are hidden; if
the file is absent, fails to decode, or the connection reports save-data, the
drawn scene stays exactly as it is. Nothing else needs changing.

Encoding, from a generated clip:

```sh
# 1. seamless loop: crossfade the last 0.8s over the first 0.8s
ffmpeg -i raw.mp4 -filter_complex \
  "[0:v]trim=0:9.2,setpts=PTS-STARTPTS[a]; \
   [0:v]trim=9.2:10,setpts=PTS-STARTPTS[b]; \
   [b][a]xfade=transition=fade:duration=0.8:offset=0[v]" \
  -map "[v]" -an loop.mp4

# 2. web encode
ffmpeg -i loop.mp4 -vf "scale=1920:1080:flags=lanczos" \
  -c:v libx264 -profile:v high -pix_fmt yuv420p \
  -crf 26 -preset slow -g 48 -movflags +faststart -an scene.mp4

# 3. poster
ffmpeg -i scene.mp4 -vframes 1 -q:v 4 scene-poster.jpg
```

Aim for 2-4 MB. Anything past 6 MB is worth another pass at `-crf`.

## The clip itself

Nothing here generates footage. The loop is made elsewhere (an image-to-video
model, or a camera) and dropped in. What the site needs from it:

- 1920x1080, 16:9, 24 or 25 fps
- no audio track at all (`-an`), so autoplay is never blocked
- a seamless loop: same framing at the first and last frame, or crossfaded as
  above
- motion small enough that headings stay readable over it

## Somewhere else on the page

The markup the site builds at runtime, if you ever want it by hand:

```html
<div class="scene">
  <video class="scene-video" autoplay muted loop playsinline
         preload="auto" poster="media/scene-poster.jpg" aria-hidden="true">
    <source src="media/scene.webm" type="video/webm">
    <source src="media/scene.mp4" type="video/mp4">
  </video>
  <div class="scene-veil"></div>
</div>
```

```css
.scene { position: fixed; inset: 0; z-index: -1; overflow: hidden; pointer-events: none; }
.scene-video { position: absolute; inset: 0; width: 100%; height: 100%;
               object-fit: cover; object-position: center 34%; }
.scene-veil { position: absolute; inset: 0; background: #fff; opacity: 0;
              transition: opacity .18s linear; }   /* opacity tracks scroll */
```
