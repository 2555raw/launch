/* Drawing the race.

   The renderer owns no truth. It is handed a race state that the engine in
   shared/race.js advances, and its whole job is to point a camera at the leader
   and make the thing readable: the track ahead, who is winning, which marble is
   yours. Anything here that looks like physics - sparks, trails, confetti - is
   paint, and deliberately has no way to touch a marble.

   The camera keeps the full width of the course on screen at all times. Nobody
   should ever wonder whether the marble that just passed theirs was off-camera. */

(function () {
  'use strict';

  const RACE = window.RACE;
  const W = RACE.WIDTH;
  const R = RACE.R;

  const cv = { el: null, ctx: null, w: 0, h: 0, dpr: 1 };
  const cam = { y: 0, scale: 1, base: 1, zoom: 1, vh: 900, started: false };

  let race = null;           // the engine state being drawn
  let meta = new Map();      // address -> { color, isMe, short }
  let trails = new Map();    // address -> [x, y, x, y, ...] most recent first
  let sparks = [];
  let confetti = [];
  let cheers = [];           // floating hearts
  let lastSpeed = new Map();
  let flash = 0;

  const TRAIL = 9;

  /* Five looks, one per course, so a new race reads as a new place before a
     single marble has moved. Each is a ground, a rail, a rail edge, a peg and a
     glow; everything on the track is drawn from these. */
  const THEMES = [
    { name: 'Neon Shaft',  bg: '#0c0c14', grid: 'rgba(255,255,255,.035)', rail: '#38496b', edge: '#5b7099', peg: '#46597a', glow: 'rgba(110,231,255,.22)', mover: '#a8376a', moverGlow: 'rgba(255,94,168,.18)', pin: '#ff5ea8' },
    { name: 'Ember Mine',  bg: '#14100d', grid: 'rgba(255,200,150,.04)', rail: '#5a3d2e', edge: '#8a5d45', peg: '#6b4636', glow: 'rgba(255,138,61,.22)', mover: '#b5552a', moverGlow: 'rgba(255,138,61,.18)', pin: '#ffb070' },
    { name: 'Ice Run',     bg: '#0d1218', grid: 'rgba(180,220,255,.05)', rail: '#3f5a6e', edge: '#7fa5c0', peg: '#4d6a80', glow: 'rgba(160,220,255,.22)', mover: '#3f7f9e', moverGlow: 'rgba(160,220,255,.18)', pin: '#bfe6ff' },
    { name: 'Moss Gulch',  bg: '#0d1310', grid: 'rgba(160,255,190,.04)', rail: '#3a5a45', edge: '#6a9a78', peg: '#476b53', glow: 'rgba(125,255,155,.2)', mover: '#5a8a3a', moverGlow: 'rgba(160,255,120,.16)', pin: '#b7ff9b' },
    { name: 'Violet Vault', bg: '#120e18', grid: 'rgba(220,180,255,.045)', rail: '#4d3f6b', edge: '#7f6aa8', peg: '#5c4b7d', glow: 'rgba(185,139,255,.22)', mover: '#8a3f9e', moverGlow: 'rgba(255,120,240,.16)', pin: '#e5b8ff' }
  ];
  let theme = THEMES[0];
  let spinAngle = new Map();   // address -> how far round the marble has rolled

  function init(canvas) {
    cv.el = canvas;
    cv.ctx = canvas.getContext('2d', { alpha: false });
    resize();
    addEventListener('resize', resize);
    if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas.parentElement || canvas);
  }

  function resize() {
    if (!cv.el) return;
    const rect = cv.el.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.w = Math.max(1, Math.round(rect.width));
    cv.h = Math.max(1, Math.round(rect.height));
    cv.dpr = dpr;
    cv.el.width = Math.round(cv.w * dpr);
    cv.el.height = Math.round(cv.h * dpr);
    cam.base = Math.min(cv.w / 1090, cv.h / 950);
    cam.scale = cam.base * (cam.zoom || 1);
    cam.vh = cv.h / cam.scale;
  }

  function setRace(state, players, myAddress) {
    race = state;
    theme = THEMES[(state.course.theme || 0) % THEMES.length];
    spinAngle = new Map();
    meta = new Map();
    for (const p of players) {
      meta.set(p.address, {
        color: p.color || '#6ee7ff',
        face: p.face || 'none',
        isMe: p.address === myAddress,
        short: p.address.slice(0, 4) + '…' + p.address.slice(-4)
      });
    }
    trails = new Map();
    lastSpeed = new Map();
    sparks = []; confetti = []; cheers = [];
    cam.started = false;
  }

  const addPlayer = (address, color, isMe, face) => meta.set(address, {
    color: color || '#6ee7ff', face: face || 'none', isMe,
    short: address.slice(0, 4) + '…' + address.slice(-4)
  });

  /* A cheer is a heart that floats off the marble it was sent to. It moves
     nothing. */
  function cheer(address) {
    if (!race) return;
    const b = race.balls.find((x) => x.id === address);
    if (!b) return;
    for (let i = 0; i < 3; i++) {
      cheers.push({ x: b.x + (Math.random() - 0.5) * 30, y: b.y, life: 1, vy: -110 - Math.random() * 60, color: (meta.get(address) || {}).color || '#ff5ea8' });
    }
  }

  function celebrate(address) {
    const colour = (meta.get(address) || {}).color || '#7dff9b';
    for (let i = 0; i < 140; i++) {
      confetti.push({
        x: W / 2 + (Math.random() - 0.5) * 700,
        y: cam.y + cam.vh * 0.2 + Math.random() * 120,
        vx: (Math.random() - 0.5) * 420,
        vy: -120 - Math.random() * 320,
        rot: Math.random() * 7, vr: (Math.random() - 0.5) * 12,
        life: 1,
        color: i % 3 === 0 ? colour : (i % 3 === 1 ? '#ffd36e' : '#ffffff')
      });
    }
    flash = 1;
  }

  /* ---- the frame --------------------------------------------------------- */

  function draw(dt, opts) {
    const ctx = cv.ctx;
    if (!ctx) return;
    ctx.save();
    ctx.scale(cv.dpr, cv.dpr);
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, cv.w, cv.h);

    if (!race) { ctx.restore(); return; }

    /* camera: follows the leader, and breathes - out while the pack is spread
       so the chase stays in shot, in as it bunches up at the finish */
    const lead = race.leader || race.balls[0];
    let spread = 0;
    if (lead && race.t > 0) {
      let fifth = lead.y;
      const ys = [];
      for (const b of race.balls) if (!b.done) ys.push(b.y);
      ys.sort((p, q) => q - p);
      fifth = ys[Math.min(ys.length - 1, 4)] ?? lead.y;
      spread = Math.max(0, lead.y - fifth);
    }
    const wantZoom = Math.max(0.82, Math.min(1, 1 - spread / 3200));
    cam.zoom = cam.zoom === undefined ? wantZoom : cam.zoom + (wantZoom - cam.zoom) * Math.min(1, dt * 1.5);
    cam.scale = cam.base * cam.zoom;
    cam.vh = cv.h / cam.scale;

    const target = lead ? Math.max(0, lead.y - cam.vh * 0.36) : 0;
    const maxY = Math.max(0, race.course.height - cam.vh);
    const want = Math.min(target, maxY);
    if (!cam.started) { cam.y = want; cam.started = true; }
    else cam.y += (want - cam.y) * Math.min(1, dt * 6);

    const ox = (cv.w - W * cam.scale) / 2;
    ctx.translate(ox, 0);
    ctx.scale(cam.scale, cam.scale);
    ctx.translate(0, -cam.y);

    const top = cam.y, bottom = cam.y + cam.vh;

    backdrop(ctx, top, bottom);
    course(ctx, top, bottom);
    movers(ctx, top, bottom);
    finish(ctx, top, bottom);
    marbles(ctx, dt, opts && opts.paused);
    paint(ctx, dt);

    ctx.restore();

    margins(opts);
    if (flash > 0) {
      ctx.save();
      ctx.scale(cv.dpr, cv.dpr);
      ctx.fillStyle = 'rgba(255,255,255,' + (flash * 0.5) + ')';
      ctx.fillRect(0, 0, cv.w, cv.h);
      ctx.restore();
      flash = Math.max(0, flash - dt * 2.2);
    }
  }

  function backdrop(ctx, top, bottom) {
    /* A grid that scrolls with the camera, so speed reads even when the marbles
       are bunched up. */
    ctx.save();
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const step = 150;
    for (let y = Math.floor(top / step) * step; y < bottom + step; y += step) {
      ctx.moveTo(-200, y); ctx.lineTo(W + 200, y);
    }
    for (let x = 0; x <= W; x += 125) { ctx.moveTo(x, top - 10); ctx.lineTo(x, bottom + 10); }
    ctx.stroke();

    /* the walls of the shaft, outside the course */
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(-400, top - 20, 400, cam.vh + 40);
    ctx.fillRect(W, top - 20, 400, cam.vh + 40);
    ctx.restore();
  }

  function capsule(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.lineWidth = s.r * 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  function course(ctx, top, bottom) {
    const c = race.course;
    ctx.save();
    /* one pass for the glow, one for the body, one for the lit edge: cheaper
       than shadowBlur on every shape and it reads as a solid rail with a light
       coming from the top left */
    ctx.strokeStyle = theme.glow;
    for (const s of c.statics) {
      if (Math.max(s.y1, s.y2) < top - 40 || Math.min(s.y1, s.y2) > bottom + 40) continue;
      ctx.lineWidth = (s.r + 7) * 2;
      capsule(ctx, s);
    }
    for (const s of c.statics) {
      if (Math.max(s.y1, s.y2) < top - 40 || Math.min(s.y1, s.y2) > bottom + 40) continue;
      const isPeg = s.x1 === s.x2 && s.y1 === s.y2;
      ctx.strokeStyle = isPeg ? theme.peg : theme.rail;
      capsule(ctx, s);
      if (isPeg) {
        const g = ctx.createRadialGradient(s.x1 - s.r * 0.35, s.y1 - s.r * 0.35, 1, s.x1, s.y1, s.r);
        g.addColorStop(0, 'rgba(255,255,255,.28)');
        g.addColorStop(0.6, 'rgba(255,255,255,.04)');
        g.addColorStop(1, 'rgba(0,0,0,.35)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s.x1, s.y1, s.r, 0, 6.283);
        ctx.fill();
      } else {
        ctx.save();
        ctx.strokeStyle = theme.edge;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1 - s.r + 1.5);
        ctx.lineTo(s.x2, s.y2 - s.r + 1.5);
        ctx.stroke();
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = '#000';
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1 + s.r - 1.5);
        ctx.lineTo(s.x2, s.y2 + s.r - 1.5);
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  function movers(ctx, top, bottom) {
    const list = [];
    for (const m of race.course.movers) {
      if (m.y < top - 320 || m.y > bottom + 320) continue;
      RACE.moverSegments(m, race.t, list, race.hold);
    }
    ctx.save();
    ctx.strokeStyle = theme.moverGlow;
    for (const s of list) { ctx.lineWidth = (s.r + 7) * 2; capsule(ctx, s); }
    for (const s of list) {
      ctx.strokeStyle = s.gate ? '#ffd36e' : theme.mover;
      ctx.lineWidth = s.r * 2;
      capsule(ctx, s);
    }
    ctx.fillStyle = theme.pin;
    for (const m of race.course.movers) {
      if (m.kind === 'gate' || m.y < top - 320 || m.y > bottom + 320) continue;
      ctx.beginPath(); ctx.arc(m.x, m.y, 6, 0, 6.283); ctx.fill();
    }
    ctx.restore();
  }

  function finish(ctx, top, bottom) {
    const y = race.course.finishY;
    if (y < top - 200 || y > bottom + 200) return;
    ctx.save();
    const sq = 26;
    for (let x = 0; x < W; x += sq) {
      for (let r = 0; r < 2; r++) {
        ctx.fillStyle = ((x / sq + r) | 0) % 2 ? '#e8e8f2' : '#12121c';
        ctx.fillRect(x, y + r * sq, sq, sq);
      }
    }
    ctx.fillStyle = 'rgba(125,255,155,.14)';
    ctx.fillRect(0, y - 6, W, 6);
    ctx.fillStyle = '#7dff9b';
    ctx.font = '700 34px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FINISH', W / 2, y - 26);
    ctx.restore();
  }

  function marbles(ctx, dt, paused) {
    const balls = race.balls;

    /* trails first, so marbles sit on top of them */
    ctx.save();
    ctx.lineCap = 'round';
    for (const b of balls) {
      if (b.done) continue;
      let tr = trails.get(b.id);
      if (!tr) { tr = []; trails.set(b.id, tr); }
      if (!paused) {
        tr.unshift(b.x, b.y);
        if (tr.length > TRAIL * 2) tr.length = TRAIL * 2;
      }
      const m = meta.get(b.id);
      if (tr.length < 4) continue;
      ctx.strokeStyle = (m && m.color) || '#6ee7ff';
      ctx.globalAlpha = 0.22;
      ctx.lineWidth = R * 1.1;
      ctx.beginPath();
      ctx.moveTo(tr[0], tr[1]);
      for (let i = 2; i < tr.length; i += 2) ctx.lineTo(tr[i], tr[i + 1]);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    const lead = race.leader;
    for (const b of balls) {
      const m = meta.get(b.id) || { color: '#6ee7ff' };
      if (b.done) {
        if (b.y > cam.y + cam.vh + 60) continue;
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = m.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, R, 0, 6.283);
        ctx.fill();
        ctx.restore();
        continue;
      }

      /* a spark when something hits hard - worked out from how much speed the
         marble lost, because the engine does not report collisions */
      if (!paused) {
        const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        const was = lastSpeed.get(b.id) || sp;
        if (was - sp > 320 && sparks.length < 260) {
          for (let i = 0; i < 3; i++) {
            sparks.push({
              x: b.x, y: b.y,
              vx: (Math.random() - 0.5) * 260, vy: (Math.random() - 0.5) * 260,
              life: 1, color: m.color
            });
          }
        }
        lastSpeed.set(b.id, sp);
      }

      /* how far it has rolled since last frame, from the engine's spin, so the
         swirl on the glass turns with the surface it is on and keeps turning
         in the air */
      if (!paused) {
        const a = (spinAngle.get(b.id) || 0) + (b.spin || 0) * dt;
        spinAngle.set(b.id, a);
      }
      const ang = spinAngle.get(b.id) || 0;

      ctx.save();
      /* contact shadow, offset down-right from the light */
      ctx.fillStyle = 'rgba(0,0,0,.42)';
      ctx.beginPath();
      ctx.ellipse(b.x + R * 0.35, b.y + R * 0.55, R * 0.95, R * 0.6, 0, 0, 6.283);
      ctx.fill();

      /* the glass */
      const g = ctx.createRadialGradient(b.x - R * 0.38, b.y - R * 0.42, R * 0.1, b.x, b.y, R);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.22, m.color);
      g.addColorStop(0.78, m.color);
      g.addColorStop(1, 'rgba(0,0,0,.6)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, R, 0, 6.283);
      ctx.fill();

      /* the swirl inside, clipped to the ball, turning with the roll */
      ctx.save();
      ctx.beginPath();
      ctx.arc(b.x, b.y, R * 0.92, 0, 6.283);
      ctx.clip();
      ctx.translate(b.x, b.y);
      ctx.rotate(ang);
      ctx.strokeStyle = 'rgba(255,255,255,.35)';
      ctx.lineWidth = R * 0.22;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.55, 0.2, 2.2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,.28)';
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.55, 3.3, 5.2);
      ctx.stroke();
      ctx.restore();

      /* rim light and a hard specular dot */
      ctx.strokeStyle = 'rgba(255,255,255,.16)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(b.x, b.y, R - 1, 3.6, 5.6);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.beginPath();
      ctx.arc(b.x - R * 0.42, b.y - R * 0.45, R * 0.16, 0, 6.283);
      ctx.fill();
      if (m.face && m.face !== 'none') drawFace(ctx, b.x, b.y, R, m.face);

      const racing = race.t > 0 && !race.hold;
      if (m.isMe || (racing && b === lead)) {
        const mine = m.isMe;
        ctx.strokeStyle = mine ? '#6ee7ff' : '#ffd36e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(b.x, b.y, R + 6, 0, 6.283);
        ctx.stroke();
        ctx.fillStyle = mine ? '#6ee7ff' : '#ffd36e';
        ctx.font = '700 20px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(mine ? (window.I18N ? I18N.t('field.you').toUpperCase() : 'YOU') : (m.short || ''), b.x, b.y - R - 14);
      }
      ctx.restore();
    }
  }

  /* Faces, drawn rather than typed: a marble is about ten pixels across on a
     laptop, where a glyph turns to mush but two dots and a curve still read as
     a face. Everything scales off the radius so it holds at any zoom. */
  const FACES = ['none', 'smile', 'grin', 'wink', 'cool', 'angry', 'dead'];

  function drawFace(ctx, x, y, r, face) {
    const ink = 'rgba(8,8,14,.92)';
    const ex = r * 0.36, ey = -r * 0.14;
    ctx.save();
    ctx.fillStyle = ink;
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1, r * 0.15);
    ctx.lineCap = 'round';

    const dot = (dx) => { ctx.beginPath(); ctx.arc(x + dx, y + ey, r * 0.14, 0, 6.283); ctx.fill(); };
    const mouth = (down, wide) => {
      ctx.beginPath();
      ctx.arc(x, y + r * (down ? 0.12 : 0.42), r * (wide ? 0.46 : 0.38),
        down ? 0.35 : 3.49, down ? 2.79 : 5.93);
      ctx.stroke();
    };

    if (face === 'smile') { dot(-ex); dot(ex); mouth(true, false); }
    else if (face === 'grin') {
      dot(-ex); dot(ex);
      ctx.beginPath();
      ctx.arc(x, y + r * 0.1, r * 0.48, 0.25, 2.89);
      ctx.fill();
    } else if (face === 'wink') {
      dot(ex);
      ctx.beginPath();
      ctx.moveTo(x - ex - r * 0.16, y + ey); ctx.lineTo(x - ex + r * 0.16, y + ey);
      ctx.stroke();
      mouth(true, false);
    } else if (face === 'cool') {
      ctx.fillRect(x - r * 0.58, y + ey - r * 0.16, r * 1.16, r * 0.3);
      mouth(true, false);
    } else if (face === 'angry') {
      ctx.beginPath();
      ctx.moveTo(x - ex - r * 0.2, y + ey - r * 0.26); ctx.lineTo(x - ex + r * 0.2, y + ey + r * 0.02);
      ctx.moveTo(x + ex + r * 0.2, y + ey - r * 0.26); ctx.lineTo(x + ex - r * 0.2, y + ey + r * 0.02);
      ctx.stroke();
      mouth(false, false);
    } else if (face === 'dead') {
      const k = r * 0.17;
      ctx.beginPath();
      ctx.moveTo(x - ex - k, y + ey - k); ctx.lineTo(x - ex + k, y + ey + k);
      ctx.moveTo(x - ex + k, y + ey - k); ctx.lineTo(x - ex - k, y + ey + k);
      ctx.moveTo(x + ex - k, y + ey - k); ctx.lineTo(x + ex + k, y + ey + k);
      ctx.moveTo(x + ex + k, y + ey - k); ctx.lineTo(x + ex - k, y + ey + k);
      ctx.moveTo(x - r * 0.3, y + r * 0.44); ctx.lineTo(x + r * 0.3, y + r * 0.44);
      ctx.stroke();
    }
    ctx.restore();
  }

  function paint(ctx, dt) {
    ctx.save();
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 600 * dt; s.life -= dt * 2.2;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      ctx.globalAlpha = s.life;
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
    }
    for (let i = cheers.length - 1; i >= 0; i--) {
      const c = cheers[i];
      c.y += c.vy * dt; c.life -= dt * 0.9;
      if (c.life <= 0) { cheers.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, c.life);
      ctx.font = '26px serif';
      ctx.textAlign = 'center';
      ctx.fillText('♥', c.x, c.y);
    }
    for (let i = confetti.length - 1; i >= 0; i--) {
      const c = confetti[i];
      c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 700 * dt; c.rot += c.vr * dt; c.life -= dt * 0.32;
      if (c.life <= 0) { confetti.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, c.life);
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.fillStyle = c.color;
      ctx.fillRect(-7, -4, 14, 8);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /* The strip beside the course: how far down the field is, and how far is left. */
  function margins(opts) {
    const ctx = cv.ctx;
    const ox = (cv.w - W * cam.scale) / 2;
    if (ox < 40 || !race) return;
    ctx.save();
    ctx.scale(cv.dpr, cv.dpr);
    const h = cv.h - 40;
    const x = ox / 2;
    ctx.strokeStyle = '#1c1c2a';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(x, 20); ctx.lineTo(x, 20 + h); ctx.stroke();

    const done = Math.min(1, Math.max(0, (race.leader ? race.leader.y : 0) / race.course.finishY));
    ctx.strokeStyle = '#6ee7ff';
    ctx.beginPath(); ctx.moveTo(x, 20); ctx.lineTo(x, 20 + h * done); ctx.stroke();

    ctx.fillStyle = '#55556d';
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(done * 100) + '%', x, 14);

    if (opts && opts.right !== undefined) {
      const label = (opts.right ? opts.right + '  ·  ' : '') + theme.name.toUpperCase() + '  ·  ' + race.course.sections.length + ' SECTIONS';
      ctx.save();
      ctx.translate(cv.w - ox / 2, cv.h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#3a3a52';
      ctx.font = '700 13px ui-monospace, monospace';
      ctx.fillText(label, 0, 4);
      ctx.restore();
    }
    ctx.restore();
  }

  window.RENDER = { init, resize, setRace, addPlayer, draw, cheer, celebrate, drawFace, FACES, THEMES, get camera() { return cam; }, get state() { return race; } };
})();
