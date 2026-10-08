# Replacing the procedural art

All buildings and troops are drawn procedurally in `components/game/sprites.ts` (original art, no
third-party assets). To swap a building for a bitmap sprite, load an image and register it:

```ts
import { SPRITE_OVERRIDES } from '@/components/game/sprites';
const img = new Image();
img.src = '/sprites/town_hall.png';
img.onload = () => { SPRITE_OVERRIDES['town_hall'] = img; };
```

`drawBuilding` draws the image bottom-centred on the footprint, sized to `size * 48px * zoom`
(width = height). Isometric sprites should be authored on a 2:1 tile (48×24 px per tile at zoom 1).
Drop your PNGs in this folder.
