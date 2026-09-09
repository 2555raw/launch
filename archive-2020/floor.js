/* ARCHIVE 2020 — mode 02: the walkable floor.

   The same fourth floor of the archive, this time seen from the ceiling camera:
   you walk an empty hospital and every station opens one of the five records,
   drawn by the very same scenes of engine.js.

   An 8 px tile map, a camera that follows the character and lighting by blocks. */

(() => {
  'use strict';

  const A = window.ARCHIVE;
  const { W, H, COL, R, text, textC, textW, sprite, hash, clamp, c01, lerp, ease } = A;

  const T = 8, MW = 69, MH = 38;
  const WORLD_W = MW * T, WORLD_H = MH * T;

  /* ---------- the floor plan ---------- */

  const ROOMS = [
    { n: 1, x: 3,  y: 3,  w: 18, h: 12, cam: 'CAM 01', name: 'ROOM 214',        light: 0.34, scene: 'deaths',   title: 'RECORD 01 - DEATHS / LOSSES' },
    { n: 2, x: 24, y: 3,  w: 21, h: 12, cam: 'CAM 02', name: 'ICU - ISOLATION', light: 0.42, scene: 'hospital', title: 'RECORD 02 - ISOLATION / HOSPITAL' },
    { n: 3, x: 48, y: 3,  w: 19, h: 12, cam: 'CAM 03', name: 'PPE STORE',       light: 0.24, scene: 'masks',    title: 'RECORD 03 - MASKS' },
    { n: 0, x: 3,  y: 17, w: 64, h: 4,  cam: 'CAM 00', name: 'CORRIDOR 4B',     light: 0.36 },
    { n: 4, x: 5,  y: 23, w: 22, h: 14, cam: 'CAM 04', name: 'COLD ROOM',       light: 0.30, scene: 'vaccines', title: 'RECORD 04 - VACCINES' },
    { n: 5, x: 34, y: 23, w: 31, h: 14, cam: 'CAM 05', name: 'WAITING AREA',    light: 0.10, scene: 'memory',   title: 'RECORD 05 - MEMORY' }
  ];

  const DOORS = [
    [11, 15], [12, 15], [11, 16], [12, 16],
    [34, 15], [35, 15], [34, 16], [35, 16],
    [57, 15], [58, 15], [57, 16], [58, 16],
    [14, 21], [15, 21], [14, 22], [15, 22],
    [48, 21], [49, 21], [48, 22], [49, 22]
  ];

  /* props: origin tile and size in tiles */
  const PROPS = [
    /* room 214 */
    { k: 'bed', x: 5, y: 4 }, { k: 'bed', x: 10, y: 4 },
    { k: 'mon', x: 7, y: 4 }, { k: 'mon', x: 12, y: 4 },
    { k: 'iv', x: 4, y: 4 },  { k: 'iv', x: 9, y: 4 },
    { k: 'desk', x: 15, y: 12, w: 3 },
    { k: 'chair', x: 14, y: 8 }, { k: 'chair', x: 17, y: 8 },
    /* icu */
    { k: 'bed', x: 26, y: 4 }, { k: 'bed', x: 30, y: 4 }, { k: 'bed', x: 35, y: 4 }, { k: 'bed', x: 39, y: 4 },
    { k: 'mon', x: 28, y: 4 }, { k: 'mon', x: 32, y: 4 }, { k: 'mon', x: 37, y: 4 }, { k: 'mon', x: 41, y: 4 },
    { k: 'iv', x: 25, y: 4 }, { k: 'iv', x: 34, y: 4 },
    { k: 'desk', x: 26, y: 12, w: 5 },
    { k: 'gurney', x: 39, y: 11 },
    /* ppe store */
    { k: 'locker', x: 49, y: 3 }, { k: 'locker', x: 51, y: 3 }, { k: 'locker', x: 53, y: 3 },
    { k: 'locker', x: 55, y: 3 }, { k: 'locker', x: 57, y: 3 }, { k: 'locker', x: 59, y: 3 },
    { k: 'shelf', x: 49, y: 8, w: 9 },
    { k: 'box', x: 63, y: 5 }, { k: 'box', x: 64, y: 7 }, { k: 'box', x: 63, y: 10 }, { k: 'box', x: 62, y: 12 },
    /* corridor */
    { k: 'gurney', x: 20, y: 18 }, { k: 'gurney', x: 44, y: 18 },
    { k: 'box', x: 8, y: 17 }, { k: 'box', x: 31, y: 20 }, { k: 'box', x: 60, y: 17 },
    /* cold room */
    { k: 'fridge', x: 6, y: 24 }, { k: 'fridge', x: 9, y: 24 }, { k: 'fridge', x: 12, y: 24 },
    { k: 'table', x: 17, y: 28, w: 3 },
    { k: 'box', x: 22, y: 25 }, { k: 'box', x: 24, y: 27 }, { k: 'box', x: 21, y: 33 },
    { k: 'fridge', x: 23, y: 30 },
    /* waiting area */
    { k: 'chair', x: 38, y: 27 }, { k: 'chair', x: 41, y: 27 }, { k: 'chair', x: 44, y: 27 },
    { k: 'chair', x: 47, y: 27 }, { k: 'chair', x: 50, y: 27 }, { k: 'chair', x: 53, y: 27 }, { k: 'chair', x: 56, y: 27 },
    { k: 'chair', x: 38, y: 31 }, { k: 'chair', x: 41, y: 31 }, { k: 'chair', x: 44, y: 31 },
    { k: 'chair', x: 47, y: 31 }, { k: 'chair', x: 50, y: 31 }, { k: 'chair', x: 53, y: 31 }, { k: 'chair', x: 56, y: 31 },
    { k: 'desk', x: 60, y: 24, w: 3 }
  ];

  const SIZE = { bed: [2, 3], mon: [1, 1], iv: [1, 1], desk: [1, 1], chair: [1, 1], locker: [1, 2], shelf: [1, 1], box: [1, 1], fridge: [2, 2], gurney: [3, 2], table: [1, 1] };

  const STATIONS = [
    { room: 1, x: 13, y: 9 },
    { room: 2, x: 33, y: 10 },
    { room: 3, x: 57, y: 11 },
    { room: 4, x: 10, y: 30 },
    { room: 5, x: 49, y: 34 }
  ];

  /* ---------- the tile grid ---------- */

  const VOID = 0, FLOOR = 1, WALL = 2, DOOR = 3;
  const grid = new Uint8Array(MW * MH);
  const roomAt = new Int8Array(MW * MH).fill(-1);
  const solid = new Uint8Array(MW * MH);
  const at = (x, y) => (x < 0 || y < 0 || x >= MW || y >= MH ? VOID : grid[y * MW + x]);

  ROOMS.forEach((r, i) => {
    for (let y = r.y - 1; y <= r.y + r.h; y++) {
      for (let x = r.x - 1; x <= r.x + r.w; x++) {
        if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
        const inside = x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
        const k = y * MW + x;
        if (inside) { grid[k] = FLOOR; roomAt[k] = i; }
        else if (grid[k] !== FLOOR) grid[k] = WALL;
      }
    }
  });
  DOORS.forEach(([x, y]) => { grid[y * MW + x] = DOOR; });
  for (let k = 0; k < grid.length; k++) if (grid[k] === WALL || grid[k] === VOID) solid[k] = 1;
  PROPS.forEach((p) => {
    const [w, h] = SIZE[p.k];
    const pw = p.w || w;
    for (let y = p.y; y < p.y + h; y++) for (let x = p.x; x < p.x + pw; x++) {
      if (x >= 0 && y >= 0 && x < MW && y < MH) solid[y * MW + x] = 1;
    }
  });
  /* a station tile is always walkable */
  STATIONS.forEach((s) => { solid[s.y * MW + s.x] = 0; });

  const roomOf = (px, py) => {
    const k = ((py / T) | 0) * MW + ((px / T) | 0);
    return roomAt[k] >= 0 ? ROOMS[roomAt[k]] : null;
  };

  /* ---------- the character ---------- */

  const BODY = {
    down: ['..66666..', '.6555556.', '.6555556.', '.65k5k56.', '.6wwwww6.', '..wwwww..', '.wwwwwww.', 'wwwwwwwww', 'wwwwwwwww', 'ww66666ww', '.wwwwwww.'],
    up:   ['..66666..', '.6666666.', '.6666666.', '.6666666.', '..66666..', '..wwwww..', '.wwwwwww.', 'wwwwwwwww', 'wwwwwwwww', 'wwwwwwwww', '.wwwwwww.'],
    side: ['..6666...', '.655556..', '.655556..', '.65k555..', '.6wwww5..', '..wwww...', '.wwwww...', '.wwwwww..', '.wwwwww..', '.wwwwww..', '.wwwww...']
  };
  const mirror = (rows) => rows.map((r) => r.split('').reverse().join(''));
  BODY.sideL = mirror(BODY.side);

  function drawPlayer(c, x, y, dir, step, moving) {
    const bob = moving && step % 2 ? 1 : 0;
    R(c, x - 4, y - 1, 9, 2, 'rgba(0,0,0,0.55)');
    const rows = dir === 'up' ? BODY.up : dir === 'left' ? BODY.sideL : dir === 'right' ? BODY.side : BODY.down;
    sprite(c, rows, x - 4, y - 14 - bob, 1);
    /* legs */
    const a = moving ? (step % 2 ? 1 : 0) : 0;
    const b = moving ? (step % 2 ? 0 : 1) : 0;
    R(c, x - 3, y - 3 - bob + a, 2, 3, COL.grey);
    R(c, x + 2, y - 3 - bob + b, 2, 3, COL.grey);
    R(c, x - 3, y - bob + a, 2, 1, COL.grey2);
    R(c, x + 2, y - bob + b, 2, 1, COL.grey2);
  }

  /* ---------- props ---------- */

  function prop(c, p, sx, sy) {
    const x = p.x * T - sx, y = p.y * T - sy;
    const k = p.k;
    if (k === 'bed') {
      R(c, x, y, 16, 24, COL.grey);
      R(c, x + 1, y + 1, 14, 22, COL.dark);
      R(c, x + 2, y + 2, 12, 7, COL.bone);            /* pillow */
      R(c, x + 2, y + 10, 12, 12, COL.dust);          /* sheet */
      R(c, x + 2, y + 14, 12, 1, COL.dim);
      R(c, x, y + 22, 16, 2, COL.grey2);
    } else if (k === 'gurney') {
      R(c, x, y, 24, 16, COL.grey);
      R(c, x + 1, y + 1, 22, 14, COL.dark);
      R(c, x + 2, y + 2, 8, 12, COL.bone);
      R(c, x + 11, y + 2, 11, 12, COL.dust);
    } else if (k === 'mon') {
      R(c, x + 1, y + 1, 6, 6, COL.grey2);
      R(c, x + 2, y + 2, 4, 3, COL.void);
      R(c, x + 2, y + 3, 4, 1, COL.red);
      R(c, x + 2, y + 6, 4, 1, COL.grey);
    } else if (k === 'iv') {
      R(c, x + 3, y + 1, 1, 6, COL.grey2);
      R(c, x + 2, y + 1, 3, 3, COL.dust);
      R(c, x + 2, y + 6, 3, 1, COL.grey);
    } else if (k === 'desk') {
      const w = (p.w || 1) * T;
      R(c, x, y, w, 8, COL.grey2);
      R(c, x, y, w, 2, COL.dust);
      R(c, x + 2, y + 4, w - 4, 1, COL.grey);
    } else if (k === 'table') {
      const w = (p.w || 1) * T;
      R(c, x, y, w, 8, COL.grey);
      R(c, x, y, w, 1, COL.dim);
      for (let i = 0; i < w - 4; i += 5) { R(c, x + 2 + i, y + 2, 2, 4, COL.bone); R(c, x + 2 + i, y + 2, 2, 1, COL.red); }
    } else if (k === 'chair') {
      R(c, x + 1, y + 2, 6, 5, COL.grey2);
      R(c, x + 1, y + 1, 6, 2, COL.grey);
    } else if (k === 'locker') {
      R(c, x, y, 8, 16, COL.grey2);
      R(c, x + 1, y + 1, 6, 14, COL.grey);
      R(c, x + 4, y + 1, 1, 14, COL.grey2);
      R(c, x + 3, y + 7, 1, 2, COL.dust);
      R(c, x + 5, y + 7, 1, 2, COL.dust);
    } else if (k === 'shelf') {
      const w = (p.w || 1) * T;
      R(c, x, y, w, 8, COL.grey);
      R(c, x, y, w, 1, COL.grey2);
      for (let i = 0; i < w - 3; i += 6) {
        const v = hash(p.x + i);
        R(c, x + 2 + i, y + 2, 4, 5, v > 0.5 ? COL.dust : COL.grey2);
        if (v > 0.82) R(c, x + 3 + i, y + 3, 2, 2, COL.redDeep);
      }
    } else if (k === 'box') {
      R(c, x + 1, y + 2, 6, 5, COL.grey2);
      R(c, x + 1, y + 2, 6, 1, COL.dust);
      R(c, x + 3, y + 4, 2, 1, COL.redDeep);
    } else if (k === 'fridge') {
      R(c, x, y, 16, 16, COL.grey2);
      R(c, x + 1, y + 1, 14, 14, COL.dust);
      R(c, x + 1, y + 1, 14, 4, COL.dim);
      R(c, x + 7, y + 6, 2, 6, COL.red);
      R(c, x + 5, y + 8, 6, 2, COL.red);
      R(c, x + 13, y + 7, 1, 3, COL.grey);
    }
  }

  /* ---------- the floor, drawn ---------- */

  function drawWorld(c, camX, camY, t, done) {
    R(c, 0, 0, W, H, COL.void);
    const x0 = Math.max(0, (camX / T | 0) - 1), x1 = Math.min(MW - 1, ((camX + W) / T | 0) + 1);
    const y0 = Math.max(0, (camY / T | 0) - 1), y1 = Math.min(MH - 1, ((camY + H) / T | 0) + 1);

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const g = grid[y * MW + x];
        if (g === VOID) continue;
        const sx = x * T - camX, sy = y * T - camY;
        if (g === WALL) {
          R(c, sx, sy, T, T, '#2e2e2e');
          if (at(x, y + 1) === FLOOR || at(x, y + 1) === DOOR) { R(c, sx, sy + 5, T, 1, '#6a6a6a'); R(c, sx, sy + 6, T, 2, '#3c3c3c'); }
          if (at(x, y - 1) === FLOOR || at(x, y - 1) === DOOR) R(c, sx, sy, T, 2, '#3a3a3a');
          if (at(x - 1, y) === FLOOR || at(x - 1, y) === DOOR) R(c, sx, sy, 2, T, '#3a3a3a');
          if (at(x + 1, y) === FLOOR || at(x + 1, y) === DOOR) R(c, sx + 6, sy, 2, T, '#3a3a3a');
        } else {
          R(c, sx, sy, T, T, g === DOOR ? '#343434' : '#2a2a2a');
          R(c, sx, sy, T, 1, '#333333');
          R(c, sx, sy, 1, T, '#333333');
          if (hash(x * 3.1 + y * 7.7) > 0.93) R(c, sx + 3, sy + 5, 1, 1, '#3d3d3d');
          if (g === DOOR) {
            if (at(x - 1, y) === WALL) R(c, sx, sy, 1, T, COL.redDeep);
            if (at(x + 1, y) === WALL) R(c, sx + 7, sy, 1, T, COL.redDeep);
            if (at(x, y - 1) === WALL) R(c, sx, sy, T, 1, COL.redDeep);
            if (at(x, y + 1) === WALL) R(c, sx, sy + 7, T, 1, COL.redDeep);
          }
        }
      }
    }

    /* distance markings down the corridor */
    for (let x = 6; x < 66; x += 4) {
      const sx = x * T - camX, sy = 20 * T - camY + 5;
      if (sx < -8 || sx > W) continue;
      R(c, sx, sy, 5, 1, COL.redDeep);
    }

    /* room names painted on the floor */
    for (const r of ROOMS) {
      const cx = (r.x + r.w / 2) * T - camX, cy = (r.y + r.h / 2) * T - camY;
      if (cx < -120 || cx > W + 120 || cy < -40 || cy > H + 40) continue;
      textC(c, r.name, cx, cy - 4, COL.grey2, 1, 1, 0.5);
      textC(c, r.cam, cx, cy + 6, COL.grey2, 1, 1, 0.3);
    }

    /* stations */
    for (let i = 0; i < STATIONS.length; i++) {
      const s = STATIONS[i];
      const sx = s.x * T - camX, sy = s.y * T - camY;
      if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue;
      const ok = done[i];
      const col = ok ? COL.bone : COL.red;
      const b = Math.floor(t / 380) % 2 === 0;
      /* corners of the bracket that marks a station */
      const q = (ox, oy, ex, ey) => { R(c, sx - 4 + ox, sy - 4 + oy, 4 * ex, 1, col); R(c, sx - 4 + ox, sy - 4 + oy, 1, 4 * ey, col); };
      q(0, 0, 1, 1); q(15, 0, -1, 1); q(0, 15, 1, -1); q(15, 15, -1, -1);
      if (!ok && b) { R(c, sx + 3, sy + 1, 2, 5, col); R(c, sx + 3, sy + 8, 2, 2, col); }
      if (ok) { R(c, sx + 2, sy + 4, 2, 2, col); R(c, sx + 4, sy + 6, 2, 2, col); R(c, sx + 6, sy + 2, 2, 2, col); }
    }
  }

  /* ---------- lighting by blocks ---------- */

  function lighting(c, camX, camY, px, py, k, here) {
    const B = 6;
    for (let by = 0; by < H; by += B) {
      for (let bx = 0; bx < W; bx += B) {
        const wx = camX + bx + 3, wy = camY + by + 3;
        const r = roomOf(wx, wy);
        let l = (r ? r.light + (r === here ? 0.2 : 0) : 0) * k;
        const dx = wx - px, dy = wy - py;
        const d2 = dx * dx + dy * dy;
        if (d2 < 4900) l += c01(1 - Math.sqrt(d2) / 70) * 0.85 * k;
        const dark = clamp(1 - l, 0, 0.94);
        if (dark < 0.07) continue;
        c.fillStyle = `rgba(0,0,0,${Math.round(dark * 6) / 6})`;
        c.fillRect(bx, by, B, B);
      }
    }
  }

  /* ---------- camera interface ---------- */

  function minimap(c, px, py, done, t) {
    const mx = W - MW - 6, my = H - MH - 6;
    R(c, mx - 2, my - 2, MW + 4, MH + 4, 'rgba(0,0,0,0.78)');
    R(c, mx - 2, my - 2, MW + 4, 1, COL.grey2); R(c, mx - 2, my + MH + 1, MW + 4, 1, COL.grey2);
    R(c, mx - 2, my - 2, 1, MH + 4, COL.grey2); R(c, mx + MW + 1, my - 2, 1, MH + 4, COL.grey2);
    for (let y = 0; y < MH; y++) {
      for (let x = 0; x < MW; x++) {
        const g = grid[y * MW + x];
        if (g === VOID) continue;
        c.fillStyle = g === WALL ? '#1c1c1c' : g === DOOR ? '#4a4a4a' : '#2e2e2e';
        c.fillRect(mx + x, my + y, 1, 1);
      }
    }
    STATIONS.forEach((s, i) => { c.fillStyle = done[i] ? COL.bone : COL.red; c.fillRect(mx + s.x, my + s.y, 1, 1); });
    if (Math.floor(t / 260) % 2 === 0) { c.fillStyle = COL.white; c.fillRect(mx + (px / T | 0), my + (py / T | 0), 1, 1); }
  }

  function camHud(c, room, done, t, near) {
    const corner = (x, y, sx, sy) => { R(c, x, y, 5 * sx, 1, COL.grey2); R(c, x, y, 1, 5 * sy, COL.grey2); };
    corner(3, 3, 1, 1); corner(W - 4, 3, -1, 1); corner(3, H - 4, 1, -1); corner(W - 4, H - 4, -1, -1);

    const rec = Math.floor(t / 620) % 2 === 0;
    R(c, 8, 9, 3, 3, rec ? COL.red : COL.redDeep);
    text(c, (room ? room.cam : 'CAM --') + ' / ' + (room ? room.name : 'NO SIGNAL'), 14, 8, COL.dim, 1, 1, 0.9);

    const secs = Math.floor(t / 1000);
    const clock = String(4 + Math.floor(secs / 3600) % 20).padStart(2, '0') + ':' +
                  String(Math.floor(secs / 60) % 60).padStart(2, '0') + ':' +
                  String(secs % 60).padStart(2, '0');
    text(c, clock, W - 8 - textW(clock), 8, COL.grey2, 1, 1, 0.8);

    const n = done.filter(Boolean).length;
    text(c, 'RECORDS ' + n + '/5', 8, H - 14, n === 5 ? COL.bone : COL.grey2, 1, 1, 0.9);
    if (n === 5) text(c, 'ARCHIVE COMPLETE', 8, H - 24, COL.red, 1, 1, Math.floor(t / 400) % 2 ? 0.9 : 0.4);

    if (near !== -1) {
      textC(c, done[near] ? 'RECORD RECOVERED' : '[E] READ RECORD', W / 2, H - 30, done[near] ? COL.grey2 : COL.bone, 1, 1, 0.95);
    }
  }

  /* ================================================================
     State, controls and the mode's frame
     ================================================================ */

  const $ = (sel) => document.querySelector(sel);
  const cv = $('#game');
  const cx = cv.getContext('2d', { alpha: false });
  cx.imageSmoothingEnabled = false;

  const taskEl = $('#task'), taskTitle = $('#taskTitle'), taskFill = $('#taskFill'), taskHint = $('#taskHint');
  const endEl = $('#end');

  const done = [false, false, false, false, false];
  const player = { x: 8 * T + 4, y: 19 * T + 7, dir: 'down', step: 0, dist: 0, moving: false };
  const cam = { x: player.x - W / 2, y: player.y - H / 2 };

  let state = 'play';      /* play | fx | task | ending */
  let taskIdx = -1, taskP = 0, fxLeft = 0, fxNext = 'task', endT = 0;

  const keys = { up: 0, down: 0, left: 0, right: 0, use: 0 };
  let useEdge = false, escEdge = false;

  const KEY = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    KeyE: 'use', Space: 'use', Enter: 'use'
  };

  const active = () => document.body.dataset.mode === 'floor';

  window.addEventListener('keydown', (e) => {
    if (!active()) return;
    if (e.code === 'Escape') { escEdge = true; return; }
    const k = KEY[e.code];
    if (!k) return;
    e.preventDefault();
    if (k === 'use' && !e.repeat) useEdge = true;
    keys[k] = 1;
  });
  window.addEventListener('keyup', (e) => { const k = KEY[e.code]; if (k) keys[k] = 0; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = 0; });

  document.querySelectorAll('#pad button').forEach((b) => {
    const k = b.dataset.key;
    const on = (e) => { e.preventDefault(); if (k === 'use') useEdge = true; keys[k] = 1; };
    const off = (e) => { e.preventDefault(); keys[k] = 0; };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('pointerleave', off);
  });

  /* ---------- walking ---------- */

  function free(nx, ny) {
    const l = (nx - 3) | 0, r = (nx + 3) | 0, tp = (ny - 5) | 0, bt = ny | 0;
    for (let y = (tp / T) | 0; y <= (bt / T) | 0; y++) {
      for (let x = (l / T) | 0; x <= (r / T) | 0; x++) {
        if (x < 0 || y < 0 || x >= MW || y >= MH) return false;
        if (solid[y * MW + x]) return false;
      }
    }
    return true;
  }

  function nearStation() {
    for (let i = 0; i < STATIONS.length; i++) {
      const sx = STATIONS[i].x * T + 4, sy = STATIONS[i].y * T + 4;
      if (Math.abs(sx - player.x) < 13 && Math.abs(sy - player.y + 4) < 13) return i;
    }
    return -1;
  }

  /* ---------- records ---------- */

  const roomFor = (i) => ROOMS.find((r) => r.n === STATIONS[i].room);

  function openTask(i) {
    taskIdx = i; taskP = done[i] ? 1 : 0;
    state = 'fx'; fxLeft = 0.32; fxNext = 'task';
    taskEl.hidden = false;
    taskEl.classList.toggle('done', done[i]);
    taskTitle.textContent = roomFor(i).title;
    for (const k in keys) keys[k] = 0;
  }

  function closeTask() {
    taskEl.hidden = true;
    taskIdx = -1;
    if (done.every(Boolean)) { state = 'ending'; endT = 0; }
    else { state = 'fx'; fxLeft = 0.22; fxNext = 'play'; }
  }

  function updateTask(dt) {
    const hold = keys.use || keys.right;
    if (!done[taskIdx]) {
      if (hold) taskP = c01(taskP + dt * (keys.right ? 0.2 : 0.12));
      if (keys.left) taskP = c01(taskP - dt * 0.3);
      if (taskP >= 1) { done[taskIdx] = true; taskEl.classList.add('done'); }
    } else if (keys.right) taskP = c01(taskP + dt * 0.2);
    else if (keys.left) taskP = c01(taskP - dt * 0.3);

    taskFill.style.width = Math.round(taskP * 100) + '%';
    taskHint.textContent = done[taskIdx]
      ? (done.every(Boolean) ? 'RECORD RECOVERED · [E] CLOSE THE ARCHIVE' : 'RECORD RECOVERED · [E] TO LEAVE')
      : 'HOLD [E] TO READ · [ESC] TO LEAVE';

    if (escEdge || (useEdge && done[taskIdx])) closeTask();
  }

  /* ---------- the static between screens ---------- */

  function staticFrame(c, t) {
    R(c, 0, 0, W, H, COL.void);
    for (let i = 0; i < 2600; i++) {
      const x = (hash(i * 1.7 + t) * W) | 0, y = (hash(i * 3.1 + t * 1.3) * H) | 0;
      const v = hash(i + t);
      c.fillStyle = v > 0.93 ? COL.bone : v > 0.6 ? COL.dust : COL.grey;
      c.fillRect(x, y, 1, 1);
    }
    for (let i = 0; i < 3; i++) {
      const y = (hash(i * 9.1 + Math.floor(t * 20)) * H) | 0;
      R(c, 0, y, W, 1 + (hash(i + t) * 3 | 0), 'rgba(232,227,216,0.25)');
    }
  }

  /* ---------- drawing a frame of the floor ---------- */

  function renderFloor(c, t, lightK) {
    const camX = Math.round(cam.x), camY = Math.round(cam.y);
    drawWorld(c, camX, camY, t, done);

    const feet = player.y;
    const back = [], front = [];
    for (const p of PROPS) {
      const [, h] = SIZE[p.k];
      const sx = p.x * T - camX, sy = p.y * T - camY;
      if (sx < -32 || sx > W + 32 || sy < -32 || sy > H + 32) continue;
      ((p.y + h) * T <= feet ? back : front).push(p);
    }
    for (const p of back) prop(c, p, camX, camY);
    drawPlayer(c, Math.round(player.x - camX), Math.round(player.y - camY), player.dir, player.step, player.moving);
    for (const p of front) prop(c, p, camX, camY);

    const here = roomOf(player.x, player.y - 4);
    lighting(c, camX, camY, player.x, player.y - 4, lightK, here);
    if (lightK > 0.5) {
      camHud(c, here, done, t, nearStation());
      minimap(c, player.x, player.y, done, t);
    }
  }

  /* ---------- one frame, called by the shell ---------- */

  function frame(dt, t) {
    if (state === 'play') {
      let vx = 0, vy = 0;
      if (keys.left) vx--; if (keys.right) vx++;
      if (keys.up) vy--; if (keys.down) vy++;
      if (vx && vy) { vx *= 0.7071; vy *= 0.7071; }
      const sp = 46 * dt;
      if (vx && free(player.x + vx * sp, player.y)) player.x += vx * sp;
      if (vy && free(player.x, player.y + vy * sp)) player.y += vy * sp;
      player.moving = !!(vx || vy);
      if (player.moving) {
        player.dist += (Math.abs(vx) + Math.abs(vy)) * sp;
        player.step = Math.floor(player.dist / 5);
        player.dir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 'left' : 'right') : (vy < 0 ? 'up' : 'down');
      }
      const n = nearStation();
      if (useEdge && n !== -1) openTask(n);

      const k = Math.min(1, dt * 7);
      cam.x = lerp(cam.x, clamp(player.x - W / 2, 0, WORLD_W - W), k);
      cam.y = lerp(cam.y, clamp(player.y - H / 2, 0, WORLD_H - H), k);
      renderFloor(cx, t, 1);

    } else if (state === 'fx') {
      fxLeft -= dt;
      staticFrame(cx, t / 1000);
      if (fxLeft <= 0) state = fxNext;

    } else if (state === 'task') {
      const i = taskIdx;
      updateTask(dt);
      if (state === 'task') A.scenes[roomFor(i).scene](cx, taskP, t);
      else staticFrame(cx, t / 1000);

    } else if (state === 'ending') {
      endT += dt;
      if (endT < 3) {
        renderFloor(cx, t, 1 - c01(endT / 2.6));
        if (endT > 1.2) textC(cx, 'THE FLOOR LIGHTS GO OUT', W / 2, H / 2 + 30, COL.grey2, 1, 1, c01((endT - 1.2) / 0.8) * 0.8);
      } else if (endT < 3.5) {
        staticFrame(cx, t / 1000);
      } else {
        A.scenes.memory(cx, c01((endT - 3.5) / 15), t);
        if (endT > 18 && endEl.hidden) { endEl.hidden = false; taskEl.hidden = true; }
      }
    }

    /* the screen the camera is filming */
    A.grain(cx, state === 'task' ? 0.4 : 0.55, t);
    A.interlace(cx, 0.22);
    if (!window.SHELL.REDUCED && state !== 'fx') A.tear(cx, state === 'task' ? 0.3 : 0.16, t, 5);

    useEdge = escEdge = false;
  }

  window.MODE_FLOOR = {
    frame,
    enter() { for (const k in keys) keys[k] = 0; useEdge = escEdge = false; },
    leave() { for (const k in keys) keys[k] = 0; }
  };

})();
