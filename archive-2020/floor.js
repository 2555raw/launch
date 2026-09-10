/* ARCHIVE 2020 — mode 02: four floors.

   A top-down hospital seen from the ceiling camera. Every floor hands you a
   short list of tasks; finish the list and the way up opens. The lobby has one
   working lift out of four, the ward hides a key, the ICU has something that
   follows you, and the stores hold the vaccine.

   8 px tiles, a camera that trails the character, lighting by blocks, and the
   five archive records hidden on wall terminals along the way. */

(() => {
  'use strict';

  const A = window.ARCHIVE;
  const { W, H, COL, R, text, textC, textW, sprite, hash, clamp, c01, lerp } = A;

  const T = 8;
  const BLOOD = '#4a060d', BLOOD2 = '#2c0308';

  /* The prize for the first clear. Paste the contract address into `ca` and it
     shows up on the end screen, in the copied claim and in the ready-made post. */
  const COIN = { ticker: 'PANDEMIK', ca: '' };

  /* ================================================================
     Characters
     ================================================================ */

  const BODY = {
    down: ['..66666..', '.6555556.', '.6555556.', '.65k5k56.', '.6wwwww6.', '..wwwww..', '.wwwwwww.', 'wwwwwwwww', 'wwwwwwwww', 'ww66666ww', '.wwwwwww.'],
    up:   ['..66666..', '.6666666.', '.6666666.', '.6666666.', '..66666..', '..wwwww..', '.wwwwwww.', 'wwwwwwwww', 'wwwwwwwww', 'wwwwwwwww', '.wwwwwww.'],
    side: ['..6666...', '.655556..', '.655556..', '.65k555..', '.6wwww5..', '..wwww...', '.wwwww...', '.wwwwww..', '.wwwwww..', '.wwwwww..', '.wwwww...']
  };
  const ZOMB = {
    down: ['..33333..', '.3555553.', '.3555553.', '.35R5R53.', '.35555k3.', '..5kkk5..', '.5555555.', '5rr555rr5', '55555r555', '5r5555555', '.5555r55.'],
    up:   ['..33333..', '.3333333.', '.3333333.', '.3333353.', '..33333..', '..55555..', '.5555555.', '555555555', '55r555555', '555555r55', '.5555555.'],
    side: ['..3333...', '.355553..', '.355553..', '.35R555..', '.355k55..', '..5555...', '.55555...', '.55r555..', '.555555..', '.5r5555..', '.55555...']
  };
  const mirror = (rows) => rows.map((r) => r.split('').reverse().join(''));
  BODY.sideL = mirror(BODY.side);
  ZOMB.sideL = mirror(ZOMB.side);

  function walker(c, set, x, y, dir, step, moving, tint) {
    const bob = moving && step % 2 ? 1 : 0;
    R(c, x - 4, y - 1, 9, 2, 'rgba(0,0,0,0.55)');
    const rows = dir === 'up' ? set.up : dir === 'left' ? set.sideL : dir === 'right' ? set.side : set.down;
    sprite(c, rows, x - 4, y - 14 - bob, 1, tint || null);
    const a = moving ? (step % 2 ? 1 : 0) : 0;
    const b = moving ? (step % 2 ? 0 : 1) : 0;
    const leg = tint || COL.grey;
    R(c, x - 3, y - 3 - bob + a, 2, 3, leg);
    R(c, x + 2, y - 3 - bob + b, 2, 3, leg);
    R(c, x - 3, y - bob + a, 2, 1, COL.grey2);
    R(c, x + 2, y - bob + b, 2, 1, COL.grey2);
  }

  /* ================================================================
     Props
     ================================================================ */

  const SIZE = {
    bed: [2, 3], gurney: [3, 2], mon: [1, 1], iv: [1, 1], desk: [1, 1], table: [1, 1],
    chair: [1, 1], locker: [1, 2], shelf: [1, 1], box: [1, 1], fridge: [2, 2],
    body: [2, 2], vending: [1, 2], sign: [2, 1], plantpot: [1, 1], tray: [1, 1]
  };

  function prop(c, p, sx, sy) {
    const x = p.x * T - sx, y = p.y * T - sy, k = p.k, w = (p.w || 1) * T;
    if (k === 'bed') {
      R(c, x, y, 16, 24, COL.grey); R(c, x + 1, y + 1, 14, 22, COL.dark);
      R(c, x + 2, y + 2, 12, 7, COL.bone); R(c, x + 2, y + 10, 12, 12, COL.dust);
      R(c, x + 2, y + 14, 12, 1, COL.dim); R(c, x, y + 22, 16, 2, COL.grey2);
    } else if (k === 'gurney') {
      R(c, x, y, 24, 16, COL.grey); R(c, x + 1, y + 1, 22, 14, COL.dark);
      R(c, x + 2, y + 2, 8, 12, COL.bone); R(c, x + 11, y + 2, 11, 12, COL.dust);
    } else if (k === 'mon') {
      R(c, x + 1, y + 1, 6, 6, COL.grey2); R(c, x + 2, y + 2, 4, 3, COL.void);
      R(c, x + 2, y + 3, 4, 1, COL.red); R(c, x + 2, y + 6, 4, 1, COL.grey);
    } else if (k === 'iv') {
      R(c, x + 3, y + 1, 1, 6, COL.grey2); R(c, x + 2, y + 1, 3, 3, COL.dust);
      R(c, x + 2, y + 6, 3, 1, COL.grey);
    } else if (k === 'desk') {
      R(c, x, y, w, 8, COL.grey2); R(c, x, y, w, 2, COL.dust); R(c, x + 2, y + 4, w - 4, 1, COL.grey);
    } else if (k === 'table') {
      R(c, x, y, w, 8, COL.grey); R(c, x, y, w, 1, COL.dim);
      for (let i = 0; i < w - 4; i += 5) { R(c, x + 2 + i, y + 2, 2, 4, COL.bone); R(c, x + 2 + i, y + 2, 2, 1, COL.red); }
    } else if (k === 'chair') {
      R(c, x + 1, y + 2, 6, 5, COL.grey2); R(c, x + 1, y + 1, 6, 2, COL.grey);
    } else if (k === 'locker') {
      R(c, x, y, 8, 16, COL.grey2); R(c, x + 1, y + 1, 6, 14, COL.grey);
      R(c, x + 4, y + 1, 1, 14, COL.grey2); R(c, x + 3, y + 7, 1, 2, COL.dust); R(c, x + 5, y + 7, 1, 2, COL.dust);
    } else if (k === 'shelf') {
      R(c, x, y, w, 8, COL.grey); R(c, x, y, w, 1, COL.grey2);
      for (let i = 0; i < w - 3; i += 6) {
        const v = hash(p.x + i);
        R(c, x + 2 + i, y + 2, 4, 5, v > 0.5 ? COL.dust : COL.grey2);
        if (v > 0.82) R(c, x + 3 + i, y + 3, 2, 2, COL.redDeep);
      }
    } else if (k === 'box') {
      R(c, x + 1, y + 2, 6, 5, COL.grey2); R(c, x + 1, y + 2, 6, 1, COL.dust); R(c, x + 3, y + 4, 2, 1, COL.redDeep);
    } else if (k === 'fridge') {
      R(c, x, y, 16, 16, COL.grey2); R(c, x + 1, y + 1, 14, 14, COL.dust);
      R(c, x + 1, y + 1, 14, 4, COL.dim); R(c, x + 7, y + 6, 2, 6, COL.red);
      R(c, x + 5, y + 8, 6, 2, COL.red); R(c, x + 13, y + 7, 1, 3, COL.grey);
    } else if (k === 'vending') {
      R(c, x, y, 8, 16, COL.grey2); R(c, x + 1, y + 1, 6, 10, COL.dark);
      for (let i = 0; i < 3; i++) R(c, x + 2, y + 2 + i * 3, 4, 2, i === 1 ? COL.redDeep : COL.grey);
      R(c, x + 1, y + 13, 6, 2, COL.grey);
    } else if (k === 'sign') {
      R(c, x, y + 1, w, 6, COL.dark); R(c, x, y + 1, w, 1, COL.grey2); R(c, x, y + 6, w, 1, COL.grey2);
      R(c, x + 2, y + 3, w - 4, 1, COL.dim);
    } else if (k === 'tray') {
      R(c, x, y + 2, 8, 5, COL.grey2); R(c, x + 1, y + 3, 6, 3, COL.dust);
    } else if (k === 'body') {
      /* a shape under a sheet, and what soaked through it */
      const s = hash(p.x * 2.1 + p.y);
      R(c, x - 2, y + 3, 20, 8, BLOOD2);
      R(c, x, y + 5, 16, 5, BLOOD);
      if (s > 0.5) R(c, x + 14, y + 2, 6, 3, BLOOD2); else R(c, x - 4, y + 8, 7, 3, BLOOD2);
      R(c, x + 1, y + 2, 14, 6, COL.dust);
      R(c, x + 2, y + 1, 5, 5, COL.dim);
      R(c, x + 3, y + 3, 1, 1, COL.void); R(c, x + 5, y + 3, 1, 1, COL.void);
      R(c, x + 8, y + 3, 7, 1, COL.grey2);
      R(c, x + 6, y + 6, 8, 2, BLOOD);
    }
  }

  /* ================================================================
     The four floors
     ================================================================ */

  const LEVELS = [
    {
      n: 1, name: 'LOBBY', tag: 'GROUND FLOOR', mw: 52, mh: 30, spawn: [26, 24],
      rooms: [[2, 3, 48, 24, 'MAIN ENTRANCE HALL', 0.30]],
      doors: [],
      props: [
        { k: 'desk', x: 10, y: 8, w: 12 }, { k: 'chair', x: 12, y: 10 }, { k: 'chair', x: 18, y: 10 },
        { k: 'sign', x: 30, y: 5, w: 14 },
        { k: 'chair', x: 6, y: 18 }, { k: 'chair', x: 9, y: 18 }, { k: 'chair', x: 12, y: 18 }, { k: 'chair', x: 15, y: 18 },
        { k: 'chair', x: 6, y: 21 }, { k: 'chair', x: 9, y: 21 }, { k: 'chair', x: 12, y: 21 }, { k: 'chair', x: 15, y: 21 },
        { k: 'vending', x: 47, y: 20 }, { k: 'box', x: 45, y: 24 }, { k: 'box', x: 43, y: 25 },
        { k: 'gurney', x: 33, y: 21 }, { k: 'gurney', x: 24, y: 12 },
        { k: 'body', x: 22, y: 16 }, { k: 'body', x: 36, y: 10 }, { k: 'body', x: 14, y: 24 },
        { k: 'body', x: 44, y: 15 }, { k: 'body', x: 29, y: 24 }
      ],
      acts: [
        { id: 'gen', k: 'panel', x: 1, y: 12, hold: 2.2, task: 0, label: 'BREAKER PANEL',
          prompt: 'RESTART THE GENERATOR', doneMsg: 'POWER IS BACK. ONE LIFT ANSWERS.' },
        { id: 'card', k: 'search', x: 14, y: 7, task: 1, gives: 'card', label: 'RECEPTION DRAWERS',
          prompt: 'SEARCH THE DRAWERS', doneMsg: 'LIFT KEYCARD 03.' },
        { id: 'lift1', k: 'lift', x: 30, y: 2, broken: true, label: 'LIFT 01' },
        { id: 'lift2', k: 'lift', x: 34, y: 2, broken: true, label: 'LIFT 02' },
        { id: 'lift3', k: 'lift', x: 38, y: 2, broken: false, task: 2, need: 'card', hold: 1.6,
          label: 'LIFT 03', prompt: 'CALL LIFT 03', doneMsg: 'GOING UP.' },
        { id: 'lift4', k: 'lift', x: 42, y: 2, broken: true, label: 'LIFT 04' },
        { id: 'door', k: 'sealed', x: 25, y: 27, label: 'MAIN DOORS' },
        { id: 'rec1', k: 'terminal', x: 50, y: 8, rec: 0, label: 'ARCHIVE TERMINAL' }
      ],
      tasks: ['RESTART THE GENERATOR', 'FIND THE LIFT KEYCARD', 'CALL LIFT 03']
    },
    {
      n: 2, name: 'WARD', tag: 'SECOND FLOOR', mw: 56, mh: 32, spawn: [51, 15],
      rooms: [
        [2, 14, 52, 4, 'CORRIDOR', 0.32],
        [3, 3, 11, 10, 'LINEN', 0.24], [17, 3, 11, 10, 'STAFF ROOM', 0.26],
        [31, 3, 11, 10, 'OFFICE', 0.24], [45, 3, 8, 10, 'SUPPLY', 0.22],
        [3, 19, 13, 10, 'WARD A', 0.22], [19, 19, 13, 10, 'WARD B', 0.22],
        [35, 19, 10, 10, 'STAIRWELL', 0.30]
      ],
      doors: [[8, 13], [9, 13], [22, 13], [23, 13], [36, 13], [37, 13], [48, 13], [49, 13],
              [9, 18], [10, 18], [25, 18], [26, 18], [39, 18], [40, 18]],
      props: [
        { k: 'shelf', x: 4, y: 3, w: 4 }, { k: 'shelf', x: 10, y: 6, w: 3 }, { k: 'box', x: 4, y: 10 },
        { k: 'desk', x: 19, y: 6, w: 4 }, { k: 'chair', x: 20, y: 8 }, { k: 'vending', x: 26, y: 9 },
        { k: 'desk', x: 33, y: 8, w: 5 }, { k: 'chair', x: 35, y: 10 }, { k: 'box', x: 40, y: 4 },
        { k: 'shelf', x: 46, y: 5, w: 6 }, { k: 'box', x: 46, y: 9 },
        { k: 'bed', x: 4, y: 20 }, { k: 'bed', x: 8, y: 20 }, { k: 'bed', x: 12, y: 20 },
        { k: 'mon', x: 6, y: 20 }, { k: 'mon', x: 10, y: 20 },
        { k: 'bed', x: 20, y: 20 }, { k: 'bed', x: 24, y: 20 }, { k: 'bed', x: 29, y: 20 },
        { k: 'iv', x: 23, y: 20 }, { k: 'body', x: 21, y: 25 }, { k: 'body', x: 12, y: 26 },
        { k: 'gurney', x: 15, y: 15 }, { k: 'box', x: 33, y: 15 }
      ],
      acts: [
        { id: 'note', k: 'note', x: 30, y: 13, task: 0, label: 'NOTE ON THE WALL', prompt: 'READ THE NOTE',
          doneMsg: '"CLEAN GOWNS - LINEN. THE STAIR KEY LIVES WITH THEM."' },
        { id: 's1', k: 'search', x: 10, y: 3, task: 1, gives: 'key', label: 'LINEN LOCKER',
          prompt: 'SEARCH THE LOCKER', doneMsg: 'STAIRWELL KEY.' },
        { id: 's2', k: 'search', x: 25, y: 3, label: 'STAFF LOCKER', prompt: 'SEARCH THE LOCKER', empty: 'A COAT. A PHOTO. NOTHING ELSE.' },
        { id: 's3', k: 'search', x: 39, y: 3, label: 'OFFICE CABINET', prompt: 'SEARCH THE CABINET', empty: 'DISCHARGE FORMS FOR PEOPLE WHO NEVER LEFT.' },
        { id: 's4', k: 'search', x: 50, y: 3, label: 'SUPPLY CABINET', prompt: 'SEARCH THE CABINET', empty: 'EMPTY BOXES. SOMEONE GOT HERE FIRST.' },
        { id: 's5', k: 'search', x: 5, y: 19, label: 'WARD A LOCKER', prompt: 'SEARCH THE LOCKER', empty: 'A BAG OF CLOTHES WITH A NAME ON IT.' },
        { id: 's6', k: 'search', x: 30, y: 19, label: 'WARD B LOCKER', prompt: 'SEARCH THE LOCKER', empty: 'GLOVES. ALL OF THEM LEFT HANDS.' },
        { id: 'stair', k: 'stairs', x: 39, y: 19, task: 2, need: 'key', hold: 1.8, label: 'STAIRWELL DOOR',
          prompt: 'UNLOCK THE STAIRWELL', doneMsg: 'THE DOOR GIVES.' },
        { id: 'lift', k: 'lift', x: 54, y: 15, broken: true, label: 'LIFT 03', arrived: true },
        { id: 'rec2', k: 'terminal', x: 2, y: 15, rec: 1, label: 'ARCHIVE TERMINAL' }
      ],
      tasks: ['READ THE NOTE ON THE WALL', 'FIND THE STAIRWELL KEY', 'UNLOCK THE STAIRWELL']
    },
    {
      n: 3, name: 'ICU', tag: 'THIRD FLOOR', mw: 54, mh: 32, spawn: [4, 20],
      rooms: [
        [2, 3, 50, 14, 'INTENSIVE CARE', 0.20],
        [2, 19, 50, 4, 'CORRIDOR', 0.24],
        [4, 25, 14, 5, 'THEATRE', 0.22], [36, 25, 14, 5, 'STORE', 0.20]
      ],
      doors: [[26, 17], [27, 17], [26, 18], [27, 18], [10, 23], [11, 23], [10, 24], [11, 24],
              [42, 23], [43, 23], [42, 24], [43, 24]],
      props: [
        { k: 'bed', x: 5, y: 4 }, { k: 'bed', x: 10, y: 4 }, { k: 'bed', x: 15, y: 4 }, { k: 'bed', x: 20, y: 4 },
        { k: 'bed', x: 30, y: 4 }, { k: 'bed', x: 35, y: 4 }, { k: 'bed', x: 40, y: 4 }, { k: 'bed', x: 45, y: 4 },
        { k: 'mon', x: 7, y: 4 }, { k: 'mon', x: 12, y: 4 }, { k: 'mon', x: 17, y: 4 }, { k: 'mon', x: 22, y: 4 },
        { k: 'mon', x: 32, y: 4 }, { k: 'mon', x: 37, y: 4 }, { k: 'mon', x: 42, y: 4 }, { k: 'mon', x: 47, y: 4 },
        { k: 'iv', x: 9, y: 4 }, { k: 'iv', x: 29, y: 4 }, { k: 'iv', x: 44, y: 4 },
        { k: 'bed', x: 8, y: 12 }, { k: 'bed', x: 13, y: 12 }, { k: 'bed', x: 38, y: 12 }, { k: 'bed', x: 43, y: 12 },
        { k: 'body', x: 24, y: 9 }, { k: 'body', x: 33, y: 14 }, { k: 'body', x: 6, y: 15 }, { k: 'body', x: 47, y: 10 },
        { k: 'body', x: 20, y: 20 }, { k: 'gurney', x: 30, y: 19 }, { k: 'box', x: 48, y: 20 },
        { k: 'table', x: 6, y: 27, w: 4 }, { k: 'tray', x: 12, y: 26 },
        { k: 'shelf', x: 38, y: 25, w: 8 }, { k: 'box', x: 46, y: 28 }, { k: 'fridge', x: 47, y: 25 }
      ],
      acts: [
        { id: 'knife', k: 'pickup', x: 13, y: 26, task: 0, gives: 'knife', label: 'SURGICAL TRAY',
          prompt: 'TAKE THE BLADE', doneMsg: 'A BLADE. IT WILL HAVE TO DO.' },
        { id: 'fire', k: 'stairs', x: 52, y: 8, task: 2, need: 'clear', hold: 2.4, label: 'FIRE DOOR',
          prompt: 'FORCE THE FIRE DOOR', doneMsg: 'IT OPENS ONTO THE STAIRS.' },
        { id: 'rec3', k: 'terminal', x: 44, y: 24, rec: 2, label: 'ARCHIVE TERMINAL' }
      ],
      tasks: ['FIND SOMETHING SHARP', 'PUT DOWN WHAT FOLLOWS YOU', 'FORCE THE FIRE DOOR'],
      zombie: [46, 12]
    },
    {
      n: 4, name: 'STORES', tag: 'FOURTH FLOOR', mw: 54, mh: 30, spawn: [4, 14],
      rooms: [
        [2, 13, 50, 4, 'CORRIDOR', 0.30],
        [3, 3, 14, 9, 'PHARMACY', 0.26], [21, 3, 14, 9, 'LAB', 0.24], [39, 3, 12, 9, 'STORE 01', 0.22],
        [3, 18, 14, 8, 'STORE 02', 0.22], [21, 18, 14, 8, 'COLD ROOM', 0.24], [39, 18, 12, 8, 'OFFICE', 0.22]
      ],
      doors: [[9, 12], [10, 12], [27, 12], [28, 12], [44, 12], [45, 12],
              [9, 17], [10, 17], [27, 17], [28, 17], [44, 17], [45, 17]],
      props: [
        { k: 'shelf', x: 4, y: 8, w: 6 }, { k: 'table', x: 12, y: 8, w: 4 },
        { k: 'table', x: 23, y: 8, w: 5 }, { k: 'box', x: 31, y: 9 }, { k: 'shelf', x: 30, y: 5, w: 4 },
        { k: 'box', x: 40, y: 8 }, { k: 'box', x: 42, y: 9 }, { k: 'shelf', x: 45, y: 8, w: 5 },
        { k: 'box', x: 5, y: 24 }, { k: 'shelf', x: 8, y: 22, w: 6 },
        { k: 'fridge', x: 23, y: 22 }, { k: 'fridge', x: 26, y: 22 }, { k: 'fridge', x: 29, y: 22 },
        { k: 'desk', x: 41, y: 22, w: 5 }, { k: 'chair', x: 43, y: 24 },
        { k: 'body', x: 33, y: 14 }, { k: 'gurney', x: 16, y: 14 }
      ],
      acts: [
        { id: 'c1', k: 'cabinet', x: 5, y: 3, label: 'PHARMACY CABINET' },
        { id: 'c2', k: 'cabinet', x: 8, y: 3, label: 'PHARMACY CABINET' },
        { id: 'c3', k: 'cabinet', x: 14, y: 3, label: 'PHARMACY CABINET' },
        { id: 'c4', k: 'cabinet', x: 23, y: 3, label: 'LAB CABINET' },
        { id: 'c5', k: 'cabinet', x: 26, y: 3, label: 'LAB CABINET' },
        { id: 'c6', k: 'cabinet', x: 41, y: 3, label: 'STORE 01 CABINET' },
        { id: 'c7', k: 'cabinet', x: 48, y: 3, label: 'STORE 01 CABINET' },
        { id: 'c8', k: 'cabinet', x: 5, y: 18, label: 'STORE 02 CABINET' },
        { id: 'c9', k: 'cabinet', x: 12, y: 18, label: 'STORE 02 CABINET' },
        { id: 'c10', k: 'cabinet', x: 24, y: 18, label: 'COLD ROOM CABINET' },
        { id: 'c11', k: 'cabinet', x: 32, y: 18, label: 'COLD ROOM CABINET' },
        { id: 'c12', k: 'cabinet', x: 47, y: 18, label: 'OFFICE CABINET' },
        { id: 'log', k: 'note', x: 18, y: 17, label: 'DELIVERY LOG', prompt: 'READ THE DELIVERY LOG' },
        { id: 'rec4', k: 'terminal', x: 2, y: 14, rec: 3, label: 'ARCHIVE TERMINAL' }
      ],
      tasks: ['SEARCH THE CABINETS', 'OPEN THE FIRST AID KIT']
    }
  ];

  /* ================================================================
     Level runtime
     ================================================================ */

  const VOID = 0, FLOOR = 1, WALL = 2, DOOR = 3;
  let L = null;

  function buildLevel(def) {
    const mw = def.mw, mh = def.mh;
    const grid = new Uint8Array(mw * mh);
    const roomAt = new Int8Array(mw * mh).fill(-1);
    const solid = new Uint8Array(mw * mh);

    def.rooms.forEach((r, i) => {
      const [rx, ry, rw, rh] = r;
      for (let y = ry - 1; y <= ry + rh; y++) {
        for (let x = rx - 1; x <= rx + rw; x++) {
          if (x < 0 || y < 0 || x >= mw || y >= mh) continue;
          const k = y * mw + x;
          const inside = x >= rx && x < rx + rw && y >= ry && y < ry + rh;
          if (inside) { grid[k] = FLOOR; roomAt[k] = i; }
          else if (grid[k] !== FLOOR) grid[k] = WALL;
        }
      }
    });
    def.doors.forEach(([x, y]) => { grid[y * mw + x] = DOOR; });
    for (let k = 0; k < grid.length; k++) if (grid[k] === WALL || grid[k] === VOID) solid[k] = 1;

    const props = def.props.map((p) => ({ ...p }));
    props.forEach((p) => {
      const [w, h] = SIZE[p.k] || [1, 1];
      const pw = p.w || w;
      for (let y = p.y; y < p.y + h; y++) for (let x = p.x; x < p.x + pw; x++) {
        if (x >= 0 && y >= 0 && x < mw && y < mh) solid[y * mw + x] = 1;
      }
    });

    const acts = def.acts.map((a) => ({ ...a, done: false, hold: a.hold || 0 }));
    acts.forEach((a) => { if (grid[a.y * mw + a.x] !== WALL) solid[a.y * mw + a.x] = 1; });

    return { def, mw, mh, grid, roomAt, solid, acts, props, ww: mw * T, wh: mh * T };
  }

  const at = (x, y) => (x < 0 || y < 0 || x >= L.mw || y >= L.mh ? VOID : L.grid[y * L.mw + x]);
  const roomOf = (px, py) => {
    const x = (px / T) | 0, y = (py / T) | 0;
    if (x < 0 || y < 0 || x >= L.mw || y >= L.mh) return null;
    const i = L.roomAt[y * L.mw + x];
    return i >= 0 ? L.def.rooms[i] : null;
  };

  /* ================================================================
     Drawing the floor
     ================================================================ */

  function drawWorld(c, camX, camY) {
    R(c, 0, 0, W, H, COL.void);
    const x0 = Math.max(0, (camX / T | 0) - 1), x1 = Math.min(L.mw - 1, ((camX + W) / T | 0) + 1);
    const y0 = Math.max(0, (camY / T | 0) - 1), y1 = Math.min(L.mh - 1, ((camY + H) / T | 0) + 1);

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const g = L.grid[y * L.mw + x];
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

    for (const r of L.def.rooms) {
      const cx = (r[0] + r[2] / 2) * T - camX, cy = (r[1] + r[3] / 2) * T - camY;
      if (cx < -140 || cx > W + 140 || cy < -40 || cy > H + 40) continue;
      textC(c, r[4], cx, cy - 3, COL.grey2, 1, 1, 0.45);
    }
  }

  /* ---------- the things you can use ---------- */

  function drawAct(c, a, sx, sy, t, near) {
    const x = a.x * T - sx, y = a.y * T - sy;
    if (x < -24 || x > W + 24 || y < -24 || y > H + 24) return;
    const live = !a.done;
    const blink = Math.floor(t / 380) % 2 === 0;

    if (a.k === 'lift') {
      R(c, x, y, 8, 8, '#1c1c1c');
      R(c, x, y, 1, 8, COL.grey2); R(c, x + 7, y, 1, 8, COL.grey2);
      R(c, x + 3, y + 1, 2, 6, '#0d0d0d');
      R(c, x + 1, y - 3, 6, 3, '#1c1c1c');
      if (a.broken) { R(c, x + 2, y - 2, 4, 1, COL.redDeep); R(c, x + 3, y + 3, 2, 2, COL.redDeep); }
      else R(c, x + 2, y - 2, 4, 1, powered ? (blink ? COL.red : COL.redDeep) : COL.grey2);
    } else if (a.k === 'panel') {
      R(c, x + 1, y + 1, 6, 6, COL.grey2); R(c, x + 2, y + 2, 4, 4, '#151515');
      R(c, x + 3, y + 3, 1, 2, powered ? COL.bone : (blink ? COL.red : COL.redDeep));
      R(c, x + 4, y + 3, 1, 2, COL.grey);
    } else if (a.k === 'search' || a.k === 'cabinet') {
      R(c, x, y, 8, 8, COL.grey2); R(c, x + 1, y + 1, 6, 6, a.done ? '#141414' : COL.grey);
      if (a.done) { R(c, x + 1, y + 1, 6, 1, COL.grey2); R(c, x + 2, y + 3, 4, 3, '#0a0a0a'); }
      else { R(c, x + 4, y + 3, 1, 2, COL.dust); R(c, x + 2, y + 3, 1, 2, COL.dust); }
    } else if (a.k === 'note') {
      R(c, x + 1, y + 1, 6, 7, COL.bone);
      R(c, x + 2, y + 3, 4, 1, COL.grey); R(c, x + 2, y + 5, 3, 1, COL.grey);
      if (live && blink) R(c, x, y, 8, 1, COL.red);
    } else if (a.k === 'stairs') {
      R(c, x, y, 8, 8, '#1c1c1c');
      for (let i = 0; i < 4; i++) R(c, x + i, y + 1 + i * 2, 8 - i, 1, i % 2 ? COL.grey2 : COL.dim);
      if (live) R(c, x + 3, y + 6, 2, 2, blink ? COL.red : COL.redDeep);
    } else if (a.k === 'pickup') {
      R(c, x, y + 3, 8, 4, COL.grey2);
      if (live) { R(c, x + 1, y + 2, 6, 1, COL.bone); R(c, x + 5, y + 1, 2, 1, COL.dust); if (blink) R(c, x + 2, y, 1, 1, COL.red); }
    } else if (a.k === 'terminal') {
      R(c, x, y + 1, 8, 6, '#141414');
      R(c, x, y + 1, 8, 1, COL.grey2); R(c, x + 1, y + 2, 6, 4, a.done ? COL.grey : (blink ? COL.dust : COL.grey));
      if (!a.done) R(c, x + 2, y + 3, 4, 1, COL.red);
    } else if (a.k === 'sealed') {
      R(c, x, y, 16, 8, '#1c1c1c');
      R(c, x + 7, y, 2, 8, COL.grey2);
      R(c, x + 1, y + 3, 14, 2, COL.grey2);
      R(c, x + 5, y + 2, 6, 1, COL.redDeep);
    }

    if (near) {
      const q = (ox, oy, ex, ey) => { R(c, x - 3 + ox, y - 3 + oy, 3 * ex, 1, COL.bone); R(c, x - 3 + ox, y - 3 + oy, 1, 3 * ey, COL.bone); };
      q(0, 0, 1, 1); q(13, 0, -1, 1); q(0, 13, 1, -1); q(13, 13, -1, -1);
    }
  }

  /* ---------- where to go next ---------- */

  function targetAct() {
    const i = taskDone.findIndex((d) => !d);
    if (i < 0) return null;
    let best = L.acts.find((a) => a.task === i && !a.done);
    if (best) return best;
    if (L.def.n === 4 && i === 0) {                 /* twelve cabinets: point at the nearest shut one */
      let bd = 1e9;
      for (const a of L.acts) {
        if (a.k !== 'cabinet' || a.done) continue;
        const d = Math.abs(a.x * T - player.x) + Math.abs(a.y * T - player.y);
        if (d < bd) { bd = d; best = a; }
      }
    }
    return best || null;
  }

  function chevron(c, x, y, dir, col) {
    for (let i = 0; i < 4; i++) {
      if (dir === 'down') R(c, x - 3 + i, y + i, 7 - i * 2, 1, col);
      else if (dir === 'up') R(c, x - 3 + i, y + 3 - i, 7 - i * 2, 1, col);
      else if (dir === 'left') R(c, x + 3 - i, y - 3 + i, 1, 7 - i * 2, col);
      else R(c, x + i, y - 3 + i, 1, 7 - i * 2, col);
    }
  }

  function guide(c, camX, camY, t) {
    const a = targetAct();
    if (!a) return;
    const ax = a.x * T + 4 - camX, ay = a.y * T + 4 - camY;
    const on = Math.floor(t / 420) % 2 === 0;
    if (ax > 10 && ax < W - 10 && ay > 26 && ay < H - 34) {
      chevron(c, ax, ay - 14 - (on ? 1 : 0), 'down', COL.red);
      return;
    }
    const px = clamp(ax, 20, W - 20), py = clamp(ay, 30, H - 40);
    const dx = ax - px, dy = ay - py;
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
    chevron(c, px, py, dir, on ? COL.red : COL.redDeep);
    const lab = a.label;
    text(c, lab, clamp(px - textW(lab) / 2, 4, W - 4 - textW(lab)), py + 8, COL.grey2, 1, 1, 0.75);
  }

  function floorCard(c, k) {
    const d = LEVELS[floorN];
    const a = Math.min(1, (2.6 - k) / 0.35) * Math.min(1, k / 0.5);
    R(c, 0, 88, W, 42, `rgba(0,0,0,${0.82 * a})`);
    R(c, 0, 88, W, 1, COL.redDeep); R(c, 0, 129, W, 1, COL.redDeep);
    textC(c, 'FLOOR 0' + d.n, W / 2, 96, COL.red, 2, 1, a);
    textC(c, d.name + '  ·  ' + d.tasks.length + ' TASKS', W / 2, 116, COL.bone, 1, 1, a * 0.9);
  }

  /* ---------- lighting ---------- */

  function lighting(c, camX, camY, px, py, k, here) {
    const B = 6;
    for (let by = 0; by < H; by += B) {
      for (let bx = 0; bx < W; bx += B) {
        const wx = camX + bx + 3, wy = camY + by + 3;
        const r = roomOf(wx, wy);
        let l = (r ? r[5] + (r === here ? 0.18 : 0) : 0) * k;
        const dx = wx - px, dy = wy - py;
        const d2 = dx * dx + dy * dy;
        if (d2 < 4900) l += c01(1 - Math.sqrt(d2) / 70) * 0.85 * k;
        const dark = clamp(1 - l, 0, 0.95);
        if (dark < 0.07) continue;
        c.fillStyle = `rgba(0,0,0,${Math.round(dark * 6) / 6})`;
        c.fillRect(bx, by, B, B);
      }
    }
  }

  /* ---------- camera interface ---------- */

  function minimap(c, px, py, t) {
    const mw = L.mw, mh = L.mh;
    const mx = W - mw - 6, my = H - mh - 6;
    R(c, mx - 2, my - 2, mw + 4, mh + 4, 'rgba(0,0,0,0.78)');
    R(c, mx - 2, my - 2, mw + 4, 1, COL.grey2); R(c, mx - 2, my + mh + 1, mw + 4, 1, COL.grey2);
    R(c, mx - 2, my - 2, 1, mh + 4, COL.grey2); R(c, mx + mw + 1, my - 2, 1, mh + 4, COL.grey2);
    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) {
        const g = L.grid[y * mw + x];
        if (g === VOID) continue;
        c.fillStyle = g === WALL ? '#1c1c1c' : g === DOOR ? '#4a4a4a' : '#2e2e2e';
        c.fillRect(mx + x, my + y, 1, 1);
      }
    }
    for (const a of L.acts) {
      if (a.k === 'sealed' || (a.k === 'lift' && a.broken)) continue;
      if (a.done && a.k !== 'stairs' && a.k !== 'lift') continue;
      c.fillStyle = a.task !== undefined || a.k === 'cabinet' ? COL.red : COL.grey2;
      c.fillRect(mx + a.x, my + a.y, 1, 1);
    }
    if (zomb.alive) { c.fillStyle = Math.floor(t / 200) % 2 ? COL.red : COL.redDeep; c.fillRect(mx + (zomb.x / T | 0), my + (zomb.y / T | 0), 1, 1); }
    if (Math.floor(t / 260) % 2 === 0) { c.fillStyle = COL.white; c.fillRect(mx + (px / T | 0), my + (py / T | 0), 1, 1); }
  }

  function clock(ms) {
    const s = Math.floor(ms / 1000);
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  function hud(c, t, here, near) {
    const corner = (x, y, sx, sy) => { R(c, x, y, 5 * sx, 1, COL.grey2); R(c, x, y, 1, 5 * sy, COL.grey2); };
    corner(3, 3, 1, 1); corner(W - 4, 3, -1, 1); corner(3, H - 4, 1, -1); corner(W - 4, H - 4, -1, -1);

    R(c, 8, 9, 3, 3, Math.floor(t / 620) % 2 === 0 ? COL.red : COL.redDeep);
    text(c, 'CAM 0' + L.def.n + ' / ' + (here ? here[4] : 'NO SIGNAL'), 14, 8, COL.dim, 1, 1, 0.9);
    const right = 'FLOOR ' + L.def.n + '/4  ' + clock(runMs);
    text(c, right, W - 8 - textW(right), 8, COL.grey2, 1, 1, 0.85);

    /* the task list, ticked off as you go */
    const tasks = L.def.tasks;
    text(c, 'TASKS', 8, 22, COL.grey2, 1, 1, 0.7);
    for (let i = 0; i < tasks.length; i++) {
      const y = 32 + i * 10, ok = taskDone[i];
      R(c, 8, y, 5, 5, COL.void);
      R(c, 8, y, 5, 1, ok ? COL.bone : COL.grey2); R(c, 8, y + 4, 5, 1, ok ? COL.bone : COL.grey2);
      R(c, 8, y, 1, 5, ok ? COL.bone : COL.grey2); R(c, 12, y, 1, 5, ok ? COL.bone : COL.grey2);
      if (ok) { R(c, 9, y + 2, 1, 2, COL.red); R(c, 10, y + 3, 1, 1, COL.red); R(c, 11, y + 1, 1, 2, COL.red); }
      let label = tasks[i];
      if (L.def.n === 4 && i === 0) label += '  ' + opened + '/12';
      text(c, label, 17, y - 1, ok ? COL.grey2 : COL.bone, 1, 1, ok ? 0.55 : 0.9);
    }

    /* what you are carrying, how the infection is doing, and who owns you */
    let ix = 8;
    const chip = (s, on, col) => { text(c, s, ix, H - 24, on ? (col || COL.bone) : COL.grey2, 1, 1, on ? 0.9 : 0.35); ix += textW(s) + 8; };
    chip('CARD', inv.card); chip('KEY', inv.key); chip('BLADE', inv.knife);
    if (window.SHELL.soul) chip('SOUL SOLD', true, COL.red);
    const inf = 'INFECTION ' + Math.min(99, Math.floor(18 + runMs / 26000)) + '%';
    text(c, inf, W - 8 - textW(inf), 18, COL.red, 1, 1, 0.8);

    /* the controls stay on screen; there is nothing to memorise */
    text(c, 'WASD OR ARROW KEYS: WALK', 8, H - 13, COL.grey2, 1, 1, 0.6);
    text(c, 'E: USE / HOLD / SWING', 166, H - 13, COL.grey2, 1, 1, 0.6);

    if (zomb.alive && zomb.hp < 3) {
      for (let i = 0; i < 3; i++) R(c, W / 2 - 10 + i * 8, 20, 6, 3, i < zomb.hp ? COL.red : COL.grey);
    }

    if (near) {
      const a = near.a;
      const label = a.done && a.k === 'cabinet' ? 'ALREADY OPEN'
        : a.k === 'sealed' ? 'SEALED FROM THE OUTSIDE'
        : a.k === 'lift' && a.broken ? 'OUT OF ORDER'
        : a.k === 'terminal' ? (a.done ? 'RECORD RECOVERED' : '[E] PLAY THE RECORD')
        : '[E] ' + (a.prompt || 'USE');
      textC(c, label, W / 2, H - 30, a.done || (a.k === 'lift' && a.broken) || a.k === 'sealed' ? COL.grey2 : COL.bone, 1, 1, 0.95);
    }
    if (msg && msgT > 0) textC(c, msg, W / 2, H - 44, COL.red, 1, 1, Math.min(1, msgT));
  }

  /* ================================================================
     PANDEMIK — the run
     ================================================================ */

  const $ = (s) => document.querySelector(s);
  const cv = $('#game');
  const cx = cv.getContext('2d', { alpha: false });
  cx.imageSmoothingEnabled = false;

  const taskEl = $('#task'), taskTitle = $('#taskTitle'), taskFill = $('#taskFill'), taskHint = $('#taskHint');
  const briefEl = $('#brief'), claimEl = $('#claim');

  const player = { x: 0, y: 0, dir: 'down', step: 0, dist: 0, moving: false };
  const cam = { x: 0, y: 0 };
  const zomb = { alive: false, awake: false, x: 0, y: 0, dir: 'down', step: 0, dist: 0, hp: 3, stun: 0 };

  let state = 'brief';           /* brief | play | fx | rec | dead | win | claim */
  let floorN = 0, started = false;
  let inv = { card: false, key: false, knife: false };
  let taskDone = [], powered = false, opened = 0, kitIn = '';
  let records = [false, false, false, false, false];
  let runMs = 0, deaths = 0;
  let msg = '', msgT = 0;
  let holdAct = null, holdP = 0;
  let recIdx = -1, recP = 0;
  let fxLeft = 0, fxNext = 'play', winT = 0, deadT = 0, cardT = 0;

  const keys = { up: 0, down: 0, left: 0, right: 0, use: 0 };
  let useEdge = false, escEdge = false;

  const say = (s, secs) => { msg = s; msgT = secs || 2.6; };

  const EMPTY_LINES = [
    'EMPTY.', 'GAUZE. NOTHING ELSE.', 'SALINE, ALL OF IT EXPIRED.',
    'PAPERWORK. SOMEONE SIGNED IT TWICE.', 'A LUNCHBOX, STILL SHUT.',
    'MASKS. THE WRONG SIZE.', 'NOTHING. THE SHELF IS DUSTED CLEAN.',
    'SOMEONE ALREADY LOOKED HERE.', 'BROKEN GLASS.', 'A RADIO WITH NO BATTERIES.',
    'SPARE SHEETS.'
  ];

  function loadFloor(i) {
    floorN = i;
    L = buildLevel(LEVELS[i]);
    taskDone = LEVELS[i].tasks.map(() => false);
    const [sx, sy] = LEVELS[i].spawn;
    player.x = sx * T + 4; player.y = sy * T + 7;
    cam.x = clamp(player.x - W / 2, 0, L.ww - W);
    cam.y = clamp(player.y - H / 2, 0, L.wh - H);
    holdAct = null; holdP = 0;
    zomb.alive = false;
    if (LEVELS[i].zombie) {
      zomb.alive = true; zomb.hp = 3; zomb.stun = 0; zomb.awake = false;
      zomb.x = LEVELS[i].zombie[0] * T + 4; zomb.y = LEVELS[i].zombie[1] * T + 7;
    }
    if (i === 3) { opened = 0; kitIn = 'c' + (1 + Math.floor(Math.random() * 12)); }
  }

  function startRun() {
    inv = { card: false, key: false, knife: false };
    records = [false, false, false, false, false];
    powered = false; runMs = 0; msg = ''; msgT = 0;
    loadFloor(0);
    cardT = 2.6;
    state = 'fx'; fxLeft = 0.4; fxNext = 'play';
  }

  /* ---------- moving ---------- */

  function free(nx, ny) {
    const l = (nx - 3) | 0, r = (nx + 3) | 0, tp = (ny - 5) | 0, bt = ny | 0;
    for (let y = (tp / T) | 0; y <= (bt / T) | 0; y++) {
      for (let x = (l / T) | 0; x <= (r / T) | 0; x++) {
        if (x < 0 || y < 0 || x >= L.mw || y >= L.mh) return false;
        if (L.solid[y * L.mw + x]) return false;
      }
    }
    return true;
  }

  function nearest() {
    let best = null;
    for (const a of L.acts) {
      const ax = a.x * T + (a.k === 'sealed' ? 8 : 4), ay = a.y * T + 4;
      const d = Math.abs(ax - player.x) + Math.abs(ay - (player.y - 4));
      if (d < 22 && (!best || d < best.d)) best = { a, d };
    }
    return best;
  }

  const priorDone = (n) => taskDone.slice(0, n).every(Boolean);

  /* ---------- using things ---------- */

  function openRecord(a) {
    recIdx = a.rec; recP = records[a.rec] ? 1 : 0;
    state = 'fx'; fxLeft = 0.3; fxNext = 'rec';
    taskEl.hidden = false;
    taskEl.classList.toggle('done', records[a.rec]);
    taskTitle.textContent = 'RECORD 0' + (a.rec + 1) + ' - ' + ['DEATHS / LOSSES', 'ISOLATION / HOSPITAL', 'MASKS', 'VACCINES', 'MEMORY'][a.rec];
    a.done = records[a.rec];
    for (const k in keys) keys[k] = 0;
  }

  function nextFloor() {
    if (floorN >= 3) return;
    loadFloor(floorN + 1);
    state = 'fx'; fxLeft = 0.5; fxNext = 'play';
    cardT = 2.6;
  }

  function complete(a) {
    if (a.task !== undefined) taskDone[a.task] = true;
    if (a.gives) inv[a.gives] = true;
    if (a.id === 'gen') powered = true;
    if (a.gives === 'knife') zomb.awake = true;
    if (a.doneMsg) say(a.doneMsg, 3);
    a.done = true;
    if (a.k === 'lift' || a.k === 'stairs') nextFloor();
  }

  function blocked(a) {
    if (a.k === 'lift' && a.broken) return 'OUT OF ORDER';
    if (a.k === 'sealed') return 'SEALED FROM THE OUTSIDE. THE ONLY WAY IS UP.';
    if (a.k === 'lift' && !powered) return 'NO POWER IN THE SHAFT.';
    if (a.need === 'card' && !inv.card) return 'IT WANTS A KEYCARD.';
    if (a.need === 'key' && !inv.key) return 'LOCKED. THERE IS A KEY SOMEWHERE.';
    if (a.need === 'clear' && zomb.alive) return 'NOT WHILE THAT THING IS UP.';
    if (a.task !== undefined && !priorDone(a.task)) return 'NOT YET.';
    return null;
  }

  function use(a) {
    const no = blocked(a);
    if (no) { say(no, 2.6); return; }
    if (a.k === 'terminal') { openRecord(a); return; }
    if (a.id === 'log') {
      const kit = L.acts.find((x) => x.id === kitIn);
      a.done = true;
      say('SIGNED IN LAST: ' + (kit ? kit.label.replace(' CABINET', '') : 'UNREADABLE'), 4);
      return;
    }
    if (a.k === 'search') {
      a.done = true;
      if (a.gives) complete(a); else say(a.empty || 'EMPTY.', 2.6);
      return;
    }
    if (a.k === 'cabinet') {
      if (a.done) { say('ALREADY OPEN.', 1.6); return; }
      a.done = true; opened++;
      if (a.id === kitIn) {
        taskDone[0] = true; taskDone[1] = true;
        state = 'win'; winT = 0;
      } else say(EMPTY_LINES[Math.floor(hash(opened * 7.3) * EMPTY_LINES.length)], 2.4);
      return;
    }
    if (a.hold) return;                 /* handled by the hold bar */
    complete(a);
  }

  /* ---------- the thing on floor three ---------- */

  /* it does not wander: a breadth-first sweep from wherever you are stood,
     so beds and doorways slow it down but never lose it */
  let flow = null, flowT = 0, flowQ = null;

  function buildFlow() {
    const n = L.mw * L.mh;
    if (!flow || flow.length !== n) { flow = new Int16Array(n); flowQ = new Int32Array(n); }
    flow.fill(-1);
    const sx = clamp((player.x / T) | 0, 0, L.mw - 1);
    const sy = clamp(((player.y - 3) / T) | 0, 0, L.mh - 1);
    let head = 0, tail = 0;
    const s = sy * L.mw + sx;
    flow[s] = 0; flowQ[tail++] = s;
    while (head < tail) {
      const k = flowQ[head++], d = flow[k];
      const x = k % L.mw, y = (k / L.mw) | 0;
      for (let i = 0; i < 4; i++) {
        const nx = x + (i === 0 ? 1 : i === 1 ? -1 : 0);
        const ny = y + (i === 2 ? 1 : i === 3 ? -1 : 0);
        if (nx < 0 || ny < 0 || nx >= L.mw || ny >= L.mh) continue;
        const nk = ny * L.mw + nx;
        if (flow[nk] !== -1 || L.solid[nk]) continue;
        flow[nk] = d + 1;
        flowQ[tail++] = nk;
      }
    }
  }

  function zombieStep(dt) {
    if (!zomb.alive) return;
    if (!zomb.awake) {
      /* it stands in the dark until you get close, or until you pick up the blade */
      if (Math.hypot(player.x - zomb.x, player.y - zomb.y) < 120) {
        zomb.awake = true;
        say('IT HAS SEEN YOU. KEEP MOVING.', 3);
      }
      return;
    }
    if (zomb.stun > 0) { zomb.stun -= dt; return; }

    flowT -= dt;
    if (flowT <= 0) { buildFlow(); flowT = 0.3; }

    const zx = clamp((zomb.x / T) | 0, 0, L.mw - 1);
    const zy = clamp(((zomb.y - 3) / T) | 0, 0, L.mh - 1);
    const here = flow[zy * L.mw + zx];
    let tx = player.x, ty = player.y - 3;

    if (here > 1) {
      let bd = here, best = null;
      for (let i = 0; i < 4; i++) {
        const nx = zx + (i === 0 ? 1 : i === 1 ? -1 : 0);
        const ny = zy + (i === 2 ? 1 : i === 3 ? -1 : 0);
        if (nx < 0 || ny < 0 || nx >= L.mw || ny >= L.mh) continue;
        const d = flow[ny * L.mw + nx];
        if (d >= 0 && d < bd) { bd = d; best = [nx, ny]; }
      }
      if (best) { tx = best[0] * T + 4; ty = best[1] * T + 4; }
    }

    const dx = tx - zomb.x, dy = ty - (zomb.y - 3);
    const d = Math.hypot(dx, dy) || 1;
    const sp = 30 * dt;
    const vx = (dx / d) * sp, vy = (dy / d) * sp;
    const ox = zomb.x, oy = zomb.y;
    zomb.x += vx; if (!freeAt(zomb.x, zomb.y)) zomb.x = ox;
    zomb.y += vy; if (!freeAt(zomb.x, zomb.y)) zomb.y = oy;
    zomb.dist += Math.abs(zomb.x - ox) + Math.abs(zomb.y - oy);
    zomb.step = Math.floor(zomb.dist / 5);
    const px = player.x - zomb.x, py = player.y - zomb.y;
    zomb.dir = Math.abs(px) > Math.abs(py) ? (px < 0 ? 'left' : 'right') : (py < 0 ? 'up' : 'down');
  }

  function freeAt(nx, ny) {
    const l = (nx - 3) | 0, r = (nx + 3) | 0, tp = (ny - 5) | 0, bt = ny | 0;
    for (let y = (tp / T) | 0; y <= (bt / T) | 0; y++) {
      for (let x = (l / T) | 0; x <= (r / T) | 0; x++) {
        if (x < 0 || y < 0 || x >= L.mw || y >= L.mh) return false;
        if (L.solid[y * L.mw + x]) return false;
      }
    }
    return true;
  }

  function stab() {
    const d = Math.hypot(player.x - zomb.x, player.y - zomb.y);
    if (d > 19) return false;
    if (!inv.knife) { say('NOT WITH BARE HANDS.', 2); return true; }
    zomb.hp--;
    zomb.stun = 1.15;
    const a = Math.atan2(zomb.y - player.y, zomb.x - player.x);
    const bx = zomb.x + Math.cos(a) * 12, by = zomb.y + Math.sin(a) * 12;
    if (freeAt(bx, by)) { zomb.x = bx; zomb.y = by; }
    if (zomb.hp <= 0) {
      zomb.alive = false;
      taskDone[1] = true;
      say('IT STOPS MOVING. IT DOES NOT GET UP.', 3.2);
    } else say('IT REELS BACK.', 1.4);
    return true;
  }

  /* ---------- controls ---------- */

  const KEY = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    KeyE: 'use', Space: 'use', Enter: 'use'
  };
  const active = () => document.body.dataset.mode === 'floor';

  window.addEventListener('keydown', (e) => {
    if (!active() || state === 'brief' || state === 'claim') return;
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

  /* ---------- one drawn frame of the hospital ---------- */

  function renderFloor(c, t, lightK, near) {
    const camX = Math.round(cam.x), camY = Math.round(cam.y);
    drawWorld(c, camX, camY);
    for (const a of L.acts) drawAct(c, a, camX, camY, t, near && near.a === a && lightK > 0.5);

    const order = [];
    for (const p of L.props) {
      const [, h] = SIZE[p.k] || [1, 1];
      const sx = p.x * T - camX, sy = p.y * T - camY;
      if (sx < -40 || sx > W + 40 || sy < -40 || sy > H + 40) continue;
      order.push({ p, b: (p.y + h) * T });
    }
    for (const o of order) if (o.b <= player.y) prop(c, o.p, camX, camY);
    if (zomb.alive && zomb.y <= player.y) walker(c, ZOMB, Math.round(zomb.x - camX), Math.round(zomb.y - camY), zomb.dir, zomb.step, zomb.stun <= 0, null);
    walker(c, BODY, Math.round(player.x - camX), Math.round(player.y - camY), player.dir, player.step, player.moving, null);
    if (zomb.alive && zomb.y > player.y) walker(c, ZOMB, Math.round(zomb.x - camX), Math.round(zomb.y - camY), zomb.dir, zomb.step, zomb.stun <= 0, null);
    for (const o of order) if (o.b > player.y) prop(c, o.p, camX, camY);

    const here = roomOf(player.x, player.y - 4);
    lighting(c, camX, camY, player.x, player.y - 4, lightK, here);

    if (lightK > 0.5) {
      guide(c, camX, camY, t);
      hud(c, t, here, near);
      minimap(c, player.x, player.y, t);
      if (cardT > 0) floorCard(c, cardT);
      if (holdAct && holdP > 0) {
        const bw = 84, bx = (W - bw) / 2;
        R(c, bx, H - 22, bw, 6, COL.void);
        R(c, bx, H - 22, bw, 1, COL.grey2); R(c, bx, H - 17, bw, 1, COL.grey2);
        R(c, bx, H - 22, 1, 6, COL.grey2); R(c, bx + bw - 1, H - 22, 1, 6, COL.grey2);
        R(c, bx + 1, H - 21, Math.round((bw - 2) * holdP), 4, COL.red);
      }
      /* the closer it gets, the redder the edges of the picture */
      if (zomb.alive) {
        const d = Math.hypot(player.x - zomb.x, player.y - zomb.y);
        const panic = c01(1 - d / 120);
        if (panic > 0.02) {
          c.fillStyle = `rgba(255,30,45,${panic * 0.22})`;
          c.fillRect(0, 0, W, 3); c.fillRect(0, H - 3, W, 3);
          c.fillRect(0, 0, 3, H); c.fillRect(W - 3, 0, 3, H);
        }
      }
    }
  }

  /* ---------- the vaccine, at the end ---------- */

  function vaccine(c, k) {
    const x = W / 2 - 16, y = 74, s = 4;
    const g = (px, py, w, h, col) => R(c, x + px * s, y + py * s, w * s, h * s, col);
    g(1, 3, 4, 1, COL.dim);
    g(5, 1, 3, 5, COL.grey); g(5, 2, 3, 3, COL.bone);
    g(8, 0, 2, 7, COL.grey2); g(10, 2, 1, 3, COL.dim);
    if (k > 0.4) { g(2, 2, 1, 1, COL.red); g(3, 4, 1, 1, COL.red); }
  }

  /* ================================================================
     One frame, handed over by the shell
     ================================================================ */

  function frame(dt, t) {
    if (state === 'brief') { staticFrame(cx, t / 1000); return; }
    if (msgT > 0) msgT -= dt;
    if (cardT > 0) cardT -= dt;
    if (state === 'play' || state === 'fx' || state === 'rec') runMs += dt * 1000;

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

      zombieStep(dt);

      const near = nearest();

      /* holding E on a task that takes a while */
      const cand = near && near.a.hold && !near.a.done && !blocked(near.a) ? near.a : null;
      if (cand && keys.use) {
        if (holdAct !== cand) { holdAct = cand; holdP = 0; }
        holdP += dt / cand.hold;
        if (holdP >= 1) { const a = holdAct; holdAct = null; holdP = 0; complete(a); }
      } else {
        holdP = Math.max(0, holdP - dt * 1.6);
        if (holdP === 0) holdAct = null;
        if (cand && keys.use === 0 && useEdge) { /* a tap tells you what it wants */ say('HOLD [E].', 1.4); }
      }

      if (useEdge) {
        if (zomb.alive && stab()) { /* the blade comes first */ }
        else if (near && !(near.a.hold && !blocked(near.a))) use(near.a);
        else if (near && near.a.hold && blocked(near.a)) say(blocked(near.a), 2.4);
      }

      if (zomb.alive && Math.hypot(player.x - zomb.x, player.y - zomb.y) < 8) {
        deaths++; state = 'dead'; deadT = 0;
      }

      const k = Math.min(1, dt * 7);
      cam.x = lerp(cam.x, clamp(player.x - W / 2, 0, L.ww - W), k);
      cam.y = lerp(cam.y, clamp(player.y - H / 2, 0, L.wh - H), k);
      renderFloor(cx, t, 1, near);

    } else if (state === 'fx') {
      fxLeft -= dt;
      staticFrame(cx, t / 1000);
      if (fxLeft <= 0) state = fxNext;

    } else if (state === 'rec') {
      const hold = keys.use || keys.right;
      if (!records[recIdx]) {
        if (hold) recP = c01(recP + dt * (keys.right ? 0.2 : 0.12));
        if (keys.left) recP = c01(recP - dt * 0.3);
        if (recP >= 1) { records[recIdx] = true; taskEl.classList.add('done'); L.acts.forEach((a) => { if (a.rec === recIdx) a.done = true; }); }
      } else if (keys.right) recP = c01(recP + dt * 0.2);
      else if (keys.left) recP = c01(recP - dt * 0.3);
      taskFill.style.width = Math.round(recP * 100) + '%';
      taskHint.textContent = records[recIdx] ? 'RECORD RECOVERED · [E] BACK TO THE FLOOR' : 'HOLD [E] TO READ · [ESC] TO LEAVE';
      if (escEdge || (useEdge && records[recIdx])) {
        taskEl.hidden = true;
        state = 'fx'; fxLeft = 0.22; fxNext = 'play';
        staticFrame(cx, t / 1000);
      } else {
        A.scenes[['deaths', 'hospital', 'masks', 'vaccines', 'memory'][recIdx]](cx, recP, t);
      }

    } else if (state === 'dead') {
      deadT += dt;
      R(cx, 0, 0, W, H, COL.void);
      if (deadT > 0.25) {
        const a = c01((deadT - 0.25) / 0.5);
        textC(cx, 'YOU DIED', W / 2, 84, COL.red, 3, 1, a);
        if (deadT > 1) textC(cx, 'IT CAUGHT YOU ON FLOOR ' + LEVELS[floorN].n, W / 2, 118, COL.dim, 1, 1, c01(deadT - 1));
        if (deadT > 1.6) textC(cx, 'THE HOSPITAL RESETS. YOU START AT THE DOORS AGAIN.', W / 2, 132, COL.grey2, 1, 1, c01(deadT - 1.6));
        if (deadT > 2.2) textC(cx, 'DEATHS ' + deaths, W / 2, 152, COL.grey2, 1, 1, c01(deadT - 2.2));
      }
      A.grain(cx, 0.9, t);
      if (deadT > 3.6) startRun();

    } else if (state === 'win' || state === 'claim') {
      winT += dt;
      if (winT < 1.1) {
        R(cx, 0, 0, W, H, winT % 0.2 < 0.1 ? '#170203' : COL.void);
        vaccine(cx, winT);
        textC(cx, 'FIRST AID KIT', W / 2, 120, COL.bone, 1, 1, 1);
      } else if (winT < 3.4) {
        R(cx, 0, 0, W, H, COL.void);
        vaccine(cx, 1);
        textC(cx, 'VACCINE ADMINISTERED', W / 2, 118, COL.bone, 2, 1, 1);
        textC(cx, 'INFECTION 00%  ·  YOU GET TO LEAVE', W / 2, 140, COL.red, 1, 1, c01((winT - 1.6) / 0.8));
        textC(cx, 'TIME ' + clock(runMs) + '   DEATHS ' + deaths + '   RECORDS ' + records.filter(Boolean).length + '/5',
              W / 2, 156, COL.grey2, 1, 1, c01((winT - 2.2) / 0.8));
      } else {
        A.scenes.memory(cx, c01((winT - 3.4) / 14), t);
        if (winT > 15 && state === 'win') {
          state = 'claim';
          $('#claimTime').textContent = clock(runMs);
          $('#claimDeaths').textContent = String(deaths);
          if (postEl) postEl.href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(postText());
          claimEl.hidden = false;
        }
      }
      A.grain(cx, 0.5, t);
    }

    A.grain(cx, state === 'rec' ? 0.4 : 0.55, t);
    A.interlace(cx, 0.22);
    if (!window.SHELL.REDUCED && state !== 'fx') A.tear(cx, state === 'rec' ? 0.3 : 0.16, t, 5);

    useEdge = escEdge = false;
  }

  /* ---------- briefing and claim ---------- */

  $('#briefGo').addEventListener('click', () => {
    briefEl.hidden = true;
    started = true;
    startRun();
  });

  const caEl = $('#prizeCA'), postEl = $('#claimPost');
  if (caEl && COIN.ca) caEl.textContent = COIN.ca;

  function postText() {
    return 'I cleared PANDEMIK. Four floors, one dose. TIME ' + clock(runMs) + ' · DEATHS ' + deaths +
           '.\nFirst clear takes 50% of the creator fees.' + (COIN.ca ? '\nCA: ' + COIN.ca : '');
  }

  $('#claimGo').addEventListener('click', () => {
    const addr = $('#wallet').value.trim();
    const note = $('#claimNote');
    if (!addr) { note.textContent = 'Paste a public address first, or skip.'; return; }
    if (/\s/.test(addr) && addr.split(/\s+/).length > 3) {
      note.textContent = 'That looks like a seed phrase, not an address. Never paste a seed phrase anywhere. Nothing was saved.';
      $('#wallet').value = '';
      return;
    }
    const claim = 'PANDEMIK CLEAR · ' + addr + ' · TIME ' + clock(runMs) + ' · DEATHS ' + deaths +
                  ' · RECORDS ' + records.filter(Boolean).length + '/5' + (COIN.ca ? ' · CA ' + COIN.ca : '') +
                  ' · ' + new Date().toISOString();
    try { localStorage.setItem('pandemik-claim', claim); } catch (_) { /* storage blocked */ }
    if (navigator.clipboard) navigator.clipboard.writeText(claim).catch(() => {});
    if (postEl) postEl.href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(postText() + '\n' + addr);
    note.textContent = 'Copied: ' + claim + ' — post it on X with the CA and send the line to the project. ' +
                       'Nothing was charged, sent or connected from this page.';
  });

  $('#claimSkip').addEventListener('click', () => { claimEl.hidden = true; });

  /* ---------- what the shell calls ---------- */

  loadFloor(0);

  window.MODE_FLOOR = {
    frame,
    enter() {
      for (const k in keys) keys[k] = 0;
      useEdge = escEdge = false;
      if (!started) { briefEl.hidden = false; state = 'brief'; }
    },
    leave() { for (const k in keys) keys[k] = 0; }
  };

})();
