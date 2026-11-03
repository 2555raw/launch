/* DOPA-PERP: dopamine perp simulator, pathway map, prediction-error lab,
   risk checklist. Plain JS, no dependencies. */
(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const root = getComputedStyle(document.documentElement);
  const tok = (n) => root.getPropertyValue(n).trim();
  const C = {
    accent: tok('--accent'), up: tok('--up'), down: tok('--down'),
    text: tok('--text'), muted: tok('--muted'), line: tok('--line'), panel: tok('--panel'), ink: tok('--ink'),
  };
  const MONO = '500 11px "Geist Mono", ui-monospace, Menlo, monospace';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function fit(cv) {
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }
  function rgba(hex, a) {
    const n = parseInt(hex.replace('#', ''), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  const hhmm = (min) => {
    const m = ((Math.floor(min) % 1440) + 1440) % 1440;
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  };

  /* ================= TERMINAL: dopamine perp simulator ================= */
  // amp: spike height · rise/decay: minutes · crash: share of the spike that comes back
  // as a dip below baseline · crashT: minutes from peak to the bottom · dT: tolerance change
  const MARKETS = [
    { id: 'scroll', name: 'Short-form scroll', note: 'Infinite feed, variable reward', lev: 50, amp: 62, rise: 3, decay: 14, crash: 0.42, crashT: 55, dT: 0.06 },
    { id: 'loot', name: 'Gambling / loot boxes', note: 'Near-misses keep you pulling', lev: 40, amp: 58, rise: 2, decay: 12, crash: 0.42, crashT: 60, dT: 0.055 },
    { id: 'sugar', name: 'Sugar + junk food', note: 'Fast spike, faster comedown', lev: 25, amp: 40, rise: 10, decay: 25, crash: 0.3, crashT: 70, dT: 0.035 },
    { id: 'notif', name: 'Check notifications', note: 'Tiny hit, tiny crash, all day', lev: 20, amp: 22, rise: 1, decay: 6, crash: 0.3, crashT: 25, dT: 0.02 },
    { id: 'coffee', name: 'Coffee', note: 'Mild lift, mild comedown', lev: 5, amp: 18, rise: 30, decay: 120, crash: 0.15, crashT: 120, dT: 0.006 },
    { id: 'sun', name: 'Morning sunlight', note: '10–30 min outside, early', lev: 2, amp: 12, rise: 30, decay: 180, crash: 0, crashT: 1, dT: -0.03 },
    { id: 'work', name: 'Workout', note: 'Effort first, payout after', lev: 3, amp: 30, rise: 45, decay: 150, crash: 0.06, crashT: 120, dT: -0.05 },
    { id: 'cold', name: 'Cold plunge', note: 'Slow lift that holds for hours', lev: 3, amp: 42, rise: 20, decay: 200, crash: 0, crashT: 1, dT: -0.02 },
    { id: 'deep', name: 'Deep work block', note: 'Progress pays at 1×', lev: 1, amp: 16, rise: 50, decay: 120, crash: 0, crashT: 1, dT: -0.025 },
  ];
  const HI = 20;               // leverage at or above this counts as a cheap hit
  const LIQ = 55;
  const MIN_PER_SEC = 6;       // sim minutes per real second at 1×
  const WINDOW = 360;          // chart window, sim minutes

  const sim = {};
  const peakT = (m) => m.rise * Math.log((m.rise + m.decay) / m.rise);
  const shape = (m, t) => (1 - Math.exp(-t / m.rise)) * Math.exp(-t / m.decay);
  function effect(p, now) {
    const m = p.m, t = now - p.t0;
    if (t <= 0) return { v: 0, a: 0, c: 0, t };
    const a = p.amp * shape(m, t) / p.norm;
    let c = 0;
    const x = (t - p.tp) / m.crashT;
    if (m.crash > 0 && x > 0) c = m.crash * p.amp * x * Math.exp(1 - x);
    return { v: a - c, a, c, t };
  }
  const baseline = () => 100 - 40 * sim.T;
  const noise = (t) => 1.1 * Math.sin(t / 7) + 0.7 * Math.sin(t / 3.1 + 1) + 0.4 * Math.sin(t / 1.3 + 2);
  function level(now) {
    let L = baseline() + noise(now);
    sim.pos.forEach((p) => { L += effect(p, now).v; });
    return L;
  }

  function logLine(text, cls) {
    sim.log.unshift({ t: sim.now, text, cls });
    sim.log.length = Math.min(sim.log.length, 80);
    sim.dirtyLog = true;
  }

  function openPos(id, quiet) {
    if (sim.liqUntil > sim.now) return;
    const m = MARKETS.find((x) => x.id === id);
    const dull = m.lev >= HI ? 1 - 0.55 * sim.T : 1 - 0.15 * sim.T;
    const tp = peakT(m);
    const p = { m, t0: sim.now, amp: m.amp * dull, tp, norm: shape(m, tp), key: Math.random() };
    sim.pos.push(p);
    sim.fills.push({ t: sim.now, hi: m.lev >= HI });
    const px = level(sim.now);
    sim.T = clamp(sim.T + m.dT, 0, 0.9);
    if (!quiet) {
      logLine(`LONG ${m.name} ${m.lev}× · filled at ${px.toFixed(1)}` + (m.dT > 0 ? ` · tolerance +${(m.dT * 100).toFixed(1)}` : ` · tolerance ${(m.dT * 100).toFixed(1)}`), m.lev >= HI ? 'down' : 'up');
    }
    sim.dirtyPos = true;
  }

  function liquidate() {
    sim.liqs++;
    sim.liqMarks.push(sim.now);
    sim.pos = [];
    sim.T = clamp(sim.T + 0.05, 0, 0.9);
    sim.liqUntil = sim.now + 60;
    logLine(`LIQUIDATED at ${level(sim.now).toFixed(1)} · all positions closed · 60 min cooldown`, 'down');
    sim.dirtyPos = true;
  }

  function step(dMin) {
    const sub = 0.5;
    let left = dMin;
    while (left > 0) {
      const d = Math.min(sub, left);
      left -= d;
      sim.now += d;
      sim.T = clamp(sim.T - 0.00025 * d, 0, 0.9);
      sim.pos = sim.pos.filter((p) => sim.now - p.t0 < p.tp + 6 * Math.max(p.m.decay, p.m.crash ? p.m.crashT : 0) + 30);
      const L = level(sim.now);
      if (sim.now - sim.lastSample >= 1) {
        sim.hist.push({ t: sim.now, L, B: baseline() });
        if (sim.hist.length > 2000) sim.hist.shift();
        sim.lastSample = sim.now;
      }
      if (L < LIQ && sim.liqUntil <= sim.now && sim.pos.length) liquidate();
    }
  }

  function sleep8() {
    const n = sim.pos.length;
    sim.pos = [];
    sim.T = sim.T * 0.35;
    logLine(`CLOSE ALL (${n}) · slept 8h · tolerance down to ${(sim.T * 100).toFixed(1)}`, 'up');
    sim.liqUntil = 0;
    step(480);
    sim.dirtyPos = true;
  }

  function resetSim() {
    Object.assign(sim, {
      now: 150, T: 0.05, pos: [], hist: [], fills: [], liqMarks: [], log: [], liqs: 0,
      lastSample: -1, liqUntil: 0, dirtyPos: true, dirtyLog: true,
    });
    // an example morning, so the chart opens with something on it
    const script = [[392, 'notif'], [398, 'scroll'], [430, 'coffee'], [452, 'sun'], [500, 'notif'], [545, 'work']];
    script.forEach(([at, id]) => { step(at - sim.now); openPos(id, true); });
    step(570 - sim.now);
    sim.log = [];
    logLine('Example morning loaded: notifications, a scroll, coffee, sunlight, a workout.', '');
  }

  /* ---- terminal UI ---- */
  const book = $('#book');
  book.innerHTML = MARKETS.map((m) => {
    const hi = m.lev >= HI;
    return `<li class="book__row${hi ? ' book__row--hi' : ''}" style="--w:${Math.max(4, (m.lev / 50) * 100)}%">
      <div class="book__name"><b>${m.name}</b><span>${m.note}</span></div>
      <span class="lev ${hi ? 'lev--hi' : 'lev--lo'}">${m.lev}×</span>
      <button type="button" class="long ${hi ? 'long--hi' : 'long--lo'}" data-id="${m.id}" aria-label="Open long: ${m.name}, ${m.lev}× leverage">LONG</button>
    </li>`;
  }).join('');
  book.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-id]');
    if (b) openPos(b.dataset.id);
  });
  $('#btnSleep').addEventListener('click', sleep8);
  $('#btnReset').addEventListener('click', () => { resetSim(); });

  let speed = 1, paused = false;
  document.querySelectorAll('.seg__b[data-speed]').forEach((b) => b.addEventListener('click', () => {
    speed = Number(b.dataset.speed);
    document.querySelectorAll('.seg__b[data-speed]').forEach((x) => x.classList.toggle('is-on', x === b));
  }));
  const btnPause = $('#btnPause');
  btnPause.addEventListener('click', () => {
    paused = !paused;
    btnPause.setAttribute('aria-pressed', String(paused));
    btnPause.textContent = paused ? 'Play' : 'Pause';
  });

  const tabs = [[$('#tabPos'), $('#panePos')], [$('#tabLog'), $('#paneLog')]];
  tabs.forEach(([t]) => t.addEventListener('click', () => {
    tabs.forEach(([x, pane]) => {
      const on = x === t;
      x.classList.toggle('is-on', on); x.setAttribute('aria-selected', String(on)); pane.hidden = !on;
    });
  }));

  const el = {
    mark: $('#sMark'), base: $('#sBase'), tol: $('#sTol'), avg: $('#sAvg'), clock: $('#sClock'),
    tickPx: $('#tickPx'), tickChg: $('#tickChg'), posBody: $('#posBody'), posCount: $('#posCount'),
    log: $('#log'), banner: $('#liqBanner'),
  };
  const sign = (v, d = 1) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d);

  function renderStats() {
    const L = level(sim.now), B = baseline();
    el.mark.textContent = L.toFixed(1);
    el.mark.className = 'stat__v ' + (L >= B ? 'up' : 'down');
    el.base.textContent = B.toFixed(1);
    el.tol.textContent = (sim.T * 100).toFixed(1) + '%';
    el.tol.className = 'stat__v ' + (sim.T > 0.25 ? 'down' : sim.T < 0.08 ? 'up' : '');
    const recent = sim.hist.filter((h) => h.t > sim.now - 720);
    const avg = recent.reduce((s, h) => s + h.L, 0) / Math.max(1, recent.length);
    el.avg.textContent = avg.toFixed(1);
    el.avg.className = 'stat__v ' + (avg >= 100 ? 'up' : 'down');
    el.clock.textContent = hhmm(sim.now) + (paused ? ' ❚❚' : '');
    el.tickPx.textContent = L.toFixed(1);
    const chg = L - 100;
    el.tickChg.textContent = sign(chg, 2) + '%';
    el.tickChg.className = chg >= 0 ? 'up' : 'down';
    const liq = sim.liqUntil > sim.now;
    el.banner.hidden = !liq;
    book.querySelectorAll('button').forEach((b) => { b.disabled = liq; });
  }

  function renderPositions() {
    el.posCount.textContent = sim.pos.length;
    if (!sim.pos.length) {
      el.posBody.innerHTML = '<tr class="empty"><td colspan="5">No open positions. Pick a market on the right to open a long.</td></tr>';
      return;
    }
    el.posBody.innerHTML = sim.pos.slice().reverse().map((p) => {
      const e = effect(p, sim.now);
      const phase = e.t < p.tp ? ['Spiking', 'tag--solid'] : e.c > e.a ? ['Crashing', 'tag--dash'] : ['Fading', 'tag--line'];
      return `<tr><td>${p.m.name}</td><td class="${p.m.lev >= HI ? 'down' : 'up'}">${p.m.lev}×</td><td>${hhmm(p.t0)}</td>
        <td class="${e.v >= 0 ? 'up' : 'down'}">${sign(e.v)}</td><td><span class="tag ${phase[1]}">${phase[0]}</span></td></tr>`;
    }).join('');
  }

  function renderLog() {
    el.log.innerHTML = sim.log.map((l) => `<li><time>${hhmm(l.t)}</time><span class="${l.cls}">${l.text}</span></li>`).join('');
    sim.dirtyLog = false;
  }

  const chartCv = $('#chart');
  function drawChart() {
    const { ctx, w, h } = fit(chartCv);
    ctx.clearRect(0, 0, w, h);
    const pl = 10, pr = 58, pt = 16, pb = 26;
    const cw = w - pl - pr, ch = h - pt - pb;
    const t1 = sim.now, t0 = t1 - WINDOW;
    const pts = sim.hist.filter((p) => p.t >= t0 - 1);
    const Y0 = 20;
    const Y1 = Math.max(200, Math.ceil((pts.reduce((m, p) => Math.max(m, p.L), 0) + 12) / 20) * 20);
    const X = (t) => pl + ((t - t0) / WINDOW) * cw;
    const Y = (v) => pt + (1 - (clamp(v, Y0, Y1) - Y0) / (Y1 - Y0)) * ch;

    // grid
    ctx.font = MONO; ctx.textBaseline = 'middle';
    for (let v = 40; v < Y1; v += (Y1 > 240 ? 40 : 20)) {
      ctx.strokeStyle = rgba(C.line, v === 100 ? 1 : 0.6);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pl, Math.round(Y(v)) + 0.5); ctx.lineTo(pl + cw, Math.round(Y(v)) + 0.5); ctx.stroke();
      ctx.fillStyle = C.muted; ctx.textAlign = 'left';
      ctx.fillText(String(v), pl + cw + 8, Y(v));
    }
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
    for (let hr = Math.ceil(t0 / 60) * 60; hr <= t1; hr += 60) {
      const x = Math.round(X(hr)) + 0.5;
      ctx.strokeStyle = rgba(C.line, 0.6);
      ctx.beginPath(); ctx.moveTo(x, pt); ctx.lineTo(x, pt + ch); ctx.stroke();
      if (x > pl + 18 && x < pl + cw - 18) { ctx.fillStyle = C.muted; ctx.fillText(hhmm(hr), x, h - 8); }
    }

    // liquidation line
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = rgba(C.text, 0.7);
    ctx.beginPath(); ctx.moveTo(pl, Y(LIQ)); ctx.lineTo(pl + cw, Y(LIQ)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = C.text; ctx.textAlign = 'left';
    ctx.fillText('LIQ', pl + 6, Y(LIQ) - 6);

    if (pts.length > 1) {
      // baseline
      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = rgba(C.text, 0.4); ctx.lineWidth = 1.2;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(X(p.t), Y(p.B)) : ctx.moveTo(X(p.t), Y(p.B))));
      ctx.stroke();
      ctx.setLineDash([]);

      // area + line
      const grad = ctx.createLinearGradient(0, pt, 0, pt + ch);
      grad.addColorStop(0, rgba(C.accent, 0.22)); grad.addColorStop(1, rgba(C.accent, 0));
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(X(p.t), Y(p.L)) : ctx.moveTo(X(p.t), Y(p.L))));
      ctx.lineTo(X(pts[pts.length - 1].t), pt + ch); ctx.lineTo(X(pts[0].t), pt + ch); ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(X(p.t), Y(p.L)) : ctx.moveTo(X(p.t), Y(p.L))));
      ctx.strokeStyle = C.accent; ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.stroke();
    }

    // fills
    sim.fills.filter((f) => f.t >= t0).forEach((f) => {
      const x = X(f.t), y = pt + ch - 2;
      ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x - 5, y); ctx.lineTo(x + 5, y); ctx.closePath();
      if (f.hi) { ctx.strokeStyle = C.text; ctx.lineWidth = 1.2; ctx.stroke(); } else { ctx.fillStyle = C.text; ctx.fill(); }
    });
    sim.liqMarks.filter((t) => t >= t0).forEach((t) => {
      const x = X(t), y = Y(LIQ);
      ctx.strokeStyle = C.text; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 5, y - 5); ctx.lineTo(x + 5, y + 5); ctx.moveTo(x + 5, y - 5); ctx.lineTo(x - 5, y + 5); ctx.stroke();
    });

    // live price tag
    const L = level(sim.now), up = L >= baseline();
    const ty = Y(L);
    ctx.fillStyle = up ? C.accent : C.down;
    ctx.beginPath(); ctx.arc(X(t1), ty, 3.5, 0, 6.283); ctx.fill();
    ctx.fillRect(pl + cw + 2, ty - 10, pr - 4, 20);
    ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = '600 11px "Geist Mono", ui-monospace, Menlo, monospace';
    ctx.fillText(L.toFixed(1), pl + cw + 7, ty + 0.5);
    ctx.textBaseline = 'alphabetic';
  }

  resetSim();
  let last = performance.now(), uiAcc = 0;
  function simLoop(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!paused) step(dt * MIN_PER_SEC * speed);
    drawChart();
    uiAcc += dt;
    if (uiAcc > 0.2 || sim.dirtyPos) {
      uiAcc = 0; sim.dirtyPos = false;
      renderStats(); renderPositions();
    }
    if (sim.dirtyLog) renderLog();
    requestAnimationFrame(simLoop);
  }
  requestAnimationFrame(simLoop);

  /* ================= SIGNAL LAB: reward prediction error ================= */
  const lab = { V: 0, trials: [], alpha: 0.2, auto: null };
  const pSlider = $('#pSlider');
  const pOut = $('#pOut');
  const rasterCv = $('#raster');

  function trial() {
    const p = Number(pSlider.value) / 100;
    const r = Math.random() < p ? 1 : 0;
    const cue = lab.V;            // an unpredicted cue carries the value it predicts
    const d = r - lab.V;          // at reward time: what you got minus what you expected
    lab.V += lab.alpha * d;
    lab.trials.push({ cue, d, r });
    if (lab.trials.length > 400) lab.trials.shift();
    renderLab();
  }
  function renderLab() {
    $('#rV').textContent = lab.V.toFixed(2);
    const lastT = lab.trials[lab.trials.length - 1];
    const rD = $('#rD');
    rD.textContent = lastT ? sign(lastT.d, 2) : '—';
    rD.className = 'mono ' + (lastT ? (lastT.d >= 0 ? 'up' : 'down') : '');
    $('#rN').textContent = lab.trials.length;
    drawRaster();
  }
  function drawRaster() {
    const { ctx, w, h } = fit(rasterCv);
    ctx.clearRect(0, 0, w, h);
    const pl = 16, pr = 16, pt = 22, pb = 30;
    const lanes = [
      { key: 'cue', label: 'AT THE CUE', sub: 'burst grows as the cue becomes a promise' },
      { key: 'd', label: 'AT THE REWARD', sub: 'burst = surprise · dip = disappointment' },
    ];
    const laneH = (h - pt - pb) / 2;
    const show = lab.trials.slice(-40);
    const slots = 40;
    const bw = (w - pl - pr) / slots;
    ctx.font = MONO;
    lanes.forEach((ln, li) => {
      const top = pt + li * laneH;
      const mid = top + laneH * 0.55;
      const amp = laneH * 0.36;
      ctx.fillStyle = C.text; ctx.textAlign = 'left';
      ctx.fillText(ln.label, pl, top + 2);
      ctx.fillStyle = C.muted;
      const lw = ctx.measureText(ln.label).width;
      if (w > 420) ctx.fillText(ln.sub, pl + lw + 12, top + 2);
      ctx.strokeStyle = C.line; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pl, Math.round(mid) + 0.5); ctx.lineTo(w - pr, Math.round(mid) + 0.5); ctx.stroke();
      show.forEach((t, i) => {
        const v = t[ln.key];
        const x = pl + i * bw + bw * 0.18;
        const bh = Math.abs(v) * amp;
        ctx.fillStyle = v >= 0 ? C.accent : C.down;
        ctx.globalAlpha = i === show.length - 1 ? 1 : 0.55 + 0.45 * (i / show.length);
        if (v >= 0) ctx.fillRect(x, mid - bh, bw * 0.64, Math.max(1, bh));
        else ctx.fillRect(x, mid, bw * 0.64, Math.max(1, bh));
        ctx.globalAlpha = 1;
        if (li === 1) {
          const cx = x + bw * 0.32, cy = top + laneH - 4;
          ctx.beginPath(); ctx.arc(cx, cy, Math.min(3, bw * 0.22), 0, 6.283);
          if (t.r) { ctx.fillStyle = C.text; ctx.fill(); } else { ctx.strokeStyle = C.muted; ctx.stroke(); }
        }
      });
    });
    ctx.fillStyle = C.muted; ctx.textAlign = 'right';
    ctx.fillText('● juice delivered   ○ omitted   · last 40 trials →', w - pr, h - 8);
    if (!show.length) {
      ctx.textAlign = 'center'; ctx.fillStyle = C.muted;
      ctx.fillText('Run a trial to start learning', w / 2, h / 2);
    }
  }
  pSlider.addEventListener('input', () => { pOut.textContent = pSlider.value + '%'; });
  $('#btnTrial').addEventListener('click', trial);
  const btnAuto = $('#btnAuto');
  btnAuto.addEventListener('click', () => {
    if (lab.auto) { clearInterval(lab.auto); lab.auto = null; }
    else lab.auto = setInterval(trial, 320);
    btnAuto.setAttribute('aria-pressed', String(!!lab.auto));
    btnAuto.textContent = lab.auto ? 'Stop' : 'Auto-run';
  });
  $('#btnLabReset').addEventListener('click', () => { lab.V = 0; lab.trials = []; renderLab(); });
  for (let i = 0; i < 14; i++) trial(); // example run at 75%

  /* ================= PATHWAYS: trace a route on the MRI ================= */
  const pwRows = document.querySelectorAll('#pwRows tr');
  const routes = document.querySelectorAll('.pw__map .route');
  function pickPath(id) {
    pwRows.forEach((r) => { const on = r.dataset.p === id; r.classList.toggle('is-on', on); r.setAttribute('aria-selected', String(on)); });
    routes.forEach((g) => g.classList.toggle('is-on', g.dataset.p === id));
  }
  pwRows.forEach((r) => {
    r.addEventListener('click', () => pickPath(r.dataset.p));
    r.addEventListener('mouseenter', () => pickPath(r.dataset.p));
    r.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickPath(r.dataset.p); } });
  });
  pickPath('meso');

  /* ================= RISK: checklist ================= */
  const RULES = [
    { id: 'sun', t: 'Get outside light in the first hour', d: 'About 10 minutes on a clear morning, 20–30 when it is overcast. It anchors the body clock that times your daily dopamine and cortisol rise.', ev: 'moderate' },
    { id: 'phone', t: 'No phone for the first 60 minutes', d: 'The first hit of the day sets the bar. Open at 50× and everything after it feels flat.', ev: 'mixed' },
    { id: 'move', t: 'Move hard for 20+ minutes', d: 'Exercise increases dopamine release and, over weeks, receptor availability. The effort is the entry price.', ev: 'moderate' },
    { id: 'notif', t: 'Batch notifications into 3 checks a day', d: 'Unpredictable pings are a variable reward schedule, the same one that makes slot machines hard to walk away from.', ev: 'strong' },
    { id: 'stack', t: 'Don’t stack hits', d: 'Music, caffeine and a phone during a workout or study block shrink the payout of the work itself. One source at a time.', ev: 'mixed' },
    { id: 'cold', t: 'End your shower cold for 1–3 minutes', d: 'An hour in 14 °C water raised plasma dopamine about 2.5× in one study. A short cold finish is milder, but it is still a slow, clean lift.', ev: 'mixed' },
    { id: 'deep', t: 'Do one 90-minute deep work block', d: 'Hard focus, no switching. The reward comes from progress, and progress trades at 1×.', ev: 'moderate' },
    { id: 'sleep', t: 'Sleep 7–9 hours', d: 'One night without sleep downregulates D2/D3 receptors in the striatum. Sleep is the cheapest way to pay down tolerance.', ev: 'strong' },
    { id: 'pause', t: 'Pick one 50× habit and pause it for 30 days', d: 'Anna Lembke’s clinical rule of thumb: about four weeks for the pleasure–pain balance to level out. Expect the first two weeks to feel worse.', ev: 'mixed' },
  ];
  const EV = { strong: ['tag--solid', 'strong evidence'], moderate: ['tag--line', 'moderate evidence'], mixed: ['tag--dash', 'early / mixed'] };
  const today = new Date().toISOString().slice(0, 10);
  const KEY = 'dopa-perp-rules-' + today;
  let done = {};
  try { done = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { done = {}; }

  const rulesEl = $('#rules');
  rulesEl.innerHTML = RULES.map((r) => `<li class="rule"><label for="r-${r.id}">
      <input type="checkbox" id="r-${r.id}" data-id="${r.id}" ${done[r.id] ? 'checked' : ''}>
      <span class="rule__body"><span class="rule__t">${r.t}</span><span class="rule__d">${r.d}</span></span>
      <span class="tag ${EV[r.ev][0]}">${EV[r.ev][1]}</span>
    </label></li>`).join('');
  function renderMargin() {
    const n = RULES.filter((r) => done[r.id]).length;
    const pct = Math.round((n / RULES.length) * 100);
    $('#mPct').textContent = pct + '%';
    $('#mBar').style.width = pct + '%';
    $('#mMsg').textContent =
      pct === 0 ? 'Fully exposed. Start with sunlight.' :
      pct < 34 ? 'Thin margin. Keep stacking slow wins.' :
      pct < 67 ? 'Healthy margin. Your baseline is recovering.' :
      pct < 100 ? 'Well hedged. Hard to liquidate today.' :
      'Max margin. Go to bed on time to lock it in.';
  }
  rulesEl.addEventListener('change', (e) => {
    const id = e.target.dataset.id;
    if (!id) return;
    done[id] = e.target.checked;
    try { localStorage.setItem(KEY, JSON.stringify(done)); } catch (err) { /* storage blocked: keep in memory */ }
    renderMargin();
  });
  renderMargin();

  /* ================= resize ================= */
  let rz;
  window.addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(drawRaster, 150);
  });
})();
