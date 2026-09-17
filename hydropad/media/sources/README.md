# media/sources/

A photograph for each water source, named after its ticker:

```
media/sources/MEAD.jpg      Lake Mead
media/sources/GRN.jpg       Greenland Core
media/sources/SAU.jpg       Sau Reservoir
```

`.jpg`, `.png`, `.webp`, `.avif` and `.svg` are all read. Square crops look
best: the register shows them at 38px and the token page at 54px, both cropped
to a square, so anything landscape loses its sides.

After adding or removing files:

```sh
node scripts/photos.js
```

That rewrites `photos.js`, which is the only list the pages consult. A source
with no file keeps the drawn water-drop glyph, and nothing is ever requested
that is not on disk.

Useful sizes: 240x240 is plenty. Keep each one under ~40 KB:

```sh
ffmpeg -i original.jpg -vf "scale=240:240:force_original_aspect_ratio=increase,crop=240:240" -q:v 6 MEAD.jpg
```

## Credits

Photographs need their attribution. Put one line per ticker in `CREDITS.txt`:

```
MEAD: Adam Photographer, CC BY-SA 4.0, via Wikimedia Commons
SAU: Someone Else, CC0
```

`scripts/photos.js` reads it into `PHOTO_CREDITS`, and the Sources page lists
every credit under the table.
