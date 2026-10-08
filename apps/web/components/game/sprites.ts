/**
 * Original, procedurally drawn isometric art for Emberhold. Every building, troop and decoration
 * is a small canvas routine keyed by type, so swapping in bitmap sprites later only means
 * registering an image for that key in `SPRITE_OVERRIDES` (see `drawBuilding`).
 */

export const TILE_W = 48; // isometric tile width in px at zoom 1
export const TILE_H = 24;

export interface Palette {
  base: string;
  wall: string;
  roof: string;
  accent: string;
}

export const BUILDING_PALETTES: Record<string, Palette> = {
  town_hall: { base: '#5b4636', wall: '#d2a874', roof: '#b8362b', accent: '#ffd04d' },
  gold_mine: { base: '#4a3c2a', wall: '#9a7a4c', roof: '#6c5536', accent: '#ffd04d' },
  elixir_collector: { base: '#3b2d4f', wall: '#7a639c', roof: '#4b3a66', accent: '#c084fc' },
  gold_storage: { base: '#4f4228', wall: '#b8974f', roof: '#8a6d38', accent: '#ffe08a' },
  elixir_storage: { base: '#3a2b50', wall: '#8466b5', roof: '#5f4889', accent: '#d8b4fe' },
  barracks: { base: '#4a2e2e', wall: '#b0614f', roof: '#7a3f34', accent: '#ff9f43' },
  army_camp: { base: '#2f4a2f', wall: '#5f8a56', roof: '#9a6530', accent: '#ffb86b' },
  laboratory: { base: '#243c4a', wall: '#5495ae', roof: '#2d5a6d', accent: '#67e8f9' },
  builder_hut: { base: '#4a3a2a', wall: '#bd9663', roof: '#8a6540', accent: '#ffd04d' },
  clan_hall: { base: '#3b3448', wall: '#9484b3', roof: '#5f4e85', accent: '#ff9f43' },
  crystal_mine: { base: '#2a3a4a', wall: '#6383a3', roof: '#3f5a74', accent: '#34d399' },
  arrow_tower: { base: '#3a3a3a', wall: '#9a9a9a', roof: '#5a5a5a', accent: '#ffb86b' },
  cannon: { base: '#2f2f2f', wall: '#7a7a7a', roof: '#474747', accent: '#ff7a1a' },
  mortar: { base: '#33302a', wall: '#857763', roof: '#4d453a', accent: '#ff9f43' },
  mage_tower: { base: '#2e2a4a', wall: '#7466b3', roof: '#9b45c9', accent: '#c084fc' },
  wall: { base: '#5a5a62', wall: '#a6a6b2', roof: '#d0d0da', accent: '#e5e7eb' },
};

export const TROOP_COLORS: Record<string, { body: string; trim: string }> = {
  grunt: { body: '#e07a3a', trim: '#5a2e14' },
  ranger: { body: '#4caf50', trim: '#1b4d1f' },
  brute: { body: '#9c7a5a', trim: '#4a3220' },
  breacher: { body: '#e5e7eb', trim: '#7a1f1f' },
  sky_scout: { body: '#60a5fa', trim: '#1e3a8a' },
  pyromancer: { body: '#c084fc', trim: '#581c87' },
};

export const SPRITE_OVERRIDES: Record<string, HTMLImageElement> = {};

/** Project grid coordinates (tile units, can be fractional) to screen space. */
export function toScreen(gx: number, gy: number, zoom: number, ox: number, oy: number): { x: number; y: number } {
  return { x: ox + ((gx - gy) * TILE_W * zoom) / 2, y: oy + ((gx + gy) * TILE_H * zoom) / 2 };
}

/** Inverse projection: screen → fractional grid coordinates. */
export function toGrid(sx: number, sy: number, zoom: number, ox: number, oy: number): { gx: number; gy: number } {
  const dx = (sx - ox) / ((TILE_W * zoom) / 2);
  const dy = (sy - oy) / ((TILE_H * zoom) / 2);
  return { gx: (dx + dy) / 2, gy: (dy - dx) / 2 };
}

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (n & 255) + amount));
  return `rgb(${r},${g},${b})`;
}

/** Deterministic hash → [0,1) for scenery placement. */
function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function drawTile(ctx: CanvasRenderingContext2D, gx: number, gy: number, zoom: number, ox: number, oy: number, fill: string, stroke?: string) {
  const p = toScreen(gx, gy, zoom, ox, oy);
  const hw = (TILE_W * zoom) / 2;
  const hh = (TILE_H * zoom) / 2;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + hw, p.y + hh);
  ctx.lineTo(p.x, p.y + hh * 2);
  ctx.lineTo(p.x - hw, p.y + hh);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/** Draws a footprint (w x h tiles) as a flat diamond. */
