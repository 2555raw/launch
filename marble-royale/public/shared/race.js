/* MARBLE ROYALE - the race itself.

   This file is the one piece of code that both sides run. The server plays the
   whole race out the instant it starts, in a few milliseconds, and keeps the
   finish order as the official result; every browser replays the same race at
   sixty steps a second so people watch the thing that already happened. That
   only works if the two runs agree to the last bit, so the rules here are
   strict:

     - the only randomness is a seeded integer generator (mulberry32), never
       Math.random;
     - the only floating point operations are + - * / and Math.sqrt, which
       IEEE-754 pins down exactly. Math.sin and Math.cos are NOT pinned down
       across engines, so the spinners and pistons use dsin/dcos below, a
       polynomial that is only accurate to about a thousandth but is accurate to
       the same thousandth everywhere;
     - the step is fixed at 1/60s and never depends on the frame rate;
     - marbles are simulated in the order the server hands them over.

   Break one of those and a browser can show a different winner from the one
   being paid, which is the one bug this project cannot have. (The banner still
   quotes the server's result either way - the replay is a picture of it.)

   Geometry: x runs 0..WIDTH across the course, y runs downward from the hopper
   to the finish line. */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RACE = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const WIDTH = 1000;        // course width in course units
  const R = 13;              // marble radius
  const DT = 1 / 60;         // fixed physics step
  const GRAVITY = 880;
  const MAX_SPEED = 1350;
  const WALL_BOUNCE = 0.34;
  const BALL_BOUNCE = 0.16;
  const AIR = 0.9992;        // a whisper of drag, so nothing runs away
  const MAX_SECONDS = 40;    // hard ceiling on a race
  const RUSH_AT = 26;        // gravity starts climbing here, so races end

  /* ---- deterministic arithmetic ------------------------------------------ */

  const PI = 3.141592653589793;
  const TAU = 6.283185307179586;

  function mulberry32(a) {
    let t = a >>> 0;
    return function () {
      t = (t + 0x6D2B79F5) >>> 0;
      let x = t;
      x = Math.imul(x ^ (x >>> 15), 1 | x);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash32(n) {
    let x = n >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
    return (x ^ (x >>> 16)) >>> 0;
  }

  /* Sine to about 1e-3, using only arithmetic, so every engine agrees. */
  function dsin(x) {
    x = x - TAU * Math.floor((x + PI) / TAU);
    let y = 1.2732395447351628 * x - 0.4052847345693511 * x * (x < 0 ? -x : x);
    y = 0.225 * (y * (y < 0 ? -y : y) - y) + y;
    return y;
  }
  function dcos(x) { return dsin(x + 1.5707963267948966); }

  /* ---- course ------------------------------------------------------------ */

  /* A course is a list of static shapes (capsules and pegs), a list of movers
     (spinners and pistons, whose shape at time t is arithmetic on t) and the y
     of the finish line. Statics go into horizontal bands so a marble only ever
     tests the handful of shapes beside it. */

  const BAND = 220;

  function makeCourse(seed) {
    const rnd = mulberry32(seed ^ 0x9e3779b9);
    const statics = [];
    const movers = [];
    let y = 0;

    const seg = (x1, y1, x2, y2, r, b) =>
      statics.push({ x1, y1, x2, y2, r: r || 9, b: b === undefined ? WALL_BOUNCE : b });
    const peg = (x, y0, r, b) =>
      statics.push({ x1: x, y1: y0, x2: x, y2: y0, r: r || 15, b: b === undefined ? 0.45 : b });
    const pick = (n) => Math.floor(rnd() * n);

    /* The hopper: everyone waits behind a gate that slides open at t=0. Its
       walls run past the frame on both sides, because a capsule that stops
       exactly where another one starts leaves a notch a marble can sit in
       forever. Every ramp below does the same for the same reason. */
    const HOPPER = 520;
    seg(40, -200, 40, HOPPER - 150, 10);
    seg(WIDTH - 40, -200, WIDTH - 40, HOPPER - 150, 10);
    seg(20, HOPPER - 170, WIDTH / 2 - 170, HOPPER + 10, 10);
    seg(WIDTH - 20, HOPPER - 170, WIDTH / 2 + 170, HOPPER + 10, 10);
    const gate = { kind: 'gate', x: WIDTH / 2, y: HOPPER + 8, half: 190, r: 10, open: 0.9 };
    movers.push(gate);
    y = HOPPER + 90;

    /* Each course has a look of its own and a name people can refer to. */
    const theme = pick(5);

    /* Seven to nine sections, never the same kind twice in a row, drawn from
       ten kinds, with the height and the details of each one drawn too, so no
       two courses are alike. */
    const KINDS = ['pegs', 'zigzag', 'spinners', 'pistons', 'split', 'bumpers',
                   'funnel', 'stairs', 'plinko', 'flippers'];
    let last = -1;
    const sections = [];
    const count = 7 + pick(3);
    for (let i = 0; i < count; i++) {
      let k = pick(KINDS.length);
      if (k === last) k = (k + 1 + pick(KINDS.length - 1)) % KINDS.length;
      last = k;
      sections.push(KINDS[k]);
    }

    for (const kind of sections) {
      const h = 820 + pick(3) * 80;
      /* Side walls for the whole section, leaning in a little. */
      const lean = 14 + pick(3) * 8;
      seg(30, y - 30, 30 + lean, y + h + 30, 12);
      seg(WIDTH - 30, y - 30, WIDTH - 30 - lean, y + h + 30, 12);

      if (kind === 'pegs') {
        const rows = 5 + pick(2), gapx = 90 + pick(3) * 10;
        for (let r0 = 0; r0 < rows; r0++) {
          const off = (r0 % 2) * (gapx / 2);
          for (let c = 0; c < 10; c++) {
            const px = 105 + off + c * gapx;
            if (px > WIDTH - 80) continue;
            peg(px, y + 110 + r0 * ((h - 200) / rows), 13 + pick(4) * 3);
          }
        }
      } else if (kind === 'zigzag') {
        /* Two long ramps at a real marble-run pitch, each sized to the room it
           has so neither can cross the other and close a pocket. */
        const n = 2, room = (h - 100) / n;
        for (let s = 0; s < n; s++) {
          const fromLeft = (s + pick(1)) % 2 === 0;
          const y0 = y + 50 + s * room;
          const gap = 230 + pick(4) * 30;
          const drop = room * 0.72;
          if (fromLeft) seg(-40, y0, WIDTH - gap, y0 + drop, 11);
          else seg(WIDTH + 40, y0, gap, y0 + drop, 11);
          peg(fromLeft ? WIDTH - gap / 2 : gap / 2, y0 + drop + room * 0.2, 15 + pick(3) * 3);
        }
      } else if (kind === 'spinners') {
        for (let s = 0; s < 3; s++) {
          movers.push({
            kind: 'spinner',
            x: 260 + pick(2) * 240 + (s % 2) * 240,
            y: y + 190 + s * ((h - 260) / 3),
            len: 140 + pick(4) * 25,
            r: 13,
            arms: 2 + (pick(3) === 0 ? 1 : 0),
            speed: (1.2 + pick(6) * 0.22) * (pick(2) ? 1 : -1),
            phase: rnd() * TAU
          });
          peg(s % 2 ? 120 : WIDTH - 120, y + 300 + s * ((h - 260) / 3), 16);
        }
      } else if (kind === 'pistons') {
        for (let s = 0; s < 3; s++) {
          movers.push({
            kind: 'piston',
            x: WIDTH / 2,
            y: y + 180 + s * ((h - 240) / 3),
            half: 140 + pick(4) * 30,
            tilt: (pick(2) ? 1 : -1) * (60 + pick(3) * 15),
            r: 18,
            amp: 180 + pick(5) * 30,
            speed: 0.8 + pick(6) * 0.2,
            phase: rnd() * TAU
          });
          peg(s % 2 ? 110 : WIDTH - 110, y + 300 + s * ((h - 240) / 3), 16);
        }
      } else if (kind === 'split') {
        const n = 3, room = (h - 100) / n;
        for (let s = 0; s < n; s++) {
          const y0 = y + 60 + s * room;
          const cx = WIDTH / 2 + (pick(3) - 1) * 110;
          const arm = Math.min(250, room * 0.62);
          seg(cx - 4, y0, cx - arm, y0 + arm, 12);
          seg(cx + 4, y0, cx + arm, y0 + arm, 12);
          peg(cx, y0 + room * 0.9, 18);
        }
      } else if (kind === 'bumpers') {
        const n = 7 + pick(3);
        for (let s = 0; s < n; s++) {
          peg(130 + pick(8) * 95, y + 110 + s * ((h - 220) / n), 20 + pick(4) * 6, 0.72);
        }
      } else if (kind === 'funnel') {
        /* Two walls closing to a throat, then a peg to split the stream. */
        const throat = 220 + pick(4) * 30;
        const yt = y + 420 + pick(3) * 60;
        seg(-40, y + 90, WIDTH / 2 - throat / 2, yt, 13);
        seg(WIDTH + 40, y + 90, WIDTH / 2 + throat / 2, yt, 13);
        seg(WIDTH / 2 - throat / 2, yt, WIDTH / 2 - throat / 2, yt + 90, 13);
        seg(WIDTH / 2 + throat / 2, yt, WIDTH / 2 + throat / 2, yt + 90, 13);
        peg(WIDTH / 2 + (pick(3) - 1) * 60, yt + 260, 20);
        peg(WIDTH / 2 - 220, yt + 380, 16);
        peg(WIDTH / 2 + 220, yt + 380, 16);
      } else if (kind === 'stairs') {
        /* Short steep steps, alternating sides, each inside its own band. */
        const n = 5, room = (h - 120) / n;
        for (let s = 0; s < n; s++) {
          const fromLeft = s % 2 === 0;
          const y0 = y + 60 + s * room;
          const len = 300 + pick(3) * 40;
          const drop = room * 0.7;
          if (fromLeft) seg(-40, y0, len, y0 + drop, 11);
          else seg(WIDTH + 40, y0, WIDTH - len, y0 + drop, 11);
        }
      } else if (kind === 'plinko') {
        /* Dense small pegs: the field spreads out and mixes. */
        const rows = 8, gapx = 70;
        for (let r0 = 0; r0 < rows; r0++) {
          const off = (r0 % 2) * (gapx / 2);
          for (let c = 0; c < 14; c++) {
            const px = 90 + off + c * gapx;
            if (px > WIDTH - 70) continue;
            peg(px, y + 100 + r0 * ((h - 180) / rows), 8 + pick(2) * 2, 0.5);
          }
        }
      } else { /* flippers */
        for (let s = 0; s < 3; s++) {
          movers.push({
            kind: 'spinner',
            x: 200 + pick(3) * 300,
            y: y + 170 + s * ((h - 240) / 3),
            len: 90 + pick(3) * 15,
            r: 12,
            arms: 1,
            speed: (2 + pick(3) * 0.4) * (pick(2) ? 1 : -1),
            phase: rnd() * TAU
          });
        }
        peg(WIDTH / 2, y + h - 140, 18);
      }
      y += h;
    }

    /* The run-in: a funnel that squeezes the field into one chute, so the last
       seconds are a scrap between whoever is left rather than a procession. */
    const fy = y + 20;
    seg(-40, fy, WIDTH / 2 - 150, fy + 430, 14);
    seg(WIDTH + 40, fy, WIDTH / 2 + 150, fy + 430, 14);
    peg(WIDTH / 2 - 260, fy + 190, 20);
    peg(WIDTH / 2 + 260, fy + 190, 20);
    seg(WIDTH / 2 - 150, fy + 420, WIDTH / 2 - 150, fy + 700, 14);
    seg(WIDTH / 2 + 150, fy + 420, WIDTH / 2 + 150, fy + 700, 14);
    const finishY = fy + 640;
    const height = finishY + 300;

    /* Bands, for the broad phase. */
    const bands = [];
    const bandCount = Math.ceil(height / BAND) + 2;
    for (let i = 0; i < bandCount; i++) bands.push([]);
    for (const s of statics) {
      const lo = Math.max(0, Math.floor((Math.min(s.y1, s.y2) - s.r - R) / BAND));
      const hi = Math.min(bandCount - 1, Math.floor((Math.max(s.y1, s.y2) + s.r + R) / BAND));
      for (let i = lo; i <= hi; i++) bands[i].push(s);
    }

    return { statics, movers, bands, bandCount, gate, finishY, height, sections, theme, width: WIDTH };
  }

  /* Where a mover is at time t, as a capsule (and how fast it is travelling, so
     it can throw a marble rather than let it pass through). */
  function moverSegments(m, t, out, hold) {
    if (m.kind === 'gate') {
      /* Shut until the start, then it slides out to the right over m.open
         seconds. Its speed goes with it so it flicks the last marbles rather
         than passing through them. */
      const k = hold || t <= 0 ? 0 : Math.min(1, t / m.open);
      const ease = k * k * (3 - 2 * k);
      const dx = ease * (m.half * 2 + 60);
      const vx = k > 0 && k < 1 ? ((m.half * 2 + 60) * 6 * k * (1 - k)) / m.open : 0;
      out.push({ x1: m.x - m.half + dx, y1: m.y, x2: m.x + m.half + dx, y2: m.y, r: m.r, b: 0.1, vx, vy: 0, gate: true });
    } else if (m.kind === 'spinner') {
      const a = m.phase + m.speed * t;
      for (let i = 0; i < m.arms; i++) {
        const ang = a + (PI * i) / m.arms;
        const cx = dcos(ang) * m.len, cy = dsin(ang) * m.len;
        out.push({
          x1: m.x - cx, y1: m.y - cy, x2: m.x + cx, y2: m.y + cy, r: m.r, b: 0.5,
          /* tangential speed at the tip, used for both ends; close enough and
             perfectly reproducible */
          vx: -dsin(ang) * m.len * m.speed, vy: dcos(ang) * m.len * m.speed
        });
      }
    } else {
      const cx = m.x + m.amp * dsin(m.phase + m.speed * t);
      const vx = m.amp * m.speed * dcos(m.phase + m.speed * t);
      const tilt = m.tilt || 0;
      out.push({ x1: cx - m.half, y1: m.y - tilt / 2, x2: cx + m.half, y2: m.y + tilt / 2, r: m.r, b: 0.45, vx, vy: 0 });
    }
    return out;
  }

  /* ---- the race ---------------------------------------------------------- */

  /* marbles: the list the server locked in, in that order. Each entry only
     needs an id; anything else (colour, label) is decoration and lives on the
     client. */
  function createRace(seed, marbles, opts) {
    const course = makeCourse(seed);
    const hold = !!(opts && opts.hold);
    const rnd = mulberry32((seed ^ 0x85ebca6b) >>> 0);
    const n = marbles.length;
    const perRow = Math.max(4, Math.min(14, Math.ceil(Math.sqrt(n * 1.6))));
    const balls = [];

    /* Start slots are shuffled with the round seed, so an early join is not a
       better slot - which is the whole point of revealing the seed afterwards. */
    const slots = [];
    for (let i = 0; i < n; i++) slots.push(i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const tmp = slots[i]; slots[i] = slots[j]; slots[j] = tmp;
    }

    for (let i = 0; i < n; i++) {
      const s = slots[i];
      const col = s % perRow, row = Math.floor(s / perRow);
      const spread = Math.min(760, perRow * 46);
      const x = WIDTH / 2 - spread / 2 + (col + 0.5) * (spread / perRow) + (rnd() - 0.5) * 10;
      const y = 300 - row * 34 - rnd() * 8;
      balls.push({
        id: marbles[i].id, i,
        x, y, px: x, py: y, vx: 0, vy: 0,
        best: y, stuck: 0, kicks: 0, place: 0, time: 0, done: false, spin: 0
      });
    }

    return {
      seed, course, balls, t: 0, step: 0, hold,
      finished: [], over: false, leader: null
    };
  }

  const cellOf = (x, y) => ((y / 40) | 0) * 4096 + ((x / 40) | 0);

  function step(st) {
    if (st.over) return st;
    const c = st.course, balls = st.balls, t = st.t;
    const g = t > RUSH_AT ? GRAVITY * Math.min(3, 1 + (t - RUSH_AT) * 0.16) : GRAVITY;
    /* movers, once per step */
    const dyn = [];
    for (const m of c.movers) moverSegments(m, t, dyn, st.hold);

    /* integrate */
    for (let i = 0; i < balls.length; i++) {
      const b = balls[i];
      if (b.done) {
        /* Past the line, a marble drops out of the bottom of the picture. It has
           its place already and touches nothing, so this is purely what the eye
           sees - the finish would otherwise look like marbles blinking out. */
        b.vy += g * DT;
        b.x += b.vx * DT;
        b.y += b.vy * DT;
        continue;
      }
      b.px = b.x; b.py = b.y;
      b.vy += g * DT;
      b.vx *= AIR; b.vy *= AIR;
      const sp2 = b.vx * b.vx + b.vy * b.vy;
      if (sp2 > MAX_SPEED * MAX_SPEED) {
        const k = MAX_SPEED / Math.sqrt(sp2);
        b.vx *= k; b.vy *= k;
      }
      b.x += b.vx * DT;
      b.y += b.vy * DT;
    }

    /* statics and movers */
    for (let i = 0; i < balls.length; i++) {
      const b = balls[i];
      if (b.done) continue;
      const band = (b.y / BAND) | 0;
      for (let k = band - 1; k <= band + 1; k++) {
        if (k < 0 || k >= c.bandCount) continue;
        const list = c.bands[k];
        for (let j = 0; j < list.length; j++) {
          const s = list[j];
          hitCapsule(b, s, 0, 0);
        }
      }
      for (let j = 0; j < dyn.length; j++) {
        const s = dyn[j];
        if (b.y < s.y1 - 260 || b.y > s.y1 + 260) continue;
        hitCapsule(b, s, s.vx, s.vy);
      }
      /* outer walls, as a clamp - cheaper and impossible to tunnel through */
      if (b.x < R) { b.x = R; if (b.vx < 0) b.vx = -b.vx * WALL_BOUNCE; }
      if (b.x > WIDTH - R) { b.x = WIDTH - R; if (b.vx > 0) b.vx = -b.vx * WALL_BOUNCE; }
    }

    /* marble on marble, through a hash grid */
    const grid = new Map();
    for (let i = 0; i < balls.length; i++) {
      const b = balls[i];
      if (b.done) continue;
      const key = cellOf(b.x, b.y);
      let cell = grid.get(key);
      if (!cell) { cell = []; grid.set(key, cell); }
      cell.push(i);
    }
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      if (a.done) continue;
      const gx = (a.x / 40) | 0, gy = (a.y / 40) | 0;
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const cell = grid.get((gy + oy) * 4096 + (gx + ox));
          if (!cell) continue;
          for (let q = 0; q < cell.length; q++) {
            const j = cell[q];
            if (j <= i) continue;
            hitBall(a, balls[j]);
          }
        }
      }
    }

    /* progress, stuck marbles, finish line */
    let leader = null, leadY = -1e9;
    for (let i = 0; i < balls.length; i++) {
      const b = balls[i];
      if (b.done) continue;
      if (b.y > b.best + 4) { b.best = b.y; b.stuck = 0; b.kicks = 0; } else { b.stuck++; }
      /* A marble can come to rest in a notch, or balance on the tip of a ramp,
         and physics alone will never move it again. After a second without
         progress the course shoves it, harder and harder and in an alternating
         direction, until it is falling again. The shove is integer arithmetic on
         the marble's index and the step number, so it is the same shove in every
         browser. */
      if (b.stuck > 72) {
        b.stuck = 36;
        b.kicks = (b.kicks || 0) + 1;
        const k = b.kicks < 5 ? b.kicks : 5;
        const h = hash32(b.i * 9781 + st.step);
        b.vx += ((h & 1) ? 1 : -1) * (170 + 70 * k);
        b.vy += 110 + 70 * k;
      }
      if (b.y >= c.finishY) {
        b.done = true;
        b.time = t;
        b.place = st.finished.length + 1;
        st.finished.push(b);
      } else if (b.y > leadY) { leadY = b.y; leader = b; }
    }
    st.leader = leader || st.finished[st.finished.length - 1] || null;

    st.t += DT;
    st.step++;

    /* A held race is the lobby - it has no finish and must never end, not even
       when it is empty, because marbles are still arriving. A real race ends
       when everyone is home or the clock runs out; the empty case is checked
       because a race created before its field arrived would otherwise call
       itself finished on its very first step and freeze. */
    if (!st.hold && ((balls.length > 0 && st.finished.length === balls.length) || st.t >= MAX_SECONDS)) {
      /* Whoever is still on the course is ranked by how far down it got, so a
         race always has a full order even if the clock runs out. */
      if (st.t >= MAX_SECONDS) {
        const rest = balls.filter((b) => !b.done).sort((p, q) => (q.best - p.best) || (p.i - q.i));
        for (const b of rest) { b.place = st.finished.length + 1; b.time = MAX_SECONDS; st.finished.push(b); }
      }
      st.over = true;
    }
    return st;
  }

  function hitCapsule(b, s, ovx, ovy) {
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
    const L2 = dx * dx + dy * dy;
    let u = 0;
    if (L2 > 0) {
      u = ((b.x - s.x1) * dx + (b.y - s.y1) * dy) / L2;
      if (u < 0) u = 0; else if (u > 1) u = 1;
    }
    const cx = s.x1 + dx * u, cy = s.y1 + dy * u;
    let nx = b.x - cx, ny = b.y - cy;
    let d2 = nx * nx + ny * ny;
    const rad = R + s.r;
    if (d2 >= rad * rad) return;
    let d = Math.sqrt(d2);
    if (d < 0.0001) { nx = 0; ny = -1; d = 0.0001; } else { nx /= d; ny /= d; }
    b.x += nx * (rad - d);
    b.y += ny * (rad - d);
    const rvx = b.vx - (ovx || 0), rvy = b.vy - (ovy || 0);
    const vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      const j = -(1 + s.b) * vn;
      b.vx += nx * j; b.vy += ny * j;
      /* Friction along the surface, so marbles roll off ramps instead of
         skating, and the roll it produces: the spin is the tangential speed
         over the radius, signed by which way round the surface is. It is only
         ever drawn, never fed back into the motion. */
      const tx = rvx - nx * vn, ty = rvy - ny * vn;
      b.vx -= tx * 0.012; b.vy -= ty * 0.012;
      b.spin = (tx * -ny + ty * nx) / R;
    }
  }

  function hitBall(a, b) {
    let nx = b.x - a.x, ny = b.y - a.y;
    let d2 = nx * nx + ny * ny;
    const rad = R + R;
    if (d2 >= rad * rad || d2 === 0) return;
    const d = Math.sqrt(d2);
    nx /= d; ny /= d;
    const push = (rad - d) * 0.5;
    a.x -= nx * push; a.y -= ny * push;
    b.x += nx * push; b.y += ny * push;
    const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (vn >= 0) return;
    const j = -(1 + BALL_BOUNCE) * vn * 0.5;
    a.vx -= nx * j; a.vy -= ny * j;
    b.vx += nx * j; b.vy += ny * j;
  }

  /* Drops one more marble into a held race. The lobby uses it so a marble falls
     into the hopper the moment its owner joins; a race that counts never calls
     it, because its field is fixed before the seed exists. */
  function addBall(st, id) {
    const n = st.balls.length;
    const h = hash32(n * 2654435761 + (st.seed >>> 0));
    const x = WIDTH / 2 + (((h % 1000) / 1000) - 0.5) * 520;
    const y = -40 - ((h >>> 10) % 60);
    st.balls.push({
      id, i: n, x, y, px: x, py: y, vx: (((h >>> 16) % 100) - 50) * 1.2, vy: 60,
      best: y, stuck: 0, kicks: 0, place: 0, time: 0, done: false
    });
    return st.balls[n];
  }

  /* Plays the race out with no rendering. This is what the server calls. */
  function runToEnd(seed, marbles) {
    const st = createRace(seed, marbles);
    let guard = 0;
    while (!st.over && guard++ < MAX_SECONDS * 60 + 10) step(st);
    return {
      seconds: st.t,
      order: st.finished.map((b) => ({ id: b.id, place: b.place, time: Math.round(b.time * 1000) / 1000 }))
    };
  }

  return {
    WIDTH, R, DT, MAX_SECONDS, BAND,
    mulberry32, dsin, dcos,
    makeCourse, moverSegments, createRace, addBall, step, runToEnd
  };
});
