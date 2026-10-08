/**
 * Original, procedurally drawn isometric art for Emberhold. Every building and troop is a small
 * canvas routine keyed by type, so swapping in bitmap sprites later only means registering an
 * image for that key in `SPRITE_OVERRIDES` (see `drawBuilding`).
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
  town_hall: { base: '#5b4636', wall: '#c89b6a', roof: '#b03a2e', accent: '#ffd04d' },
  gold_mine: { base: '#4a3c2a', wall: '#8d7049', roof: '#6c5536', accent: '#ffd04d' },
  elixir_collector: { base: '#3b2d4f', wall: '#6f5a8f', roof: '#4b3a66', accent: '#c084fc' },
  gold_storage: { base: '#4f4228', wall: '#a78b4e', roof: '#7d6436', accent: '#ffe08a' },
  elixir_storage: { base: '#3a2b50', wall: '#7a5fa8', roof: '#5a4580', accent: '#d8b4fe' },
  barracks: { base: '#4a2e2e', wall: '#a35a4c', roof: '#6d3b32', accent: '#ff9f43' },
  army_camp: { base: '#2f4a2f', wall: '#5f8a56', roof: '#8b5a2b', accent: '#ffb86b' },
  laboratory: { base: '#243c4a', wall: '#4e8ba3', roof: '#2d5a6d', accent: '#67e8f9' },
  builder_hut: { base: '#4a3a2a', wall: '#b08a5a', roof: '#7c5a36', accent: '#ffd04d' },
  clan_hall: { base: '#3b3448', wall: '#8a7aa8', roof: '#5a4a7a', accent: '#ff9f43' },
  crystal_mine: { base: '#2a3a4a', wall: '#5b7a9a', roof: '#3f5a74', accent: '#34d399' },
  arrow_tower: { base: '#3a3a3a', wall: '#8a8a8a', roof: '#5a5a5a', accent: '#ffb86b' },
  cannon: { base: '#2f2f2f', wall: '#6e6e6e', roof: '#3f3f3f', accent: '#ff7a1a' },
  mortar: { base: '#33302a', wall: '#776c5a', roof: '#4d453a', accent: '#ff9f43' },
  mage_tower: { base: '#2e2a4a', wall: '#6d5fa8', roof: '#8a3ab8', accent: '#c084fc' },
  wall: { base: '#5a5a62', wall: '#9a9aa6', roof: '#c4c4cf', accent: '#e5e7eb' },
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

/** Draws a footprint (size x size tiles) as a flat diamond. */
export function drawFootprint(ctx: CanvasRenderingContext2D, gx: number, gy: number, size: number, zoom: number, ox: number, oy: number, fill: string, stroke?: string) {
  const a = toScreen(gx, gy, zoom, ox, oy);
  const b = toScreen(gx + size, gy, zoom, ox, oy);
  const c = toScreen(gx + size, gy + size, zoom, ox, oy);
  const d = toScreen(gx, gy + size, zoom, ox, oy);
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

/** Draws an isometric box of `size` tiles footprint and `height` px (at zoom 1). */
function drawBox(ctx: CanvasRenderingContext2D, gx: number, gy: number, size: number, height: number, zoom: number, ox: number, oy: number, pal: Palette) {
  const h = height * zoom;
  const top = (x: number, y: number) => {
    const p = toScreen(x, y, zoom, ox, oy);
    return { x: p.x, y: p.y - h };
  };
  const a = top(gx, gy);
  const b = top(gx + size, gy);
  const c = top(gx + size, gy + size);
  const d = top(gx, gy + size);
  const bb = toScreen(gx + size, gy, zoom, ox, oy);
  const cc = toScreen(gx + size, gy + size, zoom, ox, oy);
  const dd = toScreen(gx, gy + size, zoom, ox, oy);
  // right wall (south-east face)
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(cc.x, cc.y);
  ctx.lineTo(bb.x, bb.y);
  ctx.closePath();
  ctx.fillStyle = shade(pal.wall, -40);
  ctx.fill();
  // left wall (south-west face)
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
}

function drawRoofPeak(ctx: CanvasRenderingContext2D, gx: number, gy: number, size: number, baseH: number, peakH: number, zoom: number, ox: number, oy: number, color: string) {
  const h = baseH * zoom;
  const top = (x: number, y: number) => {
    const p = toScreen(x, y, zoom, ox, oy);
    return { x: p.x, y: p.y - h };
  };
  const a = top(gx, gy);
  const b = top(gx + size, gy);
  const c = top(gx + size, gy + size);
  const d = top(gx, gy + size);
  const center = toScreen(gx + size / 2, gy + size / 2, zoom, ox, oy);
  const peak = { x: center.x, y: center.y - h - peakH * zoom };
  const faces: Array<[{ x: number; y: number }, { x: number; y: number }, number]> = [
    [a, b, -30],
    [b, c, -60],
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

function drawCylinder(ctx: CanvasRenderingContext2D, gx: number, gy: number, size: number, height: number, zoom: number, ox: number, oy: number, pal: Palette) {
  const c = toScreen(gx + size / 2, gy + size / 2, zoom, ox, oy);
  const rx = (size * TILE_W * zoom) / 2 * 0.42;
  const ry = rx * 0.5;
  const h = height * zoom;
  const grad = ctx.createLinearGradient(c.x - rx, 0, c.x + rx, 0);
  grad.addColorStop(0, pal.wall);
  grad.addColorStop(1, shade(pal.wall, -60));
  ctx.beginPath();
  ctx.moveTo(c.x - rx, c.y);
  ctx.lineTo(c.x - rx, c.y - h);
  ctx.ellipse(c.x, c.y - h, rx, ry, 0, Math.PI, 0, false);
  ctx.lineTo(c.x + rx, c.y);
  ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI, false);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(c.x, c.y - h, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = pal.roof;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.35)';
  ctx.stroke();
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
}

export function drawBuilding(ctx: CanvasRenderingContext2D, o: DrawBuildingOptions) {
  const pal = BUILDING_PALETTES[o.type] ?? BUILDING_PALETTES.builder_hut;
  const { x, y, size, zoom, ox, oy } = o;
  ctx.save();
  if (o.ghost) ctx.globalAlpha = 0.6;
  // footprint
  drawFootprint(ctx, x, y, size, zoom, ox, oy, o.invalid ? 'rgba(244,63,94,.35)' : o.selected ? 'rgba(255,159,67,.35)' : o.destroyed ? 'rgba(0,0,0,.45)' : 'rgba(0,0,0,.18)', o.selected || o.invalid ? (o.invalid ? '#fb7185' : '#ffb86b') : undefined);
  const override = SPRITE_OVERRIDES[o.type];
  if (override) {
    const p = toScreen(x + size / 2, y + size, zoom, ox, oy);
    const w = size * TILE_W * zoom;
    ctx.drawImage(override, p.x - w / 2, p.y - w, w, w);
    ctx.restore();
    return;
  }
  if (o.destroyed) {
    // rubble
    for (let i = 0; i < size * 3; i++) {
      const p = toScreen(x + ((i * 7) % (size * 10)) / 10, y + ((i * 13) % (size * 10)) / 10, zoom, ox, oy);
      ctx.fillStyle = i % 2 ? '#3a3a3a' : '#2a2a2a';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 4 * zoom, 5 * zoom, 2.5 * zoom, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }
  const lvl = Math.max(1, o.level);
  switch (o.type) {
    case 'wall':
      drawBox(ctx, x, y, 1, 10 + Math.min(lvl, 8) * 1.5, zoom, ox, oy, pal);
      break;
    case 'town_hall':
      drawBox(ctx, x + 0.2, y + 0.2, size - 0.4, 26 + lvl * 2, zoom, ox, oy, pal);
      drawRoofPeak(ctx, x + 0.2, y + 0.2, size - 0.4, 26 + lvl * 2, 18 + lvl, zoom, ox, oy, pal.roof);
      // banner
      {
        const p = toScreen(x + size / 2, y + size / 2, zoom, ox, oy);
        ctx.fillStyle = pal.accent;
        ctx.fillRect(p.x - 1.5 * zoom, p.y - (48 + lvl * 3) * zoom, 3 * zoom, 14 * zoom);
      }
      break;
    case 'gold_mine':
    case 'elixir_collector':
      drawBox(ctx, x + 0.3, y + 0.3, size - 0.6, 10, zoom, ox, oy, pal);
      drawCylinder(ctx, x + 0.6, y + 0.6, size - 1.2, 14 + lvl, zoom, ox, oy, { ...pal, roof: pal.accent });
      break;
    case 'gold_storage':
    case 'elixir_storage':
      drawCylinder(ctx, x + 0.3, y + 0.3, size - 0.6, 18 + lvl * 2, zoom, ox, oy, pal);
      break;
    case 'barracks':
      drawBox(ctx, x + 0.2, y + 0.2, size - 0.4, 14 + lvl, zoom, ox, oy, pal);
      drawRoofPeak(ctx, x + 0.2, y + 0.2, size - 0.4, 14 + lvl, 10, zoom, ox, oy, pal.roof);
      break;
    case 'army_camp': {
      // tents on a flat camp
      drawFootprint(ctx, x, y, size, zoom, ox, oy, 'rgba(95,138,86,.5)');
      for (const [dx, dy] of [
        [0.5, 0.5],
        [2.2, 0.5],
        [0.5, 2.2],
        [2.2, 2.2],
      ]) drawRoofPeak(ctx, x + dx, y + dy, 1.3, 0, 12 + lvl, zoom, ox, oy, pal.roof);
      break;
    }
    case 'laboratory':
      drawBox(ctx, x + 0.2, y + 0.2, size - 0.4, 16 + lvl, zoom, ox, oy, pal);
      drawCylinder(ctx, x + 1, y + 1, size - 2, 26 + lvl * 2, zoom, ox, oy, { ...pal, roof: pal.accent });
      break;
    case 'builder_hut':
      drawBox(ctx, x + 0.15, y + 0.15, size - 0.3, 9, zoom, ox, oy, pal);
      drawRoofPeak(ctx, x + 0.15, y + 0.15, size - 0.3, 9, 9, zoom, ox, oy, pal.roof);
      break;
    case 'clan_hall':
      drawBox(ctx, x + 0.2, y + 0.2, size - 0.4, 20 + lvl * 2, zoom, ox, oy, pal);
      drawRoofPeak(ctx, x + 0.2, y + 0.2, size - 0.4, 20 + lvl * 2, 14, zoom, ox, oy, pal.accent);
      break;
    case 'crystal_mine':
      drawBox(ctx, x + 0.1, y + 0.1, size - 0.2, 8, zoom, ox, oy, pal);
      drawRoofPeak(ctx, x + 0.4, y + 0.4, size - 0.8, 8, 18 + lvl * 3, zoom, ox, oy, pal.accent);
      break;
    case 'arrow_tower':
      drawCylinder(ctx, x + 0.6, y + 0.6, size - 1.2, 34 + lvl * 2, zoom, ox, oy, pal);
      break;
    case 'cannon':
      drawBox(ctx, x + 0.3, y + 0.3, size - 0.6, 8, zoom, ox, oy, pal);
      drawCylinder(ctx, x + 0.9, y + 0.9, size - 1.8, 12 + lvl, zoom, ox, oy, { ...pal, roof: pal.accent });
      break;
    case 'mortar':
      drawCylinder(ctx, x + 0.5, y + 0.5, size - 1, 10 + lvl, zoom, ox, oy, pal);
      drawCylinder(ctx, x + 1, y + 1, size - 2, 20 + lvl, zoom, ox, oy, { ...pal, wall: shade(pal.wall, -30), roof: '#111' });
      break;
    case 'mage_tower':
      drawCylinder(ctx, x + 0.5, y + 0.5, size - 1, 30 + lvl * 3, zoom, ox, oy, pal);
      drawRoofPeak(ctx, x + 0.5, y + 0.5, size - 1, 30 + lvl * 3, 16, zoom, ox, oy, pal.accent);
      break;
    default:
      drawBox(ctx, x + 0.2, y + 0.2, size - 0.4, 14, zoom, ox, oy, pal);
  }
  // level badge
  if (zoom >= 0.7) {
    const p = toScreen(x + size / 2, y + size, zoom, ox, oy);
    ctx.font = `${Math.round(10 * zoom)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.beginPath();
    ctx.roundRect(p.x - 12 * zoom, p.y - 2 * zoom, 24 * zoom, 12 * zoom, 4 * zoom);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(`L${lvl}`, p.x, p.y + 8 * zoom);
  }
  if (o.state && o.state !== 'IDLE') {
    const p = toScreen(x + size / 2, y + size / 2, zoom, ox, oy);
    ctx.fillStyle = '#ffd04d';
    ctx.beginPath();
    ctx.arc(p.x, p.y - 40 * zoom, 6 * zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.font = `bold ${Math.round(9 * zoom)}px Inter, sans-serif`;
    ctx.fillText('⚒', p.x, p.y - 37 * zoom);
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

export function drawTroop(ctx: CanvasRenderingContext2D, troopType: string, gx: number, gy: number, zoom: number, ox: number, oy: number, hpRatio: number, flying: boolean) {
  const c = TROOP_COLORS[troopType] ?? { body: '#ddd', trim: '#333' };
  const p = toScreen(gx, gy, zoom, ox, oy);
  const lift = flying ? 22 * zoom : 0;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, 6 * zoom, 3 * zoom, 0, 0, Math.PI * 2);
  ctx.fill();
  const r = (troopType === 'brute' ? 7 : 5) * zoom;
  ctx.fillStyle = c.body;
  ctx.beginPath();
  ctx.arc(p.x, p.y - 8 * zoom - lift, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = c.trim;
  ctx.lineWidth = 1.5 * zoom;
  ctx.stroke();
  if (flying) {
    ctx.strokeStyle = c.body;
    ctx.beginPath();
    ctx.moveTo(p.x - r * 2, p.y - 10 * zoom - lift);
    ctx.lineTo(p.x, p.y - 7 * zoom - lift);
    ctx.lineTo(p.x + r * 2, p.y - 10 * zoom - lift);
    ctx.stroke();
  }
  if (hpRatio < 1) {
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(p.x - 7 * zoom, p.y - 18 * zoom - lift, 14 * zoom, 2.5 * zoom);
    ctx.fillStyle = hpRatio > 0.5 ? '#34d399' : '#fb7185';
    ctx.fillRect(p.x - 7 * zoom, p.y - 18 * zoom - lift, 14 * zoom * hpRatio, 2.5 * zoom);
  }
  ctx.restore();
}

export function drawGround(ctx: CanvasRenderingContext2D, gridSize: number, zoom: number, ox: number, oy: number, mask?: Uint8Array) {
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const blocked = mask ? mask[y * gridSize + x] === 1 : false;
      const base = (x + y) % 2 === 0 ? '#2f5a3a' : '#2a5134';
      drawTile(ctx, x, y, zoom, ox, oy, blocked ? 'rgba(244,63,94,.18)' : base);
    }
  }
  // outline
  const a = toScreen(0, 0, zoom, ox, oy);
  const b = toScreen(gridSize, 0, zoom, ox, oy);
  const c = toScreen(gridSize, gridSize, zoom, ox, oy);
  const d = toScreen(0, gridSize, zoom, ox, oy);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.strokeStyle = 'rgba(255,255,255,.12)';
  ctx.lineWidth = 2;
  ctx.stroke();
}