export function drawFootprint(ctx: CanvasRenderingContext2D, gx: number, gy: number, size: number, zoom: number, ox: number, oy: number, fill: string, stroke?: string, h = size) {
  const a = toScreen(gx, gy, zoom, ox, oy);
  const b = toScreen(gx + size, gy, zoom, ox, oy);
  const c = toScreen(gx + size, gy + h, zoom, ox, oy);
  const d = toScreen(gx, gy + h, zoom, ox, oy);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

/** Isometric prism with a w x h tile footprint and `height` px (at zoom 1). */
function drawPrism(ctx: CanvasRenderingContext2D, gx: number, gy: number, w: number, h: number, height: number, zoom: number, ox: number, oy: number, pal: Palette, opts: { windows?: boolean; door?: boolean; trim?: string } = {}) {
  const hp = height * zoom;
  const top = (x: number, y: number) => {
    const p = toScreen(x, y, zoom, ox, oy);
    return { x: p.x, y: p.y - hp };
  };
  const a = top(gx, gy);
  const b = top(gx + w, gy);
  const c = top(gx + w, gy + h);
  const d = top(gx, gy + h);
  const bb = toScreen(gx + w, gy, zoom, ox, oy);
  const cc = toScreen(gx + w, gy + h, zoom, ox, oy);
  const dd = toScreen(gx, gy + h, zoom, ox, oy);
  // right face
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(cc.x, cc.y);
  ctx.lineTo(bb.x, bb.y);
  ctx.closePath();
  ctx.fillStyle = shade(pal.wall, -45);
  ctx.fill();
  // left face
  ctx.beginPath();
  ctx.moveTo(d.x, d.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(cc.x, cc.y);
  ctx.lineTo(dd.x, dd.y);
  ctx.closePath();
  ctx.fillStyle = pal.wall;
  ctx.fill();
  // top
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fillStyle = pal.roof;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  if (opts.trim) {
    ctx.strokeStyle = opts.trim;
    ctx.lineWidth = 2 * zoom;
    ctx.beginPath();
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  if (opts.windows && zoom > 0.45) {
    // dark windows on the left face
    const n = Math.max(1, Math.floor(w));
    for (let i = 0; i < n; i++) {
      const p = toScreen(gx + (i + 0.5) * (w / n), gy + h, zoom, ox, oy);
      ctx.fillStyle = 'rgba(20,16,30,.8)';
      ctx.fillRect(p.x - 2.5 * zoom, p.y - hp * 0.75, 5 * zoom, 6 * zoom);
      ctx.fillStyle = 'rgba(255,214,120,.35)';
      ctx.fillRect(p.x - 1.5 * zoom, p.y - hp * 0.75 + 1.5 * zoom, 3 * zoom, 2 * zoom);
    }
  }
  if (opts.door) {
    const p = toScreen(gx + w * 0.5, gy + h, zoom, ox, oy);
    ctx.fillStyle = 'rgba(30,20,15,.9)';
    ctx.beginPath();
    ctx.roundRect(p.x - 4 * zoom, p.y - 12 * zoom, 8 * zoom, 12 * zoom, [4 * zoom, 4 * zoom, 0, 0]);
    ctx.fill();
  }
}

function drawRoofPeak(ctx: CanvasRenderingContext2D, gx: number, gy: number, w: number, h: number, baseH: number, peakH: number, zoom: number, ox: number, oy: number, color: string) {
  const hp = baseH * zoom;
  const top = (x: number, y: number) => {
    const p = toScreen(x, y, zoom, ox, oy);
    return { x: p.x, y: p.y - hp };
  };
  const a = top(gx, gy);
  const b = top(gx + w, gy);
  const c = top(gx + w, gy + h);
  const d = top(gx, gy + h);
  const center = toScreen(gx + w / 2, gy + h / 2, zoom, ox, oy);
  const peak = { x: center.x, y: center.y - hp - peakH * zoom };
  const faces: Array<[{ x: number; y: number }, { x: number; y: number }, number]> = [
    [a, b, -30],
    [b, c, -65],
    [c, d, 0],
    [d, a, -15],
  ];
  for (const [p1, p2, s] of faces) {
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(peak.x, peak.y);
    ctx.closePath();
    ctx.fillStyle = shade(color, s);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.3)';
    ctx.stroke();
  }
}

function drawCylinder(ctx: CanvasRenderingContext2D, gx: number, gy: number, size: number, height: number, zoom: number, ox: number, oy: number, pal: Palette, opts: { crenels?: boolean; bands?: number } = {}) {
  const c = toScreen(gx + size / 2, gy + size / 2, zoom, ox, oy);
  const rx = ((size * TILE_W * zoom) / 2) * 0.42;
  const ry = rx * 0.5;
  const h = height * zoom;
  const grad = ctx.createLinearGradient(c.x - rx, 0, c.x + rx, 0);
  grad.addColorStop(0, shade(pal.wall, 10));
  grad.addColorStop(0.55, pal.wall);
  grad.addColorStop(1, shade(pal.wall, -70));
  ctx.beginPath();
  ctx.moveTo(c.x - rx, c.y);
  ctx.lineTo(c.x - rx, c.y - h);
  ctx.ellipse(c.x, c.y - h, rx, ry, 0, Math.PI, 0, false);
  ctx.lineTo(c.x + rx, c.y);
  ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI, false);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  if (opts.bands) {
    ctx.strokeStyle = 'rgba(0,0,0,.25)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= opts.bands; i++) {
      const yy = c.y - (h * i) / (opts.bands + 1);
      ctx.beginPath();
      ctx.ellipse(c.x, yy, rx, ry, 0, 0, Math.PI, false);
      ctx.stroke();
    }
  }
  ctx.beginPath();
  ctx.ellipse(c.x, c.y - h, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = pal.roof;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.35)';
  ctx.stroke();
  if (opts.crenels) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const px = c.x + Math.cos(a) * rx * 0.9;
      const py = c.y - h + Math.sin(a) * ry * 0.9;
      ctx.fillStyle = i < 4 ? shade(pal.wall, -30) : pal.wall;
      ctx.fillRect(px - 2 * zoom, py - 5 * zoom, 4 * zoom, 5 * zoom);
    }
  }
}

