/* ARCHIVO 2020 — motor de pixel art y las cinco escenas.

   Todo se dibuja en un lienzo de 384x216 píxeles reales que el navegador amplía
   sin suavizado, así que lo que se ve (tipografía incluida) está hecho píxel a
   píxel. Cada escena recibe un progreso 0..1 y el tiempo; nada más.

   Este archivo no toca el DOM: publica el motor en window.ARCHIVO para que lo
   usen tanto el archivo con scroll (app.js) como el modo exploración (juego.js).

   Sin dependencias. */

(() => {
  'use strict';
  const W = 384, H = 216;

  /* ---------- utilidades ---------- */

  const clamp  = (v, a, b) => (v < a ? a : v > b ? b : v);
  const c01    = (v) => clamp(v, 0, 1);
  const lerp   = (a, b, t) => a + (b - a) * t;
  const ease   = (t) => { t = c01(t); return t * t * (3 - 2 * t); };
  const easeIn = (t) => { t = c01(t); return t * t; };
  const seg    = (p, a, b) => c01((p - a) / (b - a));
  const hash   = (n) => { const x = Math.sin(n * 127.1 + 11.7) * 43758.5453; return x - Math.floor(x); };

  const COL = {
    void:'#000000', deep:'#070707', dark:'#101010', grey:'#242424', grey2:'#3c3c3c',
    dust:'#5a5754', dim:'#8b867e', bone:'#e8e3d8', white:'#ffffff',
    red:'#ff1e2d', redMid:'#b3121c', redDeep:'#5e070d',
    green:'#2fbf71', blue:'#6fa8bf'
  };

  const R  = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const PX = (c, x, y, col) => { c.fillStyle = col; c.fillRect(x | 0, y | 0, 1, 1); };

  /* ---------- tipografía de mapa de bits 5x7 ---------- */

  const G = {
    'A':'01110/10001/10001/11111/10001/10001/10001',
    'B':'11110/10001/10001/11110/10001/10001/11110',
    'C':'01110/10001/10000/10000/10000/10001/01110',
    'D':'11110/10001/10001/10001/10001/10001/11110',
    'E':'11111/10000/10000/11110/10000/10000/11111',
    'F':'11111/10000/10000/11110/10000/10000/10000',
    'G':'01110/10001/10000/10111/10001/10001/01110',
    'H':'10001/10001/10001/11111/10001/10001/10001',
    'I':'11111/00100/00100/00100/00100/00100/11111',
    'J':'00111/00010/00010/00010/00010/10010/01100',
    'K':'10001/10010/10100/11000/10100/10010/10001',
    'L':'10000/10000/10000/10000/10000/10000/11111',
    'M':'10001/11011/10101/10101/10001/10001/10001',
    'N':'10001/11001/10101/10011/10001/10001/10001',
    'O':'01110/10001/10001/10001/10001/10001/01110',
    'P':'11110/10001/10001/11110/10000/10000/10000',
    'Q':'01110/10001/10001/10001/10101/10010/01101',
    'R':'11110/10001/10001/11110/10100/10010/10001',
    'S':'01111/10000/10000/01110/00001/00001/11110',
    'T':'11111/00100/00100/00100/00100/00100/00100',
    'U':'10001/10001/10001/10001/10001/10001/01110',
    'V':'10001/10001/10001/10001/10001/01010/00100',
    'W':'10001/10001/10001/10101/10101/11011/10001',
    'X':'10001/10001/01010/00100/01010/10001/10001',
    'Y':'10001/10001/01010/00100/00100/00100/00100',
    'Z':'11111/00001/00010/00100/01000/10000/11111',
    '0':'01110/10001/10011/10101/11001/10001/01110',
    '1':'00100/01100/00100/00100/00100/00100/01110',
    '2':'01110/10001/00001/00010/00100/01000/11111',
    '3':'11111/00010/00100/00010/00001/10001/01110',
    '4':'00010/00110/01010/10010/11111/00010/00010',
    '5':'11111/10000/11110/00001/00001/10001/01110',
    '6':'00110/01000/10000/11110/10001/10001/01110',
    '7':'11111/00001/00010/00100/01000/01000/01000',
    '8':'01110/10001/10001/01110/10001/10001/01110',
    '9':'01110/10001/10001/01111/00001/00010/01100',
    ' ':'00000/00000/00000/00000/00000/00000/00000',
    '.':'00000/00000/00000/00000/00000/01100/01100',
    ',':'00000/00000/00000/00000/01100/01100/01000',
    ':':'00000/01100/01100/00000/01100/01100/00000',
    '-':'00000/00000/00000/11111/00000/00000/00000',
    '_':'00000/00000/00000/00000/00000/00000/11111',
    '/':'00001/00010/00010/00100/01000/01000/10000',
    '+':'00000/00100/00100/11111/00100/00100/00000',
    '=':'00000/00000/11111/00000/11111/00000/00000',
    '?':'01110/10001/00001/00110/00100/00000/00100',
    '!':'00100/00100/00100/00100/00100/00000/00100',
    '(':'00010/00100/01000/01000/01000/00100/00010',
    ')':'01000/00100/00010/00010/00010/00100/01000',
    '[':'01110/01000/01000/01000/01000/01000/01110',
    ']':'01110/00010/00010/00010/00010/00010/01110',
    '%':'11001/11010/00010/00100/01000/01011/10011',
    '<':'00010/00100/01000/10000/01000/00100/00010',
    '>':'01000/00100/00010/00001/00010/00100/01000',
    '*':'00000/10101/01110/11111/01110/10101/00000',
    '#':'01010/11111/01010/01010/01010/11111/01010',
    '"':'01010/01010/00000/00000/00000/00000/00000',
    "'":'00100/00100/00000/00000/00000/00000/00000',
    '@':'01110/10001/10111/10101/10111/10000/01110'
  };

  const GLYPH = {};
  for (const k in G) GLYPH[k] = G[k].split('/').map((r) => r.split('').map(Number));
  const MISS = GLYPH['?'];

  const textW = (str, s = 1, sp = 1) => (str.length ? str.length * (5 + sp) * s - sp * s : 0);

  function text(c, str, x, y, col, s = 1, sp = 1, alpha = 1) {
    if (alpha <= 0.02) return;
    const prev = c.globalAlpha;
    if (alpha < 1) c.globalAlpha = prev * alpha;
    c.fillStyle = col;
    str = String(str).toUpperCase();
    let cx = Math.round(x);
    for (let i = 0; i < str.length; i++) {
      const g = GLYPH[str[i]] || MISS;
      for (let ry = 0; ry < 7; ry++) {
        const row = g[ry];
        let run = 0;
        for (let rx = 0; rx <= 5; rx++) {
          if (rx < 5 && row[rx]) { run++; continue; }
          if (run) { c.fillRect(cx + (rx - run) * s, Math.round(y) + ry * s, run * s, s); run = 0; }
        }
      }
      cx += (5 + sp) * s;
    }
    c.globalAlpha = prev;
  }

  const textC = (c, str, cx, y, col, s = 1, sp = 1, a = 1) =>
    text(c, str, Math.round(cx - textW(String(str), s, sp) / 2), y, col, s, sp, a);

  /* separador de miles a la española */
  const num = (n) => Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  /* ---------- sprites ---------- */

  const PAL = {
    '.': null, 'k': COL.void, '1': COL.deep, '2': COL.dark, '3': COL.grey,
    '4': COL.grey2, '5': COL.dust, '6': COL.dim, 'w': COL.bone, 'W': COL.white,
    'r': COL.redMid, 'R': COL.red, 'd': COL.redDeep, 'g': COL.green, 'b': COL.blue
  };

  const SPR = {
    person: ['..www..','..www..','...w...','.wwwww.','wwwwwww','w.www.w','..www..','..www..','..www..','..w.w..','..w.w..','..w.w..','.ww.ww.'],
    person2:['..www..','..www..','...w...','.wwwww.','wwwwwww','w.www.w','..www..','..www..','.wwww..','.w..w..','.w..w..','.w..w..','ww.ww..'],
    child:  ['.......','..www..','..www..','...w...','.wwwww.','wwwwwww','..www..','..www..','..w.w..','..w.w..','.ww.ww.','.......','.......']
  };

  function sprite(c, rows, x, y, s = 1, tint = null, dissolve = 0, seed = 0) {
    x = Math.round(x); y = Math.round(y);
    for (let ry = 0; ry < rows.length; ry++) {
      const row = rows[ry];
      for (let rx = 0; rx < row.length; rx++) {
        const ch = row[rx];
        if (ch === '.') continue;
        if (dissolve > 0 && hash(seed + ry * 31.7 + rx * 7.3) < dissolve) continue;
        c.fillStyle = tint || PAL[ch] || COL.bone;
        c.fillRect(x + rx * s, y + ry * s, s, s);
      }
    }
  }

  /* ---------- texturas ---------- */

  function dither(c, x, y, w, h, col, dens, seed) {
    c.fillStyle = col;
    const n = Math.round(w * h * dens);
    for (let i = 0; i < n; i++) {
      const px = x + Math.floor(hash(seed + i * 1.7) * w);
      const py = y + Math.floor(hash(seed + i * 3.9 + 0.5) * h);
      c.fillRect(px, py, 1, 1);
    }
  }

  /* grano de vídeo: puntos claros y oscuros repartidos por toda la pantalla */
  function grain(c, amount, t) {
    const n = Math.round(amount * 260);
    const s = Math.floor(t / 55);
    for (let i = 0; i < n; i++) {
      const x = Math.floor(hash(s * 1.13 + i * 2.71) * W);
      const y = Math.floor(hash(s * 3.31 + i * 5.17) * H);
      c.fillStyle = hash(i + s) > 0.6 ? 'rgba(232,227,216,0.16)' : 'rgba(0,0,0,0.35)';
      c.fillRect(x, y, 1, 1);
    }
  }

  /* barrido de líneas más oscuras dentro del propio canvas */
  function interlace(c, alpha) {
    c.fillStyle = `rgba(0,0,0,${alpha})`;
    for (let y = 0; y < H; y += 2) c.fillRect(0, y, W, 1);
  }

  /* desplazamiento horizontal de franjas: el glitch de toda la pieza */
  function tear(c, strength, t, seed = 0) {
    if (strength <= 0) return;
    const slices = 1 + Math.floor(strength * 3);
    for (let i = 0; i < slices; i++) {
      const k = Math.floor(t / 90) + i * 13 + seed;
      if (hash(k) > 0.28 + 0.5 * (1 - strength)) continue;
      const y = Math.floor(hash(k * 1.7) * (H - 8));
      const h = 2 + Math.floor(hash(k * 2.3) * 9);
      const dx = Math.round((hash(k * 3.1) - 0.5) * 30 * strength);
      if (!dx) continue;
      const band = c.getImageData(0, y, W, h);
      c.fillStyle = COL.void; c.fillRect(0, y, W, h);
      c.putImageData(band, dx, y);
      if (hash(k * 4.7) > 0.7) { c.fillStyle = 'rgba(255,30,45,0.22)'; c.fillRect(0, y, W, h); }
    }
  }

  /* marco de interfaz: número de sector, título y estado de la lectura */
  function chrome(c, code, title, p, t, note) {
    text(c, code, 8, 8, COL.red, 1, 1, 0.95);
    text(c, title, 24, 8, COL.dim, 1, 1, 0.8);
    const on = Math.floor(t / 520) % 2 === 0;
    text(c, 'LEC ' + String(Math.round(p * 100)).padStart(3, '0') + '%', W - 8 - textW('LEC 000%'), 8, on ? COL.dim : COL.grey2, 1, 1, 0.75);
    if (note) text(c, note, 8, H - 12, COL.grey2, 1, 1, 0.7);
    /* esquinas del encuadre */
    const corner = (x, y, sx, sy) => {
      R(c, x, y, 5 * sx, 1, COL.grey2); R(c, x, y, 1, 5 * sy, COL.grey2);
    };
    corner(3, 3, 1, 1); corner(W - 4, 3, -1, 1); corner(3, H - 4, 1, -1); corner(W - 4, H - 4, -1, -1);
  }

  /* ================================================================
     01 · MUERTES / PERDIDAS
     Una habitación, un contador y un campo de puntos donde cada punto
     encendido equivale a mil personas.
     ================================================================ */

  const DEATHS = 7010681;                 /* notificados a la OMS, redondeo del panel */
  const D_COLS = 120, D_SX = 3, D_SY = 2, D_X = 12, D_Y = 52, D_TOTAL = 7011;

  let dotBuf = null, dotN = 0;

  function dotField(c, n) {
    if (!dotBuf) { dotBuf = document.createElement('canvas'); dotBuf.width = W; dotBuf.height = H; }
    const b = dotBuf.getContext('2d');
    if (n < dotN) { b.clearRect(0, 0, W, H); dotN = 0; }
    for (let i = dotN; i < n; i++) {
      const v = hash(i * 1.7);
      b.fillStyle = v > 0.9955 ? COL.red : v > 0.62 ? COL.bone : v > 0.24 ? COL.dim : COL.dust;
      b.fillRect(D_X + (i % D_COLS) * D_SX, D_Y + ((i / D_COLS) | 0) * D_SY, 1, 1);
    }
    dotN = n;
    c.drawImage(dotBuf, 0, 0);
  }

  function ecg(ph) {
    if (ph < 0.10) return Math.sin((ph / 0.10) * Math.PI) * 0.18;
    if (ph < 0.14) return -0.18;
    if (ph < 0.19) return 1;
    if (ph < 0.24) return -0.38;
    if (ph < 0.46) return Math.max(0, Math.sin(((ph - 0.28) / 0.18) * Math.PI)) * 0.28;
    return 0;
  }

  function monitor(c, x, y, t, flat) {
    R(c, x, y, 108, 66, COL.dark);
    R(c, x, y, 108, 1, COL.grey2); R(c, x, y + 65, 108, 1, COL.grey2);
    R(c, x, y, 1, 66, COL.grey2);  R(c, x + 107, y, 1, 66, COL.grey2);
    R(c, x + 4, y + 4, 100, 40, COL.void);

    const sx = x + 5, sy = y + 24, amp = 17;
    let prev = sy;
    for (let i = 0; i < 98; i++) {
      let v;
      if (flat) {
        v = (hash(i * 3.3 + Math.floor(t / 400)) - 0.5) * 0.05;
      } else {
        const ph = (((i + t * 0.045) % 74) / 74);
        v = ecg(ph);
      }
      const py = Math.round(sy - v * amp);
      const a = Math.min(py, prev), b2 = Math.max(py, prev);
      c.fillStyle = flat ? COL.red : COL.bone;
      c.fillRect(sx + i, a, 1, b2 - a + 1);
      prev = py;
    }

    /* lecturas: el único verde y el único azul de todo el archivo */
    text(c, flat ? '---' : '062', x + 6, y + 48, flat ? COL.red : COL.bone, 1, 1, 0.9);
    text(c, 'FC', x + 6, y + 56, COL.grey2, 1, 1, 0.8);
    text(c, flat ? '--' : '94', x + 34, y + 48, COL.blue, 1, 1, 0.75);
    text(c, 'SPO2', x + 34, y + 56, COL.grey2, 1, 1, 0.8);
    text(c, flat ? 'ASISTOLIA' : 'ESTABLE', x + 60, y + 48, flat ? COL.red : COL.dim, 1, 1, 0.85);
    if (!flat && Math.floor(t / 740) % 2 === 0) PX(c, x + 102, y + 60, COL.green);
  }

  function bed(c, x, y) {
    R(c, x + 6, y + 30, 3, 9, COL.grey2);  R(c, x + 68, y + 30, 3, 9, COL.grey2);
    R(c, x + 3, y + 39, 9, 3, COL.grey);   R(c, x + 65, y + 39, 9, 3, COL.grey);
    R(c, x, y + 26, 78, 5, COL.grey2);
    R(c, x + 2, y + 17, 74, 9, COL.dust);
    R(c, x + 2, y + 15, 74, 3, COL.dim);
    R(c, x + 12, y + 13, 58, 3, COL.bone);
    R(c, x + 6, y + 8, 20, 8, COL.bone);
    R(c, x - 4, y - 8, 3, 36, COL.grey2);
    R(c, x - 4, y - 8, 16, 2, COL.grey2);
    R(c, x + 4, y - 8, 2, 10, COL.grey);
    R(c, x + 76, y + 2, 3, 26, COL.grey2);
    R(c, x + 76, y + 2, 14, 2, COL.grey2);
  }

  function room(c, t, a, p) {
    const prev = c.globalAlpha; c.globalAlpha = a;
    R(c, 0, 0, W, H, COL.deep);
    R(c, 0, 152, W, 64, '#050505');
    R(c, 0, 152, W, 1, COL.grey);

    /* ventana con persiana, la única luz de la habitación */
    R(c, 40, 30, 76, 56, '#0d0d0d');
    R(c, 40, 30, 76, 1, COL.grey2); R(c, 40, 86, 76, 1, COL.grey2);
    R(c, 40, 30, 1, 57, COL.grey2); R(c, 115, 30, 1, 57, COL.grey2);
    for (let i = 0; i < 12; i++) R(c, 42, 34 + i * 4, 72, 1, i % 2 ? '#151515' : '#1d1d1d');
    dither(c, 42, 32, 72, 52, COL.grey, 0.03, 4);

    bed(c, 38, 108);
    /* gotero */
    R(c, 124, 92, 1, 58, COL.grey2); R(c, 120, 92, 9, 1, COL.grey2);
    R(c, 126, 96, 5, 11, COL.dust);  R(c, 125, 107, 1, 22, COL.grey);

    monitor(c, 236, 84, t, false);
    text(c, 'HABITACION 214', 8, 24, COL.grey2, 1, 1, 0.8);
    text(c, 'SIN VISITAS', 8, 34, COL.redDeep, 1, 1, 0.9);
    text(c, 'MARZO 2020', 8, 44, COL.grey2, 1, 1, 0.6);
    c.globalAlpha = prev;
  }

  function sceneDeaths(c, p, t) {
    R(c, 0, 0, W, H, COL.deep);

    const ra = ease(seg(p, 0.02, 0.18)) * (1 - ease(seg(p, 0.30, 0.46)));
    if (ra > 0.02) room(c, t, ra, p);

    const b = seg(p, 0.26, 0.80);
    if (b > 0) {
      dotField(c, Math.floor(ease(b) * D_TOTAL));
      /* algunos puntos parpadean: la cifra nunca está quieta */
      const s = Math.floor(t / 120);
      for (let i = 0; i < 26; i++) {
        const k = Math.floor(hash(s + i * 2.3) * dotN);
        PX(c, D_X + (k % D_COLS) * D_SX, D_Y + ((k / D_COLS) | 0) * D_SY, hash(k) > 0.5 ? COL.white : COL.void);
      }
    }

    /* las siluetas se deshacen mientras el campo se llena */
    const sil = seg(p, 0.30, 0.66);
    if (sil > 0 && sil < 0.999) {
      for (let i = 0; i < 9; i++) {
        const d = c01((sil - i * 0.05) * 2.1);
        if (d >= 1) continue;
        const spr = i % 3 === 0 ? SPR.person2 : i % 5 === 0 ? SPR.child : SPR.person;
        sprite(c, spr, 26 + i * 38, 176, 2, d > 0.55 ? COL.dust : COL.bone, d, i * 97.3);
      }
    }

    if (b > 0.001) {
      const shown = Math.floor(ease(b) * DEATHS);
      const flick = Math.floor(t / 90) % 7 === 0 && b < 0.999;
      textC(c, num(shown), W / 2, 18, flick ? COL.white : COL.bone, 3, 1, 1);
      textC(c, 'FALLECIMIENTOS NOTIFICADOS A LA OMS', W / 2, 44, COL.grey2, 1, 1, 0.9);
    }

    const fin = ease(seg(p, 0.80, 1));
    if (fin > 0) {
      c.fillStyle = `rgba(0,0,0,${0.5 * fin})`; c.fillRect(0, 0, W, H);
      R(c, 0, 110, Math.round(W * fin), 1, COL.red);
      if (fin > 0.35) {
        const a = c01((fin - 0.35) / 0.4);
        textC(c, 'CADA PUNTO ENCENDIDO = 1.000 PERSONAS', W / 2, 188, COL.bone, 1, 1, a * 0.9);
        textC(c, 'NINGUNA DE ELLAS ERA UN NUMERO', W / 2, 200, COL.redDeep, 1, 1, a);
      }
    }

    chrome(c, '01', 'MUERTES / PERDIDAS', p, t, null);
    grain(c, 0.5, t);
    interlace(c, 0.22);
    tear(c, 0.25 + fin * 0.35, t, 1);
  }

  /* ================================================================
     02 · AISLAMIENTO / HOSPITAL
     Un pasillo infinito recorrido en primera persona.
     ================================================================ */

  const CX = 192, CY = 104, HW = 150, HH = 92;
  const wallX = (dz, s) => CX + (s * HW) / dz;
  const wallY = (dz, f) => CY - (f * HH) / dz;

  const DOORS = [];
  for (let i = 0; i < 22; i++) {
    DOORS.push({ z: 1.6 + i * 1.15, s: i % 2 ? 1 : -1, red: hash(i * 5.1) > 0.72 });
  }

  /* aristas continuas del pasillo: lo que fija la perspectiva */
  function corners(c) {
    for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      for (let dz = 0.34; dz < 26; dz *= 1.006) {
        const x = CX + (sx * HW) / dz, y = CY - (sy * HH) / dz;
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        c.globalAlpha = clamp(0.8 / dz, 0.05, 0.55);
        c.fillStyle = COL.grey2;
        c.fillRect(x | 0, y | 0, 1, 1);
      }
    }
    c.globalAlpha = 1;
  }

  /* puerta cerrada sobre una de las dos paredes */
  function doorQuad(c, zN, zF, s, camZ, lit) {
    const dN = zN - camZ, dF = zF - camZ;
    if (dF < 0.45 || dN > 24) return;
    const dn = Math.max(dN, 0.45);
    const x1 = wallX(dn, s), x2 = wallX(dF, s);
    const a = Math.max(Math.round(Math.min(x1, x2)), 0);
    const b = Math.min(Math.round(Math.max(x1, x2)), W - 1);
    if (b <= a) return;
    for (let x = a; x <= b; x++) {
      const dz = (s * HW) / (x - CX);
      if (dz < 0.45 || dz > 40) continue;
      const yT = Math.round(wallY(dz, 0.72)), yB = Math.round(wallY(dz, -0.98));
      const h = Math.max(1, yB - yT);
      const edge = (x === a || x === b);
      c.globalAlpha = clamp(0.85 / dz, 0.05, 0.55);
      c.fillStyle = edge ? COL.dim : COL.grey;
      c.fillRect(x, yT, 1, h);
      c.fillStyle = COL.grey2;
      c.fillRect(x, yT, 1, Math.max(1, Math.round(3 / dz)));
      if (!edge && x > a + (b - a) * 0.28 && x < b - (b - a) * 0.28) {
        c.fillStyle = lit ? COL.dust : COL.dark;
        c.fillRect(x, yT + Math.round(h * 0.16), 1, Math.max(1, Math.round(h * 0.24)));
      }
      c.globalAlpha = 1;
    }
  }

  /* franjas del techo y del suelo, recorridas por filas de píxeles */
  function band(c, zN, zF, camZ, up, halfW, col, a, minDz) {
    const f = up ? 0.97 : -0.98;
    const lim = minDz || 0.45;
    const dN = Math.max(zN - camZ, lim), dF = zF - camZ;
    if (dF < lim) return;
    const yA = wallY(dN, f), yB = wallY(dF, f);
    const lo = Math.round(Math.min(yA, yB)), hi = Math.round(Math.max(yA, yB));
    for (let y = lo; y <= hi; y++) {
      if (y < 0 || y >= H) continue;
      const dz = (f * HH) / (CY - y);
      if (dz < lim || dz > 40) continue;
      const hw = Math.max(1, Math.round(halfW / dz));
      c.globalAlpha = clamp(1.15 / dz, 0.04, 0.9) * a;
      c.fillStyle = col;
      c.fillRect(CX - hw, y, hw * 2, 1);
    }
    c.globalAlpha = 1;
  }

  function ring(c, dz, col, a) {
    if (dz < 0.34) return;
    const x1 = Math.round(wallX(dz, -1)), x2 = Math.round(wallX(dz, 1));
    const y1 = Math.round(wallY(dz, 1)), y2 = Math.round(wallY(dz, -1));
    c.globalAlpha = a;
    c.fillStyle = col;
    c.fillRect(Math.max(x1, -10), y1, Math.min(x2 - x1, W + 20), 1);
    c.fillRect(Math.max(x1, -10), y2, Math.min(x2 - x1, W + 20), 1);
    if (x1 > -10) c.fillRect(x1, y1, 1, y2 - y1);
    if (x2 < W + 10) c.fillRect(x2, y1, 1, y2 - y1);
    c.globalAlpha = 1;
  }

  function gurney(c, dz, off) {
    if (dz < 0.8 || dz > 20) return;
    const s = clamp(Math.round(11 / dz), 1, 7);
    const x = Math.round(CX + (off * HW) / dz) - 7 * s;
    const y = Math.round(wallY(dz, -0.98)) - 9 * s;
    const rows = ['.wwwwwwwwwwww.', '.4444444444444', '..3..........3', '..3..........3', '.33..........33'];
    c.globalAlpha = clamp(1.15 / dz, 0.1, 1);
    sprite(c, rows, x, y, s);
    c.globalAlpha = 1;
  }

  function figure(c, dz, off, spr, a) {
    if (dz < 0.9 || dz > 22) return;
    const s = clamp(Math.round(9 / dz), 1, 6);
    const x = Math.round(CX + (off * HW) / dz) - 3 * s;
    const y = Math.round(wallY(dz, -0.98)) - 13 * s;
    c.globalAlpha = clamp(1.1 / dz, 0.08, 1) * a;
    sprite(c, spr, x, y, s, COL.dust);
    c.globalAlpha = 1;
  }

  function waves(c, t) {
    const base = 204;
    R(c, 0, 192, W, 1, COL.grey);
    for (let x = 0; x < W; x++) {
      const dead = hash(Math.floor(x / 14) + Math.floor(t / 700)) > 0.86;
      let v;
      if (dead) v = (hash(x + Math.floor(t / 60)) - 0.5) * 3;
      else {
        v = Math.sin(x * 0.21 + t * 0.006) * 4
          + Math.sin(x * 0.07 - t * 0.0031) * 3
          + (hash(x * 1.7 + Math.floor(t / 90)) - 0.5) * 3.5;
        v *= 0.5 + 0.5 * Math.sin(t * 0.0012 + x * 0.01);
      }
      const h = Math.max(1, Math.abs(Math.round(v)));
      c.fillStyle = dead ? COL.redDeep : h > 6 ? COL.bone : COL.dust;
      c.fillRect(x, base - h, 1, h * 2);
    }
  }

  function sceneHospital(c, p, t) {
    R(c, 0, 0, W, H, COL.void);
    const camZ = p * 13;
    const flick = hash(Math.floor(t / 130)) > 0.1 ? 1 : 0.35;

    corners(c);

    /* cortes transversales del pasillo, en bucle */
    for (let i = 34; i >= 0; i--) {
      const dz = i * 0.62 - (camZ % 0.62);
      if (dz < 0.34 || dz > 24) continue;
      ring(c, dz, COL.grey2, clamp(0.8 / dz, 0.04, 0.5) * flick);
    }

    /* suelo: marcas de distancia */
    for (let i = 0; i < 26; i++) {
      const z = 1 + i * 1.05;
      band(c, z, z + 0.12, camZ, false, 96, i % 3 === 0 ? COL.redDeep : COL.grey, 0.9);
    }

    /* puertas */
    for (let i = DOORS.length - 1; i >= 0; i--) {
      const d = DOORS[i];
      doorQuad(c, d.z, d.z + 0.7, d.s, camZ, d.red);
      const dz = d.z + 0.35 - camZ;
      if (d.red && dz > 0.8 && dz < 12 && Math.floor(t / 640 + i) % 2 === 0) {
        c.globalAlpha = clamp(1 / dz, 0.1, 1);
        R(c, Math.round(wallX(dz, d.s)) - d.s * 5, Math.round(wallY(dz, 0.72)) - 3, 3, 2, COL.red);
        c.globalAlpha = 1;
      }
    }

    /* fluorescentes: los que quedan encendidos */
    for (let i = 0; i < 24; i++) {
      const z = 1.2 + i * 1.05;
      const on = hash(i * 3.7 + Math.floor(t / (300 + i * 41))) > 0.13;
      band(c, z, z + 0.42, camZ, true, 22, COL.bone, on ? flick : 0.14, 0.85);
    }

    gurney(c, 5.2 - camZ, -0.55);
    gurney(c, 10.4 - camZ, 0.52);
    figure(c, 7.6 - camZ, 0.12, SPR.person, hash(Math.floor(t / 900)) > 0.25 ? 1 : 0.3);
    figure(c, 12.4 - camZ, -0.22, SPR.person2, 0.8);

    const lines = [
      [0.03, 0.24, 'PLANTA 4 - ALA B'],
      [0.27, 0.48, 'PROHIBIDAS LAS VISITAS'],
      [0.51, 0.72, '23:40 - NADIE ACOMPANA A NADIE'],
      [0.75, 0.98, 'DESDE AQUI SE OYE TODO']
    ];
    for (const [a, b, str] of lines) {
      if (p < a || p > b) continue;
      const k = (p - a) / (b - a);
      const al = Math.min(ease(k / 0.25), ease((1 - k) / 0.25));
      textC(c, str, W / 2 + (hash(Math.floor(t / 130)) > 0.93 ? 1 : 0), 168, COL.bone, 1, 1, al * 0.95);
    }

    waves(c, t);
    chrome(c, '02', 'AISLAMIENTO / HOSPITAL', p, t, null);
    text(c, 'PUERTAS ' + String(Math.floor(p * 22)).padStart(2, '0') + '/22', 8, 22, COL.grey2, 1, 1, 0.75);
    text(c, 'ENTRADA DE AUDIO', W - 8 - textW('ENTRADA DE AUDIO'), 22, COL.grey2, 1, 1, 0.55);
    grain(c, 0.7, t);
    interlace(c, 0.26);
    tear(c, 0.45, t, 7);
  }

  /* ================================================================
     03 · MASCARILLAS
     Dieciocho rostros separados entre sí, que llegan corruptos y se
     pierden como datos dañados.
     ================================================================ */

  const MASK_NAMES = ['QUIRURG.', 'FFP2', 'TELA', 'PANUELO'];
  const FACE_N = 18;
  const faceCache = [];

  function faceBuf(i) {
    if (faceCache[i]) return faceCache[i];
    const g = Array.from({ length: 16 }, () => Array(16).fill(null));
    const put = (py, a, b, col) => { for (let px = a; px <= b; px++) if (py >= 0 && py < 16 && px >= 0 && px < 16) g[py][px] = col; };
    const type = i % 4;
    const hair = Math.floor(hash(i * 9.1) * 4);
    const skin = hash(i * 4.4) > 0.5 ? COL.dim : COL.dust;

    /* cabeza */
    put(2, 4, 11, skin); put(3, 3, 12, skin); put(4, 3, 12, skin); put(5, 3, 12, skin);
    put(6, 3, 12, skin); put(7, 3, 12, skin); put(8, 3, 12, skin); put(9, 3, 12, skin);
    put(10, 3, 12, skin); put(11, 4, 11, skin); put(12, 5, 10, skin);
    /* pelo */
    if (hair === 0) { put(1, 4, 11, COL.grey); put(2, 3, 12, COL.grey); put(3, 3, 4, COL.grey); put(3, 11, 12, COL.grey); }
    if (hair === 1) { put(1, 4, 11, COL.grey2); put(2, 3, 12, COL.grey2); }
    if (hair === 2) { put(1, 5, 10, COL.grey); put(2, 4, 11, COL.grey); put(3, 3, 3, COL.grey); put(4, 3, 3, COL.grey); put(3, 12, 12, COL.grey); put(4, 12, 12, COL.grey); }
    if (hair === 3) { put(2, 4, 11, COL.grey2); put(1, 6, 9, COL.grey2); }
    /* ojos: lo único que quedó de la cara */
    g[6][5] = COL.void; g[6][10] = COL.void;
    g[5][5] = COL.bone; g[5][10] = COL.bone;
    /* hombros */
    put(14, 2, 13, COL.grey); put(15, 1, 14, COL.grey);
    put(13, 6, 9, skin);

    if (type === 0) {           /* quirúrgica */
      put(8, 3, 12, COL.bone); put(9, 3, 12, COL.dim); put(10, 3, 12, COL.bone);
      put(11, 4, 11, COL.dim); put(12, 5, 10, COL.bone);
      g[8][2] = COL.grey2; g[8][13] = COL.grey2; g[9][2] = COL.grey2; g[9][13] = COL.grey2;
      g[7][2] = COL.grey2; g[7][13] = COL.grey2;
    } else if (type === 1) {    /* FFP2 */
      put(7, 4, 11, COL.dim); put(8, 3, 12, COL.bone); put(9, 3, 12, COL.bone);
      put(10, 4, 11, COL.bone); put(11, 5, 10, COL.bone); put(12, 6, 9, COL.dim);
      g[7][6] = COL.grey2; g[7][9] = COL.grey2;
      g[8][2] = COL.grey2; g[8][13] = COL.grey2;
    } else if (type === 2) {    /* tela */
      for (let py = 8; py <= 12; py++) for (let px = 3; px <= 12; px++) {
        if (py === 12 && (px < 5 || px > 10)) continue;
        if (py === 11 && (px < 4 || px > 11)) continue;
        g[py][px] = (px + py) % 2 ? COL.dust : COL.dim;
      }
      g[8][2] = COL.grey2; g[8][13] = COL.grey2;
    } else {                    /* pañuelo improvisado */
      put(8, 2, 13, COL.dust); put(9, 2, 13, COL.dust); put(10, 3, 12, COL.dust);
      put(11, 4, 11, COL.dust); put(12, 5, 10, COL.dust);
      g[9][4] = COL.redDeep; g[10][7] = COL.redDeep; g[11][9] = COL.redDeep;
      g[8][1] = COL.dust; g[9][14] = COL.dust;
    }
    faceCache[i] = { g, type };
    return faceCache[i];
  }

  function blitFace(c, buf, x, y, s, corrupt, seedn, t) {
    const g = buf.g, k = Math.floor(t / 80);
    for (let py = 0; py < 16; py++) {
      let dx = 0;
      if (corrupt > 0) {
        const rs = hash(seedn + py * 3.1 + k);
        if (rs < corrupt * 0.30) continue;                                   /* fila perdida */
        if (rs < corrupt * 0.75) dx = Math.round((hash(seedn + py * 7.7 + k) - 0.5) * 12 * corrupt);
      }
      for (let px = 0; px < 16; px++) {
        let col = g[py][px];
        if (corrupt > 0.05 && hash(seedn + py * 13.3 + px * 2.7 + k) < corrupt * 0.10) {
          col = hash(px + py + k) > 0.65 ? COL.red : COL.bone;
        }
        if (!col) continue;
        c.fillStyle = col;
        c.fillRect(x + (px + dx) * s, y + py * s, s, s);
      }
    }
  }

  function sceneMasks(c, p, t) {
    R(c, 0, 0, W, H, COL.deep);
    dither(c, 0, 0, W, H, COL.dark, 0.02, 21);

    let alive = 0;
    for (let i = 0; i < FACE_N; i++) {
      const col = i % 6, row = (i / 6) | 0;
      const x = 22 + col * 60, y = 36 + row * 52;
      const appear = 0.03 + i * 0.026;
      const vanish = 0.54 + hash(i * 6.7) * 0.36;
      const buf = faceBuf(i);

      if (p < appear) {                       /* hueco todavía sin leer */
        c.globalAlpha = 0.5;
        dither(c, x, y, 32, 32, COL.grey, 0.05, i * 31);
        c.globalAlpha = 1;
        continue;
      }
      const gone = p > vanish + 0.05;
      if (gone) {
        R(c, x + 2, y + 14, 28, 1, COL.grey);
        text(c, 'SIN DATOS', x - 1, y + 34, COL.redDeep, 1, 1, 0.8);
        continue;
      }
      alive++;
      let corrupt = 1 - c01((p - appear) / 0.045);
      if (p > vanish) corrupt = Math.max(corrupt, c01((p - vanish) / 0.05));
      if (corrupt < 0.05 && hash(i + Math.floor(t / 900)) > 0.9) corrupt = 0.12;

      blitFace(c, buf, x, y, 2, corrupt, i * 17.3, t);
      text(c, MASK_NAMES[buf.type], x - 1, y + 34, corrupt > 0.4 ? COL.red : COL.grey2, 1, 1, 0.75);
    }

    /* dos metros de vacío, dibujados */
    const px1 = 148, px2 = 228;
    sprite(c, SPR.person, px1, 182, 1, COL.dust);
    sprite(c, SPR.person2, px2, 182, 1, COL.dust);
    for (let x = px1 + 10; x < px2; x += 4) PX(c, x, 188, COL.redDeep);
    textC(c, '2 M', (px1 + px2) / 2 + 4, 194, COL.red, 1, 1, 0.85);
    textC(c, 'LA DISTANCIA TAMBIEN SE APRENDIO DE MEMORIA', W / 2, 204, COL.grey2, 1, 1, 0.7);

    chrome(c, '03', 'MASCARILLAS', p, t, null);
    text(c, 'ROSTROS LEGIBLES ' + String(alive).padStart(2, '0') + '/' + FACE_N, 8, 22, COL.grey2, 1, 1, 0.75);
    grain(c, 0.6, t);
    interlace(c, 0.24);
    tear(c, 0.55, t, 13);
  }

  /* ================================================================
     04 · VACUNAS
     Un inventario de videojuego antiguo que va desbloqueando objetos.
     ================================================================ */

  const ITEMS = [
    { name: 'VIAL', at: 0.06 },
    { name: 'JERINGA', at: 0.21 },
    { name: 'NEVERA', at: 0.36 },
    { name: 'CARTILLA', at: 0.51 },
    { name: 'CAMPANA', at: 0.66 }
  ];

  function item(c, idx, x, y, s) {
    const g = (px, py, w, h, col) => R(c, x + px * s, y + py * s, w * s, h * s, col);
    if (idx === 0) {                       /* vial */
      g(6, 1, 4, 2, COL.grey2); g(6, 3, 4, 1, COL.dim);
      g(5, 4, 6, 11, COL.grey); g(6, 5, 4, 9, COL.dust);
      g(6, 9, 4, 5, COL.bone);
      g(5, 8, 6, 1, COL.redDeep);
      g(5, 4, 1, 11, COL.dim); g(10, 4, 1, 11, COL.dim);
    } else if (idx === 1) {                /* jeringa */
      g(1, 7, 4, 1, COL.dim);
      g(5, 5, 7, 5, COL.grey); g(5, 6, 7, 3, COL.bone);
      g(12, 4, 2, 7, COL.grey2); g(14, 6, 1, 3, COL.dim);
      g(7, 5, 1, 1, COL.redDeep); g(9, 5, 1, 1, COL.redDeep); g(11, 5, 1, 1, COL.redDeep);
    } else if (idx === 2) {                /* nevera de transporte */
      g(2, 4, 12, 10, COL.grey);
      g(2, 4, 12, 2, COL.dust);
      g(6, 2, 4, 2, COL.grey2);
      g(3, 7, 10, 6, COL.dark);
      g(7, 8, 2, 4, COL.red); g(6, 9, 4, 2, COL.red);
      g(3, 13, 10, 1, COL.grey2);
    } else if (idx === 3) {                /* cartilla de vacunación */
      g(1, 3, 14, 10, COL.bone);
      g(1, 3, 14, 2, COL.dust);
      g(3, 6, 6, 1, COL.grey2); g(3, 8, 8, 1, COL.grey2); g(3, 10, 5, 1, COL.grey2);
      g(11, 7, 3, 4, COL.redDeep); g(12, 8, 1, 2, COL.red);
    } else {                               /* campaña pública */
      g(7, 10, 2, 6, COL.grey2);
      g(1, 1, 14, 9, COL.dark);
      g(1, 1, 14, 1, COL.dust); g(1, 9, 14, 1, COL.dust);
      g(1, 1, 1, 9, COL.dust); g(14, 1, 1, 9, COL.dust);
      g(4, 3, 2, 2, COL.bone); g(3, 5, 4, 3, COL.bone);
      g(8, 4, 5, 1, COL.grey2); g(8, 6, 5, 1, COL.grey2);
      g(8, 8, 3, 1, COL.redDeep);
    }
  }

  function sceneVaccines(c, p, t) {
    /* la atmósfera se aclara, pero solo un poco */
    const warm = ease(seg(p, 0.1, 0.9));
    R(c, 0, 0, W, H, warm > 0.5 ? '#101010' : COL.deep);
    c.fillStyle = 'rgba(232,227,216,0.02)';
    for (let x = 8; x < W; x += 16) c.fillRect(x, 0, 1, H);
    for (let y = 8; y < H; y += 16) c.fillRect(0, y, W, 1);

    /* marco del inventario */
    const fx = 46, fy = 44, fw = 292, fh = 94;
    R(c, fx, fy, fw, fh, 'rgba(0,0,0,0.6)');
    R(c, fx, fy, fw, 1, COL.dim); R(c, fx, fy + fh - 1, fw, 1, COL.dim);
    R(c, fx, fy, 1, fh, COL.dim); R(c, fx + fw - 1, fy, 1, fh, COL.dim);
    R(c, fx + 2, fy + 2, fw - 4, 1, COL.grey2); R(c, fx + 2, fy + fh - 3, fw - 4, 1, COL.grey2);
    text(c, 'INVENTARIO', fx + 6, fy - 10, COL.dim, 1, 1, 0.9);
    text(c, String(Math.min(5, ITEMS.filter((it) => p >= it.at).length)) + '/5', fx + fw - 20, fy - 10, COL.red, 1, 1, 0.9);

    let justUnlocked = null;
    for (let i = 0; i < ITEMS.length; i++) {
      const it = ITEMS[i];
      const x = fx + 12 + i * 54, y = fy + 16;
      R(c, x, y, 48, 48, 'rgba(0,0,0,0.5)');
      const on = p >= it.at;
      const k = c01((p - it.at) / 0.05);
      R(c, x, y, 48, 1, on ? COL.grey2 : COL.grey);
      R(c, x, y + 47, 48, 1, on ? COL.grey2 : COL.grey);
      R(c, x, y, 1, 48, on ? COL.grey2 : COL.grey);
      R(c, x + 47, y, 1, 48, on ? COL.grey2 : COL.grey);

      if (!on) {
        textC(c, '?', x + 24, y + 17, COL.grey2, 2, 1, 0.7);
        dither(c, x + 4, y + 4, 40, 40, COL.grey, 0.03, i * 13);
        continue;
      }
      if (k < 1) {
        justUnlocked = it.name;
        c.fillStyle = `rgba(232,227,216,${(1 - k) * 0.9})`;
        c.fillRect(x, y, 48, 48);
      }
      item(c, i, x + 8, y + 8, 2);
      textC(c, it.name, x + 24, y + 52, COL.grey2, 1, 1, 0.8);

      /* chispas del desbloqueo */
      if (k < 1) {
        for (let s2 = 0; s2 < 10; s2++) {
          const a = hash(i * 3.3 + s2) * Math.PI * 2, r = 6 + k * 26;
          PX(c, x + 24 + Math.cos(a) * r, y + 24 + Math.sin(a) * r, COL.bone);
        }
      }
    }

    if (justUnlocked) {
      const blink = Math.floor(t / 110) % 2 === 0;
      textC(c, 'OBJETO DESBLOQUEADO', W / 2, 30, blink ? COL.red : COL.bone, 1, 1, 1);
    }

    /* dosis administradas */
    const doses = Math.floor(ease(seg(p, 0.15, 0.95)) * 13567000000);
    textC(c, num(doses), W / 2, 148, COL.bone, 2, 1, 0.95);
    textC(c, 'DOSIS ADMINISTRADAS EN EL MUNDO', W / 2, 166, COL.grey2, 1, 1, 0.85);

    /* la barra que nunca termina de resolverse */
    const bx = 92, bw = 200;
    R(c, bx, 182, bw, 7, COL.void);
    R(c, bx, 182, bw, 1, COL.grey2); R(c, bx, 188, bw, 1, COL.grey2);
    R(c, bx, 182, 1, 7, COL.grey2); R(c, bx + bw - 1, 182, 1, 7, COL.grey2);
    const fill = Math.round(bw * (0.62 + Math.sin(t * 0.0011) * 0.05) * ease(seg(p, 0.2, 0.8)));
    for (let x = 0; x < fill - 2; x += 3) R(c, bx + 1 + x, 184, 2, 3, hash(x + Math.floor(t / 200)) > 0.08 ? COL.red : COL.void);
    const q = Math.floor(t / 260) % 3;
    text(c, 'CERTEZA ' + (q === 0 ? '??' : q === 1 ? '?%' : '--') + ' ', bx + bw + 6, 182, COL.grey2, 1, 1, 0.8);
    text(c, 'ESPERANZA', bx - 62, 182, COL.dim, 1, 1, 0.8);

    if (p > 0.86) textC(c, 'NADIE SABIA CUANTO DURARIA NI A QUIEN LLEGARIA PRIMERO', W / 2, 200, COL.dim, 1, 1, ease(seg(p, 0.86, 0.97)) * 0.9);

    chrome(c, '04', 'VACUNAS', p, t, null);
    grain(c, 0.4, t);
    interlace(c, 0.2);
    tear(c, 0.18, t, 29);
  }

  /* ================================================================
     05 · MEMORIA
     Miles de píxeles que se apagan hasta que queda uno.
     ================================================================ */

  const MEM = [];
  for (let i = 0; i < 3400; i++) {
    MEM.push({
      x: 6 + Math.floor(hash(i * 1.13) * (W - 12)),
      y: 24 + Math.floor(hash(i * 2.71 + 4.2) * (H - 56)),
      die: 0.05 + hash(i * 3.77 + 1.1) * 0.80,
      v: hash(i * 5.19)
    });
  }

  function sceneMemory(c, p, t) {
    R(c, 0, 0, W, H, COL.void);
    const q = p * 1.02;

    for (let i = 0; i < MEM.length; i++) {
      const m = MEM[i];
      if (q > m.die) continue;
      let col = m.v > 0.985 ? COL.red : m.v > 0.55 ? COL.bone : m.v > 0.2 ? COL.dim : COL.dust;
      /* titilan justo antes de apagarse */
      if (m.die - q < 0.05 && hash(i + Math.floor(t / 90)) > 0.5) col = COL.grey;
      c.fillStyle = col;
      c.fillRect(m.x, m.y, 1, 1);
    }

    /* el último */
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.0035);
    const last = p > 0.86;
    if (last) {
      const s = p > 0.95 ? 2 : 1;
      R(c, W / 2 - (s - 1), H / 2 - (s - 1), s, s, pulse > 0.5 ? COL.bone : COL.red);
      if (p > 0.9) {
        c.fillStyle = `rgba(255,30,45,${0.10 * pulse})`;
        c.fillRect(W / 2 - 6, H / 2 - 6, 13, 13);
      }
    }

    const cap = [
      [0.00, 0.22, 'CADA PIXEL FUE ALGUIEN, ALGO, UN DIA CUALQUIERA'],
      [0.24, 0.52, 'SE APAGAN EN EL ORDEN EN QUE DEJAMOS DE NOMBRARLOS'],
      [0.54, 0.82, 'NO CABEN EN NINGUNA CIFRA'],
      [0.86, 1.00, 'QUEDA UNO']
    ];
    for (const [a, b, s] of cap) {
      if (p < a || p > b) continue;
      const k = (p - a) / (b - a);
      const al = Math.min(ease(k / 0.2), ease((1 - k) / 0.2));
      textC(c, s, W / 2, 186, s === 'QUEDA UNO' ? COL.red : COL.dim, 1, 1, al * 0.95);
    }
    if (p > 0.965) textC(c, 'NO LO APAGUES', W / 2, 198, COL.bone, 1, 1, ease(seg(p, 0.965, 1)) * 0.9);

    chrome(c, '05', 'MEMORIA', p, t, null);
    grain(c, 0.25, t);
    interlace(c, 0.18);
    if (p < 0.5) tear(c, 0.12, t, 41);
  }

  /* ---------- lo que se lleva a las dos páginas ---------- */

  window.ARCHIVO = {
    W, H, COL, PAL, SPR,
    scenes: {
      deaths: sceneDeaths, hospital: sceneHospital,
      masks: sceneMasks, vaccines: sceneVaccines, memory: sceneMemory
    },
    clamp, c01, lerp, ease, easeIn, seg, hash, num,
    R, PX, text, textC, textW, sprite, dither, grain, interlace, tear, chrome
  };

})();