function drawOrb(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.3, color);
  g.addColorStop(1, shade(color, -80));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawFlag(ctx: CanvasRenderingContext2D, x: number, y: number, zoom: number, color: string, height = 18) {
  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth = 1.5 * zoom;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - height * zoom);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - height * zoom);
  ctx.lineTo(x + 9 * zoom, y - (height - 3) * zoom);
  ctx.lineTo(x, y - (height - 7) * zoom);
  ctx.closePath();
  ctx.fill();
}

export interface DrawBuildingOptions {
  type: string;
  level: number;
  x: number;
  y: number;
  size: number;
  zoom: number;
  ox: number;
  oy: number;
  state?: 'IDLE' | 'CONSTRUCTING' | 'UPGRADING';
  selected?: boolean;
  invalid?: boolean;
  destroyed?: boolean;
  hpRatio?: number;
  ghost?: boolean;
  /** for walls: which neighbours are also walls (n = -y, e = +x, s = +y, w = -x) */
  wallLinks?: { n?: boolean; e: boolean; s: boolean; w?: boolean };
  /** animation clock in ms, for subtle idle effects */
  t?: number;
}

export function drawBuilding(ctx: CanvasRenderingContext2D, o: DrawBuildingOptions) {
  const pal = BUILDING_PALETTES[o.type] ?? BUILDING_PALETTES.builder_hut;
  const { x, y, size, zoom, ox, oy } = o;
  const t = o.t ?? 0;
  ctx.save();
  if (o.ghost) ctx.globalAlpha = 0.65;
  if (o.type !== 'wall' || o.selected || o.invalid || o.ghost) {
    drawFootprint(ctx, x, y, size, zoom, ox, oy, o.invalid ? 'rgba(244,63,94,.4)' : o.selected ? 'rgba(255,159,67,.4)' : o.destroyed ? 'rgba(0,0,0,.45)' : 'rgba(0,0,0,.16)', o.selected || o.invalid ? (o.invalid ? '#fb7185' : '#ffb86b') : undefined);
  }
  const override = SPRITE_OVERRIDES[o.type];
  if (override) {
    const p = toScreen(x + size / 2, y + size, zoom, ox, oy);
    const w = size * TILE_W * zoom;
    ctx.drawImage(override, p.x - w / 2, p.y - w, w, w);
    ctx.restore();
    return;
  }
  if (o.destroyed) {
    for (let i = 0; i < size * 3; i++) {
      const p = toScreen(x + ((i * 7) % (size * 10)) / 10, y + ((i * 13) % (size * 10)) / 10, zoom, ox, oy);
      ctx.fillStyle = i % 2 ? '#3a3a3a' : '#262626';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 4 * zoom, 5 * zoom, 2.5 * zoom, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // smoke
    ctx.fillStyle = 'rgba(80,80,80,.35)';
    const c = toScreen(x + size / 2, y + size / 2, zoom, ox, oy);
    for (let i = 0; i < 3; i++) {
      const phase = ((t / 1200 + i / 3) % 1);
      ctx.globalAlpha = 0.35 * (1 - phase);
      ctx.beginPath();
      ctx.arc(c.x + Math.sin(phase * 6 + i) * 4 * zoom, c.y - phase * 30 * zoom, (4 + phase * 8) * zoom, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }
  const lvl = Math.max(1, o.level);
  const center = toScreen(x + size / 2, y + size / 2, zoom, ox, oy);
  switch (o.type) {
    case 'wall': {
      const wh = 11 + Math.min(lvl, 8) * 1.4;
      const links = o.wallLinks ?? { e: false, s: false };
      const barPal = { ...pal, roof: shade(pal.roof, -12) };
      // connecting curtain walls, drawn from the post centre to the neighbour's centre
      if (links.n) drawPrism(ctx, x + 0.28, y - 0.5, 0.44, 1, wh - 2, zoom, ox, oy, barPal);
      if (links.w) drawPrism(ctx, x - 0.5, y + 0.28, 1, 0.44, wh - 2, zoom, ox, oy, barPal);
      if (links.e) drawPrism(ctx, x + 0.5, y + 0.28, 1, 0.44, wh - 2, zoom, ox, oy, barPal);
      if (links.s) drawPrism(ctx, x + 0.28, y + 0.5, 0.44, 1, wh - 2, zoom, ox, oy, barPal);
      drawPrism(ctx, x + 0.18, y + 0.18, 0.64, 0.64, wh, zoom, ox, oy, { ...pal, roof: lvl >= 5 ? '#e8d9a0' : pal.roof });
      break;
    }
    case 'town_hall': {
      const h = 24 + lvl * 2;
      drawPrism(ctx, x + 0.15, y + 0.15, size - 0.3, size - 0.3, h, zoom, ox, oy, pal, { windows: true, door: true, trim: shade(pal.wall, 25) });
      drawRoofPeak(ctx, x + 0.15, y + 0.15, size - 0.3, size - 0.3, h, 16 + lvl, zoom, ox, oy, pal.roof);
      // corner towers at higher levels
      if (lvl >= 3) {
        drawCylinder(ctx, x + size - 1, y - 0.1, 1, h + 10, zoom, ox, oy, { ...pal, roof: shade(pal.roof, -20) }, { crenels: true });
        drawCylinder(ctx, x - 0.1, y + size - 1, 1, h + 10, zoom, ox, oy, { ...pal, roof: shade(pal.roof, -20) }, { crenels: true });
      }
      drawFlag(ctx, center.x, center.y - (h + 16 + lvl) * zoom, zoom, pal.accent, 16);
      break;
    }
    case 'gold_mine':
    case 'elixir_collector': {
      drawPrism(ctx, x + 0.2, y + 0.2, size - 0.4, size - 0.4, 6, zoom, ox, oy, { ...pal, roof: shade(pal.base, 20) });
      // mine shaft frame
      drawPrism(ctx, x + 0.5, y + 1.6, 1.2, 1.2, 14, zoom, ox, oy, { ...pal, roof: pal.roof });
      // pump / drill tower
      drawCylinder(ctx, x + 1.4, y + 0.4, 1.3, 16 + lvl, zoom, ox, oy, { ...pal, roof: shade(pal.wall, -20) }, { bands: 2 });
      const bob = Math.sin(t / 400) * 2 * zoom;
      const top = toScreen(x + 2.05, y + 1.05, zoom, ox, oy);
      drawOrb(ctx, top.x, top.y - (18 + lvl) * zoom + bob, 4 * zoom, pal.accent);
      break;
    }
    case 'gold_storage':
    case 'elixir_storage': {
      drawPrism(ctx, x + 0.2, y + 0.2, size - 0.4, size - 0.4, 5, zoom, ox, oy, { ...pal, roof: shade(pal.base, 10) });
      drawCylinder(ctx, x + 0.5, y + 0.5, size - 1, 16 + lvl * 2, zoom, ox, oy, pal, { bands: 2 });
      // glass dome showing the resource
      drawOrb(ctx, center.x, center.y - (16 + lvl * 2) * zoom, (size * 4.5) * zoom, pal.accent);
      break;
    }
    case 'barracks': {
      const h = 12 + lvl;
      drawPrism(ctx, x + 0.15, y + 0.15, size - 0.3, size - 0.3, h, zoom, ox, oy, pal, { windows: true, door: true });
      drawRoofPeak(ctx, x + 0.15, y + 0.15, size - 0.3, size - 0.3, h, 9, zoom, ox, oy, pal.roof);
      const f = toScreen(x + size - 0.3, y + 0.3, zoom, ox, oy);
      drawFlag(ctx, f.x, f.y - h * zoom, zoom, pal.accent, 14);
      break;
    }
    case 'army_camp': {
      drawFootprint(ctx, x, y, size, zoom, ox, oy, 'rgba(70,110,60,.55)');
      for (const [dx, dy] of [
        [0.4, 0.4],
        [2.2, 0.4],
        [0.4, 2.2],
        [2.2, 2.2],
      ]) drawRoofPeak(ctx, x + dx, y + dy, 1.4, 1.4, 0, 12 + lvl, zoom, ox, oy, pal.roof);
      // campfire
      const fire = toScreen(x + 2, y + 2, zoom, ox, oy);
      ctx.fillStyle = '#3a2a1a';
      ctx.beginPath();
      ctx.ellipse(fire.x, fire.y, 5 * zoom, 2.5 * zoom, 0, 0, Math.PI * 2);
      ctx.fill();
      drawOrb(ctx, fire.x, fire.y - 3 * zoom + Math.sin(t / 150) * zoom, 2.5 * zoom, '#ff7a1a');
      break;
    }
    case 'laboratory': {
      drawPrism(ctx, x + 0.15, y + 0.15, size - 0.3, size - 0.3, 14 + lvl, zoom, ox, oy, pal, { windows: true });
      drawCylinder(ctx, x + 0.9, y + 0.9, size - 1.8, 24 + lvl * 2, zoom, ox, oy, { ...pal, roof: shade(pal.wall, -10) }, { bands: 3 });
      drawOrb(ctx, center.x, center.y - (26 + lvl * 2) * zoom, 5 * zoom, pal.accent);
      break;
    }
    case 'builder_hut': {
      drawPrism(ctx, x + 0.15, y + 0.15, size - 0.3, size - 0.3, 8, zoom, ox, oy, pal, { door: true });
      drawRoofPeak(ctx, x + 0.15, y + 0.15, size - 0.3, size - 0.3, 8, 9, zoom, ox, oy, pal.roof);
      break;
    }
    case 'clan_hall': {
      const h = 18 + lvl * 2;
      drawPrism(ctx, x + 0.15, y + 0.15, size - 0.3, size - 0.3, h, zoom, ox, oy, pal, { windows: true, door: true, trim: pal.accent });
      drawRoofPeak(ctx, x + 0.15, y + 0.15, size - 0.3, size - 0.3, h, 12, zoom, ox, oy, pal.accent);
      drawFlag(ctx, center.x, center.y - (h + 12) * zoom, zoom, '#ff9f43', 14);
      break;
    }
    case 'crystal_mine': {
      drawPrism(ctx, x + 0.1, y + 0.1, size - 0.2, size - 0.2, 6, zoom, ox, oy, { ...pal, roof: shade(pal.base, 10) });
      for (const [dx, dy, hh] of [
        [0.5, 0.5, 14],
        [1.1, 0.9, 20 + lvl * 3],
        [0.6, 1.2, 11],
      ]) drawRoofPeak(ctx, x + dx, y + dy, 0.6, 0.6, 2, hh, zoom, ox, oy, pal.accent);
      break;
    }
    case 'arrow_tower': {
      drawCylinder(ctx, x + 0.5, y + 0.5, size - 1, 30 + lvl * 2, zoom, ox, oy, pal, { crenels: true, bands: 3 });
      // archer post
      drawOrb(ctx, center.x, center.y - (34 + lvl * 2) * zoom, 3 * zoom, pal.accent);
      break;
    }
    case 'cannon': {
      drawPrism(ctx, x + 0.3, y + 0.3, size - 0.6, size - 0.6, 7, zoom, ox, oy, pal);
      drawCylinder(ctx, x + 0.8, y + 0.8, size - 1.6, 10 + lvl, zoom, ox, oy, { ...pal, roof: shade(pal.wall, -30) }, { bands: 1 });
      // barrel pointing south-east
      const b0 = { x: center.x, y: center.y - (12 + lvl) * zoom };
      ctx.strokeStyle = '#1f1f1f';
      ctx.lineWidth = 6 * zoom;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(b0.x, b0.y);
      ctx.lineTo(b0.x + 16 * zoom, b0.y + 6 * zoom);
      ctx.stroke();
      ctx.strokeStyle = '#5a5a5a';
      ctx.lineWidth = 3 * zoom;
      ctx.beginPath();
      ctx.moveTo(b0.x, b0.y);
      ctx.lineTo(b0.x + 15 * zoom, b0.y + 5.5 * zoom);
      ctx.stroke();
      break;
    }
    case 'mortar': {
      drawCylinder(ctx, x + 0.4, y + 0.4, size - 0.8, 8 + lvl, zoom, ox, oy, pal, { bands: 1 });
      drawCylinder(ctx, x + 1, y + 1, size - 2, 18 + lvl, zoom, ox, oy, { ...pal, wall: '#2b2b2b', roof: '#0e0e0e' });
      break;
    }
    case 'mage_tower': {
      drawCylinder(ctx, x + 0.5, y + 0.5, size - 1, 28 + lvl * 3, zoom, ox, oy, pal, { bands: 4 });
      drawRoofPeak(ctx, x + 0.5, y + 0.5, size - 1, size - 1, 28 + lvl * 3, 18, zoom, ox, oy, pal.accent);
      drawOrb(ctx, center.x, center.y - (48 + lvl * 3) * zoom + Math.sin(t / 500) * 2 * zoom, 4 * zoom, pal.accent);
      break;
    }
    default:
      drawPrism(ctx, x + 0.2, y + 0.2, size - 0.4, size - 0.4, 14, zoom, ox, oy, pal);
  }
  if (o.type !== 'wall' && zoom >= 0.7) {
    const p = toScreen(x + size / 2, y + size, zoom, ox, oy);
    ctx.font = `bold ${Math.round(9 * zoom)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.beginPath();
    ctx.roundRect(p.x - 11 * zoom, p.y - 3 * zoom, 22 * zoom, 11 * zoom, 4 * zoom);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(`L${lvl}`, p.x, p.y + 5.5 * zoom);
  }
  if (o.state && o.state !== 'IDLE') {
    const p = toScreen(x + size / 2, y + size / 2, zoom, ox, oy);
    const yy = p.y - 42 * zoom + Math.sin(t / 300) * 2 * zoom;
    ctx.fillStyle = '#ffd04d';
    ctx.beginPath();
    ctx.arc(p.x, yy, 7 * zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.font = `bold ${Math.round(9 * zoom)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('⚒', p.x, yy + 3 * zoom);
  }
  if (o.hpRatio !== undefined && o.hpRatio < 1) {
    const p = toScreen(x + size / 2, y, zoom, ox, oy);
    const w = 28 * zoom;
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(p.x - w / 2, p.y - 8 * zoom, w, 4 * zoom);
    ctx.fillStyle = o.hpRatio > 0.5 ? '#34d399' : o.hpRatio > 0.25 ? '#ffd04d' : '#fb7185';
    ctx.fillRect(p.x - w / 2, p.y - 8 * zoom, w * Math.max(0, o.hpRatio), 4 * zoom);
  }
  ctx.restore();
}

export function drawTroop(ctx: CanvasRenderingContext2D, troopType: string, gx: number, gy: number, zoom: number, ox: number, oy: number, hpRatio: number, flying: boolean, t = 0) {
  const c = TROOP_COLORS[troopType] ?? { body: '#ddd', trim: '#333' };
  const p = toScreen(gx, gy, zoom, ox, oy);
  const lift = flying ? 22 * zoom + Math.sin(t / 250) * 2 * zoom : 0;
  const big = troopType === 'brute';
  const r = (big ? 7 : 5) * zoom;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, 6 * zoom, 3 * zoom, 0, 0, Math.PI * 2);
  ctx.fill();
  // body
  ctx.fillStyle = shade(c.body, -30);
  ctx.beginPath();
  ctx.roundRect(p.x - r * 0.8, p.y - 9 * zoom - lift, r * 1.6, 9 * zoom, 3 * zoom);
  ctx.fill();
  // head
  ctx.fillStyle = c.body;
  ctx.beginPath();
  ctx.arc(p.x, p.y - 11 * zoom - lift, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = c.trim;
  ctx.lineWidth = 1.5 * zoom;
  ctx.stroke();
  // weapon / wings
  if (flying) {
    ctx.strokeStyle = c.body;
    ctx.lineWidth = 2 * zoom;
    const flap = Math.sin(t / 90) * 3 * zoom;
    ctx.beginPath();
    ctx.moveTo(p.x - r * 2.2, p.y - 12 * zoom - lift - flap);
    ctx.lineTo(p.x, p.y - 8 * zoom - lift);
    ctx.lineTo(p.x + r * 2.2, p.y - 12 * zoom - lift - flap);
    ctx.stroke();
  } else if (troopType === 'ranger') {
    ctx.strokeStyle = '#8b5a2b';
    ctx.lineWidth = 1.5 * zoom;
    ctx.beginPath();
    ctx.arc(p.x + r * 1.3, p.y - 9 * zoom, r * 1.1, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
  } else if (troopType === 'grunt' || troopType === 'brute') {
    ctx.strokeStyle = '#9aa0a6';
    ctx.lineWidth = 2 * zoom;
    ctx.beginPath();
    ctx.moveTo(p.x + r, p.y - 8 * zoom);
    ctx.lineTo(p.x + r * 2.4, p.y - 16 * zoom);
    ctx.stroke();
  } else if (troopType === 'pyromancer') {
    drawOrb(ctx, p.x + r * 1.6, p.y - 14 * zoom, 2.5 * zoom, '#ff7a1a');
  }
  if (hpRatio < 1) {
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(p.x - 7 * zoom, p.y - 20 * zoom - lift, 14 * zoom, 2.5 * zoom);
    ctx.fillStyle = hpRatio > 0.5 ? '#34d399' : '#fb7185';
    ctx.fillRect(p.x - 7 * zoom, p.y - 20 * zoom - lift, 14 * zoom * hpRatio, 2.5 * zoom);
  }
  ctx.restore();
}

// ── Terrain & scenery ─────────────────────────────────────────────────────────

const GRASS = ['#3f7a3f', '#3a7239', '#437f42', '#386d38'];
const OUTER = ['#2f5e31', '#2b562d', '#335f34'];
const SCENERY_RING = 9;

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, zoom: number, variant: number) {
  const s = (0.8 + variant * 0.5) * zoom;
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath();
  ctx.ellipse(x, y, 8 * s, 4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5a3a1e';
  ctx.fillRect(x - 1.5 * s, y - 10 * s, 3 * s, 10 * s);
  const greens = ['#2e7d32', '#36903a', '#246b28'];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = greens[(i + Math.floor(variant * 3)) % 3];
    ctx.beginPath();
    ctx.ellipse(x + (i - 1) * 3 * s, y - (14 + i * 4) * s, (8 - i * 1.5) * s, (6 - i) * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRock(ctx: CanvasRenderingContext2D, x: number, y: number, zoom: number, variant: number) {
  const s = (0.7 + variant * 0.6) * zoom;
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath();
  ctx.ellipse(x, y + 1 * s, 8 * s, 3.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7d8590';
  ctx.beginPath();
  ctx.moveTo(x - 8 * s, y);
  ctx.lineTo(x - 4 * s, y - 7 * s);
  ctx.lineTo(x + 3 * s, y - 8 * s);
  ctx.lineTo(x + 8 * s, y - 2 * s);
  ctx.lineTo(x + 5 * s, y + 2 * s);
  ctx.lineTo(x - 5 * s, y + 2 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#a3abb5';
  ctx.beginPath();
  ctx.moveTo(x - 4 * s, y - 7 * s);
  ctx.lineTo(x + 3 * s, y - 8 * s);
  ctx.lineTo(x + 1 * s, y - 3 * s);
  ctx.closePath();
  ctx.fill();
}

function drawBush(ctx: CanvasRenderingContext2D, x: number, y: number, zoom: number) {
  ctx.fillStyle = '#2f7a36';
  for (const [dx, dy, r] of [
    [-4, 0, 4],
    [3, -1, 4.5],
    [0, -3, 4],
  ]) {
    ctx.beginPath();
    ctx.ellipse(x + dx * zoom, y + dy * zoom, r * zoom, r * 0.75 * zoom, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export interface TerrainOptions {
  gridSize: number;
  zoom: number;
  ox: number;
  oy: number;
  seed: number;
  mask?: Uint8Array;
  /** tiles occupied by buildings (no grass tufts there) */
  occupied?: Uint8Array;
}

/**
 * Draws the whole landscape: the buildable diamond with varied grass, a ring of wild land around
 * it with trees/rocks/bushes, and water beyond the southern edge. Deterministic per seed.
 */
export function drawTerrain(ctx: CanvasRenderingContext2D, o: TerrainOptions) {
  const { gridSize: g, zoom, ox, oy, seed } = o;
  const R = SCENERY_RING;
  // outer land + water
  for (let y = -R; y < g + R; y++) {
    for (let x = -R; x < g + R; x++) {
      const inside = x >= 0 && y >= 0 && x < g && y < g;
      if (inside) continue;
      const water = x + y > g * 2 - 2 + R * 0.6; // beyond the bottom vertex
      const hv = hash(x, y, seed);
      if (water) {
        drawTile(ctx, x, y, zoom, ox, oy, hv > 0.5 ? '#2a6f9e' : '#2b76a8');
      } else {
        drawTile(ctx, x, y, zoom, ox, oy, OUTER[Math.floor(hv * OUTER.length)]);
      }
    }
  }
  // shoreline foam
  ctx.strokeStyle = 'rgba(255,255,255,.35)';
  ctx.lineWidth = 2 * zoom;
  for (let i = -R; i < g + R; i += 2) {
    const a = toScreen(i, g * 2 - 2 + R * 0.6 - i, zoom, ox, oy);
    ctx.beginPath();
    ctx.arc(a.x, a.y + 4 * zoom, 5 * zoom, Math.PI, 0);
    ctx.stroke();
  }
  // buildable field
  for (let y = 0; y < g; y++) {
    for (let x = 0; x < g; x++) {
      const blocked = o.mask ? o.mask[y * g + x] === 1 : false;
      const hv = hash(x, y, seed + 7);
      const base = GRASS[Math.floor(hv * GRASS.length)];
      drawTile(ctx, x, y, zoom, ox, oy, blocked ? 'rgba(244,63,94,.22)' : base);
      if (blocked) continue;
      if (!o.occupied || o.occupied[y * g + x] === 0) {
        if (hv > 0.93 && zoom > 0.5) {
          const p = toScreen(x + 0.5, y + 0.5, zoom, ox, oy);
          ctx.strokeStyle = '#5aa650';
          ctx.lineWidth = 1 * zoom;
          ctx.beginPath();
          ctx.moveTo(p.x - 2 * zoom, p.y);
          ctx.lineTo(p.x - 1 * zoom, p.y - 4 * zoom);
          ctx.moveTo(p.x + 1 * zoom, p.y);
          ctx.lineTo(p.x + 2 * zoom, p.y - 4 * zoom);
          ctx.stroke();
        }
      }
    }
  }
  // field border
  const a = toScreen(0, 0, zoom, ox, oy);
  const b = toScreen(g, 0, zoom, ox, oy);
  const c = toScreen(g, g, zoom, ox, oy);
  const d = toScreen(0, g, zoom, ox, oy);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.strokeStyle = 'rgba(255,255,255,.14)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // scenery (sorted by depth so trees overlap correctly)
  const items: Array<{ x: number; y: number; kind: number; v: number }> = [];
  for (let y = -R; y < g + R; y++) {
    for (let x = -R; x < g + R; x++) {
      const inside = x >= 0 && y >= 0 && x < g && y < g;
      if (inside) continue;
      const water = x + y > g * 2 - 2 + R * 0.6;
      if (water) continue;
      const hv = hash(x, y, seed + 99);
      if (hv < 0.13) items.push({ x, y, kind: 0, v: hash(x, y, seed + 5) });
      else if (hv < 0.16) items.push({ x, y, kind: 1, v: hash(x, y, seed + 6) });
      else if (hv < 0.2) items.push({ x, y, kind: 2, v: 0 });
    }
  }
  items.sort((p, q) => p.x + p.y - (q.x + q.y));
  for (const it of items) {
    const p = toScreen(it.x + 0.5, it.y + 0.5, zoom, ox, oy);
    if (it.kind === 0) drawTree(ctx, p.x, p.y + 6 * zoom, zoom, it.v);
    else if (it.kind === 1) drawRock(ctx, p.x, p.y + 4 * zoom, zoom, it.v);
    else drawBush(ctx, p.x, p.y + 4 * zoom, zoom);
  }
}

/** Legacy helper kept for callers that only need the flat field. */
export function drawGround(ctx: CanvasRenderingContext2D, gridSize: number, zoom: number, ox: number, oy: number, mask?: Uint8Array) {
  drawTerrain(ctx, { gridSize, zoom, ox, oy, seed: 1, mask });
}

/** Caches the terrain into an offscreen canvas keyed by camera + size so animated scenes stay cheap. */
export class TerrainCache {
  private canvas: HTMLCanvasElement | null = null;
  private key = '';
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number, o: TerrainOptions) {
    const key = `${w}|${h}|${dpr}|${o.zoom.toFixed(4)}|${o.ox.toFixed(1)}|${o.oy.toFixed(1)}|${o.seed}|${o.gridSize}|${o.mask ? 'm' : ''}|${o.occupied ? hashBytes(o.occupied) : ''}`;
    if (!this.canvas || this.key !== key) {
      this.canvas = this.canvas ?? document.createElement('canvas');
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      const c = this.canvas.getContext('2d')!;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      drawTerrain(c, o);
      this.key = key;
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.canvas, 0, 0);
    ctx.restore();
  }
}

function hashBytes(b: Uint8Array): number {
  let h = 2166136261;
  for (let i = 0; i < b.length; i++) h = Math.imul(h ^ b[i], 16777619);
  return h >>> 0;
}
