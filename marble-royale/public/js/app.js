/* MARBLERUSH - the app.

   Everything the browser does, wired together: the event stream from the
   server, the clock kept in step with it, the race engine run at sixty steps
   a second so the 3D picture matches the result the server already holds,
   and the screens - home, lobby, countdown, race, results - laid over the
   one canvas that is the world.

   States live in four stores (game, ui, wallet, chain) and never leak into
   each other. The winner on screen always comes from the server's result
   event, never from the replay running here. */

(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const { game, ui, wallet, chain } = window.STORES;
  const short = (a) => (a ? a.slice(0, 6) + '…' + a.slice(-4) : '');
  const same = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
  const usd = (v) => (v === null || v === undefined) ? '—' : '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pad = (n) => String(n).padStart(4, '0');
  const serverNow = () => Date.now() + game.get().offset;
  const fmt = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

  const SWATCH = ['#ff7a1a', '#6ee7ff', '#7dff9b', '#ffd36e', '#ff5ea8', '#b98bff', '#ff8a4c', '#4cd9ff', '#ff5252', '#ffffff'];

  /* ---- toast ------------------------------------------------------------- */

  let toastT = null;
  function toast(text, kind) {
    const el = $('#toast');
    el.textContent = text;
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => { el.hidden = true; }, 3600);
  }
  async function copy(text, what) {
    try { await navigator.clipboard.writeText(text); toast((what || 'Address') + ' copied', 'good'); } catch { toast('Could not copy', 'bad'); }
  }

  /* ---- screens ----------------------------------------------------------- */

  const SCREENS = ['home', 'lobby', 'count', 'race', 'results', 'launch', 'fair'];
  /* The race fills the window and the dock steps aside for it, so the HUD
     carries its own way back. The race itself keeps running behind the page. */
  function bindBack() {
    for (const id of ['#raceBack', '#countBack']) $(id).addEventListener('click', () => { setScreen('home'); SOUND.play('ui'); });
  }

  /* The token's contract address, pasted by the creator in the console. It
     shows on the page the moment it is saved, for everyone watching. */
  function paintToken(c) {
    const mint = (c && c.mint) || '';
    const bar = $('#tokenBar'), pill = $('#caBtn');
    bar.hidden = !mint; pill.hidden = !mint;
    if (!mint) return;
    const ex = (c.explorer || 'https://robinhoodchain.blockscout.com').replace(/\/$/, '');
    $('#caFull').textContent = mint;
    $('#caChain').textContent = (c.ticker ? c.ticker.replace(/^\$?/, '$') + ' · ' : '') + (c.chain || 'Robinhood Chain');
    $('#caExplorer').href = ex + '/token/' + mint;
    $('#caPons').href = 'https://ponsfamily.com/launchpad?search=' + mint;
    $('#caCopy').onclick = () => copy(mint, 'Contract address');
    const buy = $('#caBuy');
    if (c.links && c.links.buy) { buy.hidden = false; buy.href = c.links.buy; } else buy.hidden = true;
    $('#caVal').textContent = short(mint); pill.title = mint;
    pill.onclick = () => copy(mint, 'Contract address');
  }

  function setScreen(name) {
    if (!SCREENS.includes(name)) return;
    ui.set({ screen: name });
    for (const s of SCREENS) $('#s-' + s).hidden = s !== name;
    document.body.dataset.screen = name;
    if (name === 'home' || name === 'launch' || name === 'fair') { CAMERA.setMode('idle'); window.scrollTo(0, 0); }
    if (name === 'fair') paintFair();
    if (name === 'launch') paintLaunchFee();
    else if (name === 'race') CAMERA.setMode(ui.get().cameraMode === 'auto' ? 'auto' : ui.get().cameraMode);
    else CAMERA.setMode('auto');
    if (name !== 'home') window.scrollTo(0, 0);
    applyBackdrop();
    paintDock();
  }
  $$('[data-go]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); SOUND.wake(); setScreen(b.dataset.go); }));
  $$('[data-goto]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); setScreen('home'); requestAnimationFrame(() => $('#' + b.dataset.goto).scrollIntoView({ behavior: 'smooth', block: 'start' })); }));

  function openModal(id) { $('#' + id).hidden = false; ui.set({ modal: id }); }
  function closeModals() { $$('.modal').forEach((m) => { m.hidden = true; }); ui.set({ modal: null }); }
  $$('[data-close]').forEach((b) => b.addEventListener('click', closeModals));
  $$('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) closeModals(); }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModals(); });

  /* ---- the race in the world --------------------------------------------- */

  let current = null;        // engine state being drawn (preview, live or finished)
  let mode = 'idle';         // idle | preview | race | done
  let raceStartAt = 0;       // server time
  let lastTs = 0, acc = 0;
  let stirred = 0, settled = false, settleCheck = 0;
  const stir = () => { stirred = performance.now(); settled = false; };

  function playersOf(round) {
    const me = wallet.get().address;
    return round.players.map((p) => ({ address: p.address, color: p.color, face: p.face, material: p.material, name: p.name, you: same(p.address, me) }));
  }

  function startPreview(round) {
    const seed = parseInt((round.commit || '0').slice(0, 8), 16) >>> 0;
    current = RACE.createRace(seed, round.players.map((p) => ({ id: p.address })), { hold: true, mode: round.mode });
    mode = 'preview';
    if (SCENE.ready) SCENE.setRace(current, playersOf(round), wallet.get().address);
    stir();
  }
  function syncPreview(round) {
    if (!current || mode !== 'preview') return startPreview(round);
    for (const p of round.players) {
      if (!current.balls.some((b) => b.id === p.address)) {
        RACE.addBall(current, p.address);
        if (SCENE.ready) SCENE.addPlayer({ address: p.address, color: p.color, face: p.face, material: p.material, name: p.name });
        stir();
      }
    }
  }
  function startLive(d) {
    const round = game.get().race;
    const players = (d.players || round.players).map((p) => ({ address: p.address, color: p.color, face: p.face, material: p.material, name: p.name }));
    current = RACE.createRace(d.seed, players.map((p) => ({ id: p.address })), { mode: d.mode || round.mode });
    mode = 'race';
    raceStartAt = d.startAt;
    if (SCENE.ready) SCENE.setRace(current, players, wallet.get().address);
  }
  function replayFinished(round) {
    if (round.seed === null || round.seed === undefined || !round.players.length) return false;
    const players = playersOf(round);
    current = RACE.createRace(round.seed, players.map((p) => ({ id: p.address })), { mode: round.mode });
    let guard = 0;
    while (!current.over && guard++ < RACE.MAX_SECONDS * 60 + 10) RACE.step(current);
    for (let i = 0; i < 60; i++) RACE.step(current);
    mode = 'done';
    if (SCENE.ready) SCENE.setRace(current, players, wallet.get().address);
    return true;
  }

  function previewBusy(ts) {
    if (!settled && ts - stirred < 4000) return true;
    if (ts - settleCheck > 400) {
      settleCheck = ts;
      let fastest = 0;
      for (const b of current.balls) { const sp = b.vx * b.vx + b.vy * b.vy; if (sp > fastest) fastest = sp; }
      settled = fastest < 400;
    }
    return !settled;
  }

  let countdownShown = -1;
  function frame(ts) {
    requestAnimationFrame(frame);
    const real = lastTs ? (ts - lastTs) / 1000 : 0.016;
    const dt = Math.min(0.05, real);
    lastTs = ts;
    const r = game.get().race;

    if (mode === 'race' && current) {
      const due = (serverNow() - raceStartAt) / 1000;
      let guard = 0;
      while (current.t < due && !current.over && guard++ < 200) RACE.step(current);
    } else if (mode === 'done' && current) {
      acc += dt; let guard = 0;
      while (acc >= RACE.DT && guard++ < 4) { RACE.step(current); acc -= RACE.DT; }
    } else if (mode === 'preview' && current && previewBusy(ts)) {
      acc += dt; let guard = 0;
      while (acc >= RACE.DT && guard++ < 6) { RACE.step(current); acc -= RACE.DT; }
    }

    /* countdown: the last three seconds before the gate */
    let cd = null;
    if (r && (r.phase === 'locked' || r.phase === 'lobby')) {
      const left = (r.raceAt - serverNow()) / 1000;
      if (left <= 3.2 && left > -0.3) cd = Math.ceil(left);
    }
    countdown(cd);

    if (SCENE.ready) { SCENE.sync(dt, { countdown: cd, camDt: Math.min(0.5, real) }); SCENE.render(); }
    paintClock();
    placeStage();
    if (ui.get().screen === 'race') paintHud();
  }

  function countdown(cd) {
    const el = $('#s-count');
    if (cd === null || cd === undefined) { if (!el.hidden && ui.get().screen !== 'count') el.hidden = true; return; }
    if (cd !== countdownShown) {
      countdownShown = cd;
      const num = $('#countNum');
      el.hidden = false;
      if (cd <= 0) { num.textContent = 'GO!'; num.classList.add('go'); $('#countSub').textContent = 'THE GATE IS OPEN'; }
      else { num.textContent = String(cd); num.classList.remove('go'); $('#countSub').textContent = 'GATE OPENS'; SOUND.play('count'); }
      num.style.animation = 'none'; void num.offsetWidth; num.style.animation = '';
      /* the switch to the race screen hides every other screen, the count
         included, so it is shown again after */
      if (ui.get().screen === 'lobby' || ui.get().screen === 'home') { setScreen('race'); el.hidden = false; }
      if (cd > 0) CAMERA.shake(0.02);
    }
  }

  /* ---- server stream ----------------------------------------------------- */

  function connectStream() {
    const es = new EventSource('/api/stream');
    es.addEventListener('state', (e) => onState(JSON.parse(e.data)));
    es.addEventListener('phase', (e) => onPhase(JSON.parse(e.data)));
    es.addEventListener('join', (e) => onJoin(JSON.parse(e.data)));
    es.addEventListener('start', (e) => onStart(JSON.parse(e.data)));
    es.addEventListener('result', (e) => onResult(JSON.parse(e.data)));
    es.addEventListener('pot', (e) => onPot(JSON.parse(e.data)));
    es.addEventListener('poll', (e) => onPoll(JSON.parse(e.data)));
    es.addEventListener('cap', (e) => onCap(JSON.parse(e.data)));
    es.addEventListener('paid', (e) => onPaid(JSON.parse(e.data)));
    es.addEventListener('chat', (e) => feed(JSON.parse(e.data)));
    es.addEventListener('skin', (e) => onSkin(JSON.parse(e.data)));
    es.addEventListener('launch', (e) => onLaunch(JSON.parse(e.data)));
    es.addEventListener('config', (e) => { const c = JSON.parse(e.data); game.set({ config: c }); applyConfig(c); });
    es.addEventListener('cheer', (e) => { const d = JSON.parse(e.data); if (SCENE.ready) SCENE.cheer(d.target); });
    es.addEventListener('tick', (e) => {
      const d = JSON.parse(e.data);
      game.set({ offset: d.now - Date.now(), watching: d.watching || 0 });
      const r = game.get().race;
      if (r && d.id === r.id && d.count > r.players.length) refreshState();
    });
  }
  async function refreshState() {
    const s = await fetch('/api/state').then((x) => x.json()).catch(() => null);
    if (s) onState(s);
  }

  function onState(s) {
    game.set({ config: s.config, offset: s.now - Date.now(), watching: s.watching, recent: s.recent, top: s.top, schedule: s.schedule || [], rewards: s.rewards || [], paidTotal: s.paidTotal || 0, launches: s.launches || [] });
    paintCommunity();
    applyConfig(s.config);
    paintModes();
    $('#feed').innerHTML = '';
    for (const m of s.chat || []) feed(m, true);
    onPhase(s.round);
    paintRaces();
    paintRecent();
    paintRewards();
  }

  function applyConfig(c) {
    if (!c) return;
    $('#loEntry').textContent = c.entry || 'FREE';
    paintToken(c);
    if (c.links && c.links.x) { $('#xLink').hidden = false; $('#xLink').href = c.links.x; $('#dockX').href = c.links.x; }
    document.title = (c.coin || 'MARBLERUSH') + ' · race your marble';
    chain.set({ network: c.chain || 'Robinhood Chain', mode: 'demo' });
  }

  function onPhase(round) {
    if (!round) return;
    const prev = game.get().race;
    const fresh = !prev || prev.id !== round.id;
    game.set({ race: round });
    document.body.dataset.phase = round.phase;
    const me = wallet.get().address;
    const joined = round.players.some((p) => same(p.address, me));
    ui.set({ joined });

    if (fresh) {
      countdownShown = -1; $('#countNum').classList.remove('go');
      /* a new round means a new schedule: the track it races on is now known */
      if (prev) fetch('/api/schedule').then((x) => x.json()).then((sc) => { game.set({ schedule: sc.schedule || [] }); paintRaces(); }).catch(() => {});
    }

    if (round.phase === 'lobby' || (round.phase === 'locked' && mode !== 'race')) {
      if (fresh || mode === 'idle' || mode === 'done') startPreview(round); else syncPreview(round);
      if (fresh && ui.get().screen === 'results') { /* stay on results until they choose */ }
    } else if (round.phase === 'racing') {
      if (mode !== 'race' && round.seed !== null) startLive({ seed: round.seed, startAt: round.raceAt, players: round.players });
      if (ui.get().screen !== 'race') setScreen('race');
    } else if (round.phase === 'result') {
      /* a race nobody joined has nothing to replay; the world still needs a
         track in it, so the round's own course stands there, gate shut */
      if ((fresh || mode === 'idle' || mode === 'preview') && !replayFinished(round)) startPreview(round);
      if (round.winner && !['results', 'home', 'launch', 'fair'].includes(ui.get().screen)) showResults({ winner: round.winner, order: round.order, pot: round.pot, number: round.number, mega: round.mega, mode: round.mode });
    }
    paintStatic();
    paintLobby();
    paintRaces();
    paintMode();
    paintPoll();
    paintModes();
  }

  function onJoin(d) {
    const r = game.get().race;
    if (!r || d.roundId !== r.id) return;
    if (!r.players.some((p) => p.address === d.player.address)) r.players.push(d.player);
    game.set({ race: r });
    if (mode === 'preview') syncPreview(r);
    const me = wallet.get().address;
    if (same(d.player.address, me)) { ui.set({ joined: true }); SOUND.play('join'); }
    if (d.max) r.max = d.max;
    feed({ sys: true, text: (d.player.name || short(d.player.address)) + ' joined · ' + d.count + '/' + r.max });
    paintLobby();
    paintStatic();
  }

  /* The grid grew: the race was most of the way to thirty, so it takes fifty. */
  function onCap(d) {
    const r = game.get().race;
    if (!r || d.roundId !== r.id) return;
    r.max = d.max;
    game.set({ race: r });
    feed({ sys: true, text: 'the grid is filling up · it grows to ' + d.max + ' places' });
    if (ui.get().screen === 'lobby') toast('The grid grew to ' + d.max + ' places for this race');
    paintStatic();
    paintRaces();
  }

  function onPoll(d) {
    const r = game.get().race;
    if (!r || d.roundId !== r.id) return;
    const had = r.poll && r.poll.winner;
    r.poll = d;
    game.set({ race: r });
    paintPoll();
    if (d.winner && !had) {
      const m = modeInfo(d.winner);
      feed({ sys: true, text: 'next track by vote: ' + m.name });
      fetch('/api/schedule').then((x) => x.json()).then((sc) => { game.set({ schedule: sc.schedule || [] }); paintRaces(); paintModes(); }).catch(() => {});
    }
  }

  function onStart(d) {
    const r = game.get().race;
    if (!r) return;
    r.phase = 'racing';
    game.set({ race: r });
    document.body.dataset.phase = 'racing';
    startLive(d);
    paintStatic();
    setScreen('race');
    SOUND.play('go');
    CAMERA.shake(0.14);
    $('#countNum').textContent = 'GO!'; $('#countNum').classList.add('go'); $('#s-count').hidden = false;
    setTimeout(() => { $('#s-count').hidden = true; }, 1300);
    if (SCENE.ready && current) SCENE.burst(CAMERA.world(500, 540, 0.3), 80, '#ffb36b', 2);
  }

  function onResult(d) {
    const r = game.get().race;
    if (r) { r.phase = 'result'; r.winner = d.winner; r.order = d.order; if (d.poll) r.poll = d.poll; game.set({ race: r }); }
    ui.set({ voted: null });
    document.body.dataset.phase = 'result';
    game.set({ result: d });
    if (d.winner) { const wp = r && r.players.find((x) => same(x.address, d.winner)); feed({ sys: true, text: 'WINNER · ' + (wp && wp.name ? wp.name + ' · ' : '') + d.winner + (d.pot !== null && d.pot !== undefined ? ' · ' + usd(d.pot) : '') }); }
    paintStatic();
    if (r) drainPot(r);
    setTimeout(() => { showResults(d); paintPoll(); }, 1400);
    SOUND.play('finish');
    if (SCENE.ready) SCENE.celebrate(d.winner);
    fetch('/api/history?n=12').then((x) => x.json()).then((h) => { game.set({ recent: h.rounds, top: h.top, rewards: h.rewards || [], paidTotal: h.paidTotal || 0 }); paintRecent(); paintRewards(); if (ui.get().screen === 'fair') paintFair(); }).catch(() => {});
  }

  function onPot(d) {
    const r = game.get().race;
    if (r && d.roundId === r.id) { r.pot = d.pot; r.potFull = d.potFull || r.potFull; r.potDemo = !!d.demo; game.set({ race: r }); paintStatic(); }
  }

  /* The jars: one on the home strip, one in the lobby head. The level is the
     pot against what a full race collects; it locks when the gate opens and
     empties once the winner is paid, then the next race fills it again. */
  let drain = null;
  function paintPot() {
    const r = game.get().race;
    if (!r) return;
    const full = r.potFull || (r.mega ? 25 : 7.5);
    let pot = r.pot || 0;
    let state = 'filling';
    if (r.phase === 'racing' || r.phase === 'locked') state = 'locked';
    if (r.phase === 'result') { state = 'paid'; if (drain && drain.id === r.id) pot = drain.pot; }
    const level = Math.max(0, Math.min(1, pot / full));
    for (const id of ['#jarHome', '#jarLobby']) {
      const jar = $(id);
      if (!jar) continue;
      jar.dataset.state = state;
      jar.querySelector('.jar__liquid').setAttribute('y', (134 - 100 * level).toFixed(1));
      jar.querySelector('.jar__liquid').setAttribute('height', (100 * level).toFixed(1));
      jar.querySelector('.jar__top').setAttribute('cy', (134 - 100 * level).toFixed(1));
    }
    const text = state === 'paid' && !r.winner ? 'no race · nobody joined' : { filling: 'filling', locked: 'locked for the race', paid: 'paid to the winner' }[state];
    $('#lbPotState').textContent = text; $('#loPotState').textContent = text;
  }
  function drainPot(r) {
    const from = r.pot || 0, t0 = performance.now();
    drain = { id: r.id, pot: from };
    const tick = (ts) => {
      const k = Math.min(1, (ts - t0) / 1400);
      drain.pot = from * (1 - k * k);
      paintPot();
      if (k < 1) requestAnimationFrame(tick);
    };
    setTimeout(() => requestAnimationFrame(tick), 2600);
  }

  /* ---- painting ---------------------------------------------------------- */

  function paintStatic() {
    const r = game.get().race;
    if (!r) return;
    const no = '#' + pad(r.number || 0);
    const phase = { lobby: 'LOBBY', locked: 'LOCKED', racing: 'LIVE', result: 'RESULT' }[r.phase] || r.phase.toUpperCase();
    $('#dockPhase').textContent = phase; $('#mPhase').textContent = phase; $('#mNo').textContent = no;
    $('#lbNo').textContent = no; $('#loNo').textContent = no; $('#hudNo').textContent = 'RACE ' + no;
    /* no reading yet is a pot of nothing, not a blank */
    const potText = usd(r.pot === null || r.pot === undefined ? 0 : r.pot);
    $('#lbPot').textContent = potText; $('#loPot').textContent = potText;
    $('#lbDemo').hidden = !r.potDemo; $('#loDemo').hidden = !r.potDemo;
    paintPot();
    $('#lbPlayers').textContent = r.players.length + ' / ' + r.max; $('#loPlayers').textContent = r.players.length + ' / ' + r.max;
    $('#loMega').hidden = !r.mega;
    $('#commitLine').textContent = r.commit ? 'seed commit · ' + r.commit : '';
    $('#hudTrack').textContent = current ? (modeInfo(current.course.mode).name.toUpperCase() + ' · ' + RENDER.THEMES[(current.course.theme || 0) % RENDER.THEMES.length].name.toUpperCase() + ' · ' + current.course.sections.length + ' SECTIONS') : '';
    $('#dockPot').textContent = usd(r.pot === null || r.pot === undefined ? 0 : r.pot);
    $('#dockNo').textContent = no;
  }

  /* ---- modes ------------------------------------------------------------- */

  const MODE_SEEDS = { classic: 4101, plinko: 9002, boost: 7303, spin: 2404, funnel: 6605, drop: 1106, ice: 3307, maze: 8808 };
  function modeInfo(id) {
    const list = (game.get().config && game.get().config.modes) || [];
    return list.find((m) => m.id === id) || (RACE.MODES[id] ? Object.assign({ id }, RACE.MODES[id]) : { id: 'classic', name: 'Classic', blurb: '', gravity: 1, bounce: 1 });
  }
  const modeSections = (id) => { const m = RACE.MODES[id] || RACE.MODES.classic; return m.count[0] + '–' + m.count[1]; };
  /* A mode's picture is a photograph of the game: the scene builds a course
     in that mode and renders it with the real materials and lights. Until the
     scene exists the card carries a flat map drawn from the same geometry,
     and the photographs replace the maps one at a time, so the page never
     stalls on them. */
  const picCache = new Map();
  function modePic(id, seed, w, h) {
    const el = document.createElement('div'); el.className = 'mode__img';
    el.dataset.mode = id; el.dataset.seed = String(seed === undefined ? MODE_SEEDS[id] || 1 : seed);
    el.dataset.w = String(w || 320); el.dataset.h = String(h || 180);
    fillPic(el);
    queueUpgrade();
    return el;
  }
  function fillPic(el) {
    const id = el.dataset.mode, seed = Number(el.dataset.seed) >>> 0, w = Number(el.dataset.w), h = Number(el.dataset.h);
    const key = id + ':' + seed + ':' + w + 'x' + h;
    let cv = picCache.get(key);
    if (!cv && SCENE.ready && SCENE.snapshot) {
      try { cv = SCENE.snapshot(id, seed, Math.max(w, 480), Math.max(h, 270)); } catch (err) { cv = null; }
      if (cv) picCache.set(key, cv);
    }
    if (cv) delete el.dataset.flat;
    else { cv = RENDER.thumbnail(id, seed, w, h); el.dataset.flat = '1'; }
    el.innerHTML = '';
    el.appendChild(cloneCanvas(cv));
  }
  let upgrading = false;
  function queueUpgrade() {
    if (upgrading) return;
    upgrading = true;
    /* One picture per idle moment, and none at all while the race or the
       countdown is on screen: a render there would steal the frame. */
    const later = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 120));
    const tick = () => {
      const screen = ui.get().screen;
      if (screen === 'race' || screen === 'count') { setTimeout(tick, 1500); return; }
      const next = document.querySelector('.mode__img[data-flat]');
      if (!next || !SCENE.ready || !SCENE.snapshot) { upgrading = false; return; }
      fillPic(next);
      later(tick);
    };
    later(tick);
  }
  function cloneCanvas(cv) {
    const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; c.style.width = cv.style.width; c.style.height = cv.style.height;
    c.getContext('2d').drawImage(cv, 0, 0);
    return c;
  }
  const xf = (v) => (Math.round(v * 100) / 100).toFixed(v === Math.round(v) ? 1 : 2) + '×';

  /* The lobby's track card: the mode this race runs in, with a picture of a
     course drawn in it. The picture is the lobby's own preview course, so it
     is a true sample of the mode and not the exact race, whose seed does not
     exist until the queue closes. */
  let modeShown = '';
  function paintMode() {
    const r = game.get().race;
    if (!r) return;
    const m = modeInfo(r.mode || 'classic');
    const key = r.id + ':' + m.id;
    if (modeShown !== key) {
      modeShown = key;
      const host = $('#loModeImg');
      host.innerHTML = '';
      host.appendChild(modePic(m.id, parseInt((r.commit || '0').slice(0, 8), 16) >>> 0, 320, 180));
    }
    $('#loModeName').textContent = m.name;
    $('#loModeBlurb').textContent = m.blurb || '';
    $('#loModeBy').textContent = r.modeBy === 'vote' ? 'chosen by vote on the last results screen' : 'the opening track · the next one is voted';
    $('#loModeG').textContent = xf(m.gravity || 1); $('#loModeB').textContent = xf(m.bounce || 1); $('#loModeS').textContent = modeSections(m.id);
  }

  /* All eight, on the home page, each explained and pictured. */
  let modesBuilt = false;
  function paintModes() {
    const c = game.get().config;
    const host = $('#modesGrid');
    if (!c || !c.modes) return;
    const r = game.get().race;
    const next = r && r.poll && r.poll.winner;
    if (!modesBuilt) {
      modesBuilt = true;
      host.innerHTML = '';
      for (const m of c.modes) {
        const card = document.createElement('article');
        card.className = 'modecard glass'; card.dataset.mode = m.id;
        card.appendChild(modePic(m.id, undefined, 320, 180));
        const body = document.createElement('div'); body.className = 'modecard__body';
        body.innerHTML = '<div class="modecard__top"><b></b><span class="pill pill--phase modecard__tag" hidden></span></div><p></p><div class="modecard__phys mono"><span><em>GRAVITY</em><b></b></span><span><em>BOUNCE</em><b></b></span><span><em>SECTIONS</em><b></b></span></div>';
        body.querySelector('.modecard__top b').textContent = m.name;
        body.querySelector('p').textContent = m.blurb;
        const ph = body.querySelectorAll('.modecard__phys b');
        ph[0].textContent = xf(m.gravity); ph[1].textContent = xf(m.bounce); ph[2].textContent = modeSections(m.id);
        card.appendChild(body);
        host.appendChild(card);
      }
    }
    for (const card of host.children) {
      const tag = card.querySelector('.modecard__tag');
      const id = card.dataset.mode;
      const now = r && r.mode === id;
      tag.hidden = !(now || next === id);
      tag.textContent = now ? (r.phase === 'result' ? 'JUST RACED' : 'RACING NOW') : 'NEXT · BY VOTE';
      card.classList.toggle('is-now', !!now);
      card.classList.toggle('is-next', next === id && !now);
    }
  }

  /* ---- the poll ---------------------------------------------------------- */

  let pollBuilt = '';
  function paintPoll() {
    const r = game.get().race;
    const box = $('#poll');
    const p = r && r.poll;
    if (!p || r.phase !== 'result') { box.hidden = true; pollBuilt = ''; return; }
    box.hidden = false;
    const opts = $('#pollOpts');
    if (pollBuilt !== p.roundId) {
      pollBuilt = p.roundId;
      opts.innerHTML = '';
      for (const id of [p.a, p.b]) {
        const m = modeInfo(id);
        const b = document.createElement('button');
        b.className = 'pollopt'; b.dataset.mode = id; b.type = 'button';
        b.appendChild(modePic(id, undefined, 320, 180));
        const meta = document.createElement('div'); meta.className = 'pollopt__meta';
        meta.innerHTML = '<b></b><p></p><div class="pollopt__bar"><i></i></div><span class="mono"><em class="n">0</em> votes · <em class="pct">0%</em></span>';
        meta.querySelector('b').textContent = m.name;
        meta.querySelector('p').textContent = m.blurb;
        b.appendChild(meta);
        b.addEventListener('click', () => vote(id));
        opts.appendChild(b);
      }
    }
    const total = p.total || 0;
    const mine = ui.get().voted;
    for (const b of opts.children) {
      const id = b.dataset.mode, n = p.votes[id] || 0;
      const pct = total ? Math.round((n / total) * 100) : 0;
      b.querySelector('.n').textContent = n;
      b.querySelector('.pct').textContent = pct + '%';
      b.querySelector('.pollopt__bar i').style.width = pct + '%';
      b.classList.toggle('is-mine', mine === id);
      b.classList.toggle('is-winner', p.winner === id);
      b.classList.toggle('is-lost', !!p.winner && p.winner !== id);
      b.disabled = !!p.winner;
    }
    const done = $('#pollDone');
    done.hidden = !p.winner;
    if (p.winner) {
      const m = modeInfo(p.winner);
      $('#pollWinner').textContent = m.name;
      const va = p.votes[p.a] || 0, vb = p.votes[p.b] || 0;
      $('#pollWhy').textContent = va === vb ? 'a tie, settled by a coin toss · the lobby opens in a moment' : 'won the vote ' + Math.max(va, vb) + ' to ' + Math.min(va, vb) + ' · the lobby opens in a moment';
    } else {
      $('#pollClock').textContent = 'closes in ' + fmt(p.closesAt - serverNow());
      $('#pollClock').textContent = 'closed';
    }
  }

  async function vote(choice) {
    const w = wallet.get();
    if (!w.token) return openWallet();
    const r = game.get().race;
    if (!r || !r.poll || r.poll.winner) return;
    SOUND.wake(); SOUND.play('ui');
    const res = await fetch('/api/vote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: w.token, choice }) }).then((x) => x.json()).catch(() => ({ error: 'network' }));
    if (res.error) { toast(res.error, 'bad'); if (String(res.error).includes('sign in')) signOut(); return; }
    ui.set({ voted: choice });
    if (res.poll) { r.poll = res.poll; game.set({ race: r }); }
    paintPoll();
  }

  function paintClock() {
    const r = game.get().race;
    if (!r) return;
    const now = serverNow();
    let ms, label;
    if (r.phase === 'lobby' || r.phase === 'locked') { ms = r.raceAt - now; label = r.phase === 'lobby' ? 'STARTING IN' : 'GATE OPENS IN'; }
    else if (r.phase === 'racing') { ms = now - r.raceAt; label = 'RACING'; }
    else { ms = r.endAt - now; label = 'NEXT RACE IN'; }
    const t = fmt(ms);
    $('#lbClock').textContent = t; $('#loClock').textContent = t;
    $('#lbClockLabel').textContent = label; $('#loClockLabel').textContent = label;
    $('#dockClock').textContent = t; $('#dockClockLabel').textContent = label;
    $('#dockRace').textContent = { lobby: 'OPEN', locked: 'LOCKED', racing: 'LIVE', result: 'RESULT' }[r.phase] || r.phase.toUpperCase();
    if (r.phase === 'result' && r.poll && !r.poll.winner) $('#pollClock').textContent = 'closes in ' + fmt(r.poll.closesAt - now);
    if (r.phase === 'racing' && current) $('#hudTime').textContent = current.t.toFixed(1) + 's';
    const cards = $$('.race[data-start]');
    for (const c of cards) { const el = c.querySelector('.race__in'); if (el) el.textContent = fmt(Number(c.dataset.start) - now); }
  }

  function paintRaces() {
    const list = game.get().schedule || [];
    const host = $('#raceCards');
    host.innerHTML = '';
    const r = game.get().race;
    list.forEach((s, i) => {
      const card = document.createElement('article');
      card.className = 'race glass' + (s.open ? ' race--open' : '') + (s.mega ? ' race--mega' : '');
      card.dataset.start = s.raceAt;
      /* Only the open race has a pot to show. A queued race's pot is the
         fees that come in while its queue is open, so it cannot be known
         yet; a mega race is the one fixed figure. */
      const pot = i === 0 && r ? usd(r.pot) : (s.mega ? '$25.00' : 'Fills with fees');
      const track = s.mode ? modeInfo(s.mode).name : 'Decided by vote';
      card.innerHTML =
        '<div class="race__no"><b>RACE #' + pad(s.number) + '</b>' + (s.mega ? '<span class="pill pill--mega">MEGA</span>' : (s.open ? '<span class="pill pill--phase">OPEN</span>' : '<span class="pill">QUEUED</span>')) + '</div>' +
        '<div class="race__track' + (s.mode ? '' : ' is-tbd') + '"><em>TRACK</em><b></b></div>' +
        '<div class="race__stats"><div><em>PLAYERS</em><b>' + s.count + ' / ' + s.max + '</b></div><div><em>ENTRY</em><b>FREE</b></div><div><em>PRIZE</em><b class="' + (i === 0 || s.mega ? 'gold' : 'race__tbd') + '">' + pot + '</b></div><div><em>STARTING IN</em><b class="race__in">' + fmt(s.raceAt - serverNow()) + '</b></div></div>' +
        '<div class="race__bar"><i style="width:' + Math.min(100, (s.count / s.max) * 100) + '%"></i></div>';
      card.querySelector('.race__track b').textContent = track;
      if (s.mode) card.querySelector('.race__track').prepend(modePic(s.mode, undefined, 96, 54));
      const btn = document.createElement('button');
      btn.className = 'btn ' + (s.open ? 'btn--accent' : 'btn--glass');
      btn.disabled = !s.open;
      btn.textContent = s.open ? 'Join race' : 'Opens after the current race';
      btn.addEventListener('click', () => { SOUND.wake(); setScreen('lobby'); if (s.open) join(); });
      card.appendChild(btn);
      host.appendChild(card);
    });
  }

  /* A marble for the page: a real render when the studio is open, the flat
     swatch until then. Either way a canvas of the size asked for. */
  function marbleCanvas(p, size, tilt) {
    const shot = window.THREE ? SKINS.render({ material: p.material || 'glass', color: p.color || '#ff7a1a', face: p.face }, size, tilt) : null;
    const cv = document.createElement('canvas');
    cv.width = cv.height = size * 2;
    const ctx = cv.getContext('2d');
    if (shot) { ctx.drawImage(shot, 0, 0, size * 2, size * 2); return cv; }
    ctx.scale(2, 2);
    const base = SKINS.swatch(p.material || 'glass', p.color || '#ff7a1a');
    ctx.drawImage(base, 0, 0, size, size);
    if (p.face) RENDER.drawFace(ctx, size / 2, size / 2, size * 0.42, p.face);
    return cv;
  }

  function paintLobby() {
    const r = game.get().race;
    if (!r) return;
    const me = wallet.get().address;
    const grid = $('#playerGrid');
    grid.innerHTML = '';
    $('#fieldCount').textContent = r.players.length + ' joined';
    $('#fieldEmpty').hidden = r.players.length > 0;
    r.players.forEach((p, i) => {
      const el = document.createElement('div');
      el.className = 'pc' + (same(p.address, me) ? ' is-you' : '');
      el.appendChild(marbleCanvas(p, 34));
      const meta = document.createElement('div');
      const b = document.createElement('b'); b.textContent = p.name || short(p.address);
      const s = document.createElement('span'); s.textContent = '#' + (i + 1) + ' · ' + short(p.address);
      meta.append(b, s);
      el.appendChild(meta);
      el.addEventListener('click', () => cheer(p.address));
      grid.appendChild(el);
    });
    paintJoinButton();
  }

  function paintJoinButton() {
    const r = game.get().race;
    const w = wallet.get();
    const btn = $('#joinBtn');
    const joined = ui.get().joined;
    btn.classList.toggle('btn--joined', !!(w.address && joined));
    if (!w.address) { btn.disabled = false; btn.textContent = 'Connect to join'; btn.onclick = () => openWallet(); return; }
    btn.onclick = () => join();
    /* joined is a state of its own, not a disabled button: full colour, a check */
    if (joined) { btn.disabled = false; btn.onclick = null; btn.innerHTML = '<svg class="ic"><use href="#i-check"/></svg> You\'re in · race #' + pad((r && r.number) || 0); }
    else if (r && r.phase === 'lobby') { btn.disabled = false; btn.textContent = 'Join race #' + pad(r.number || 0); }
    else { btn.disabled = true; btn.textContent = 'Queue closed · next race'; }
  }

  function paintHud() {
    if (!current) return;
    const me = wallet.get().address;
    const balls = [...current.balls].sort((a, b) => {
      if (a.done && b.done) return a.place - b.place;
      if (a.done) return -1; if (b.done) return 1;
      return b.y - a.y;
    });
    const board = $('#board');
    const top = balls.slice(0, 8);
    const meIdx = balls.findIndex((b) => same(b.id, me));
    if (meIdx >= 8 && meIdx >= 0) top.push(balls[meIdx]);
    if (board.children.length !== top.length) { board.innerHTML = ''; for (let i = 0; i < top.length; i++) { const li = document.createElement('li'); li.innerHTML = '<span></span><i></i><b></b><span class="t"></span>'; board.appendChild(li); } }
    top.forEach((b, i) => {
      const li = board.children[i];
      const p = (game.get().race.players.find((x) => x.address === b.id)) || {};
      const rank = balls.indexOf(b) + 1;
      li.children[0].textContent = rank;
      li.children[1].style.background = p.color || '#fff';
      li.children[2].textContent = p.name || short(b.id);
      li.children[3].textContent = b.done ? b.time.toFixed(1) + 's' : Math.round(RACE.progress(current, b) * 100) + '%';
      li.className = (same(b.id, me) ? 'is-you' : '') + (rank === 1 ? ' is-lead' : '');
    });
    const meBall = meIdx >= 0 ? balls[meIdx] : null;
    $('#hudMe').hidden = !meBall;
    if (meBall) {
      $('#mePos').textContent = '#' + (meIdx + 1);
      const pr = Math.round(RACE.progress(current, meBall) * 100);
      $('#meDist').textContent = pr + '%';
      $('#meBar').style.width = pr + '%';
    }
  }

  function showResults(d) {
    const r = game.get().race;
    const me = wallet.get().address;
    $('#resNo').textContent = '#' + pad(d.number || (r && r.number) || 0) + ' · ' + modeInfo(d.mode || (r && r.mode) || 'classic').name.toUpperCase();
    const pod = $('#podium');
    pod.innerHTML = '';
    const order = (d.order || []).slice(0, 3);
    const players = r ? r.players : [];
    const medals = ['1st', '2nd', '3rd'];
    order.forEach((o, i) => {
      const p = players.find((x) => x.address === o.id) || { address: o.id, color: '#fff', face: 'doge' };
      const li = document.createElement('li');
      const place = document.createElement('span'); place.className = 'place'; place.textContent = medals[i];
      const cv = marbleCanvas(p, 36);
      const who = document.createElement('div'); who.className = 'who';
      const b = document.createElement('b'); b.textContent = (p.name || short(o.id)) + (same(o.id, me) ? ' · YOU' : '');
      const s = document.createElement('span'); s.textContent = (p.name ? short(o.id) + ' · ' : '') + o.time.toFixed(2) + 's';
      who.append(b, s);
      const prize = document.createElement('span'); prize.className = 'prize';
      prize.textContent = i === 0 ? (d.pot === null || d.pot === undefined ? 'the pot' : usd(d.pot)) : '—';
      li.append(place, cv, who, prize);
      pod.appendChild(li);
    });
    const mine = (d.order || []).findIndex((o) => same(o.id, me));
    $('#resYou').hidden = mine < 0;
    if (mine >= 0) { $('#resYouPos').textContent = '#' + (mine + 1) + (mine === 0 ? ' · YOU WON' : ''); if (mine === 0) { SOUND.play('win'); toast('You won! The pot goes to your address.', 'good'); } }
    $('#resAddr').textContent = d.winner || '';
    $('#resSend').href = 'ethereum:' + (d.winner || '');
    paintResultPaid();
    setScreen('results');
  }

  /* If the race on the results screen has been paid, say so, with the
     transaction anyone can open on the explorer. */
  function paintResultPaid() {
    const r = game.get().race;
    const rec = r && (game.get().recent || []).find((x) => x.id === r.id);
    const el = $('#resPaid');
    if (!rec || !rec.paid) { el.hidden = true; return; }
    el.hidden = false;
    const explorer = ((game.get().config && game.get().config.explorer) || 'https://robinhoodchain.blockscout.com').replace(/\/$/, '');
    const tx = rec.tx && /^0x[0-9a-f]{64}$/i.test(rec.tx) ? rec.tx : '';
    el.innerHTML = '';
    const tag = document.createElement('i'); tag.className = 'tag tag--paid'; tag.textContent = 'PAID';
    el.appendChild(tag);
    if (tx) { const a = document.createElement('a'); a.href = explorer + '/tx/' + tx; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'transaction ' + tx.slice(0, 10) + '…' + tx.slice(-6); el.appendChild(a); }
    else el.appendChild(document.createTextNode(' by the creator' + (rec.tx ? ' · ' + String(rec.tx).slice(0, 40) : '')));
  }

  /* ---- feed & chat --------------------------------------------------------- */

  function feed(m, quiet) {
    const li = document.createElement('li');
    if (m.sys) { li.className = 'sys'; li.textContent = m.text; }
    else {
      const r = game.get().race;
      const p = r && r.players.find((x) => same(x.address, m.from));
      const who = m.name || (p && p.name) || short(m.from);
      const b = document.createElement('b'); b.textContent = who + ' '; b.title = m.from;
      li.append(b, document.createTextNode(m.text));
    }
    const ul = $('#feed');
    ul.appendChild(li);
    while (ul.children.length > 80) ul.firstChild.remove();
    ul.scrollTop = ul.scrollHeight;
    const f = ui.get().feed; f.push(m); if (f.length > 80) f.shift();
  }
  $('#chatForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const w = wallet.get();
    const text = $('#chatInput').value.trim();
    if (!text) return;
    if (!w.token) return openWallet();
    $('#chatInput').value = '';
    const res = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: w.token, text }) }).then((r) => r.json()).catch(() => ({ error: 'network' }));
    if (res.error) toast(res.error, 'bad');
  });
  async function cheer(address) {
    const w = wallet.get();
    if (!w.token) return toast('Connect a wallet to cheer');
    SOUND.wake();
    await fetch('/api/cheer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: w.token, target: address }) }).catch(() => {});
  }

  /* ---- wallet -------------------------------------------------------------- */

  function openWallet() {
    SOUND.wake();
    if (wallet.get().address) return openModal('m-account');
    const list = WALLET.list();
    const host = $('#walletList');
    host.innerHTML = '';
    for (const e of list) {
      const b = document.createElement('button');
      b.className = 'wl';
      const ic = e.icon ? Object.assign(document.createElement('img'), { src: e.icon, alt: '' }) : Object.assign(document.createElement('span'), { className: 'ic', textContent: e.label.slice(0, 2).toUpperCase() });
      const meta = document.createElement('div');
      meta.innerHTML = '<b></b><span></span>';
      meta.querySelector('b').textContent = e.label;
      meta.querySelector('span').textContent = e.kind === 'phantom' ? 'Ethereum via Phantom' : 'Injected EVM wallet';
      const go = document.createElement('span'); go.className = 'go'; go.textContent = 'CONNECT →';
      b.append(ic, meta, go);
      b.addEventListener('click', () => connectWith(e));
      host.appendChild(b);
    }
    $('#walletHint').textContent = list.length ? '' : (WALLET.isMobile() ? 'No wallet found in this browser. Open this page inside MetaMask or Phantom.' : 'No wallet found. Install MetaMask, Phantom or any EVM wallet, then reload this page.');
    if (!list.length && WALLET.isMobile()) {
      const a = document.createElement('a'); a.className = 'btn btn--glass'; a.href = WALLET.deepLink('metamask'); a.textContent = 'Open in MetaMask';
      host.appendChild(a);
    }
    openModal('m-wallet');
  }

  async function connectWith(entry) {
    wallet.set({ connecting: true, error: null });
    try {
      const c = await WALLET.connect(entry);
      const nonce = await fetch('/api/nonce?address=' + encodeURIComponent(c.address)).then((r) => r.json());
      if (nonce.error) throw new Error(nonce.error);
      toast('Sign the message in your wallet. It proves the address is yours.');
      const signature = await WALLET.signMessage(nonce.message, c.address);
      const auth = await fetch('/api/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: c.address, nonce: nonce.nonce, signature }) }).then((r) => r.json());
      if (auth.error) throw new Error(auth.error);
      signedIn({ address: auth.address, token: auth.token, kind: c.kind, label: c.label, chainId: c.chainId, network: c.network, demo: false, stats: auth.stats });
      SOUND.play('wallet');
      closeModals();
      toast('Wallet connected', 'good');
    } catch (err) {
      const msg = /reject|denied|cancel/i.test(String(err && err.message)) ? 'You cancelled in the wallet' : (err && err.message) || 'Could not connect';
      wallet.set({ connecting: false, error: msg });
      SOUND.play('error');
      toast(msg, 'bad');
    }
  }

  async function connectDemo() {
    const auth = await fetch('/api/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ demo: true }) }).then((r) => r.json()).catch(() => ({ error: 'network' }));
    if (auth.error) return toast(auth.error, 'bad');
    signedIn({ address: auth.address, token: auth.token, kind: 'demo', label: 'Demo wallet', chainId: null, network: 'demo', demo: true, stats: auth.stats });
    closeModals();
    toast('Demo wallet ready. Nothing it does touches a chain.', 'good');
  }
  /* No demo wallet on the page: a wallet is a wallet. The server keeps the
     demo route for its own tests, reachable from the console only. */

  function signedIn(w) {
    wallet.set({ address: w.address, token: w.token, kind: w.kind, label: w.label, chainId: w.chainId, network: w.network, demo: !!w.demo, connecting: false, error: null, stats: w.stats || null });
    try { localStorage.setItem('mr.session', JSON.stringify({ address: w.address, token: w.token, kind: w.kind, label: w.label, chainId: w.chainId, network: w.network, demo: !!w.demo })); } catch {}
    paintWallet();
    const r = game.get().race;
    if (r) { ui.set({ joined: r.players.some((p) => same(p.address, w.address)) }); if (mode === 'preview') startPreview(r); }
    paintLobby();
    paintYou();
  }

  async function signOut() {
    await WALLET.disconnect();
    wallet.set({ address: null, token: null, kind: null, label: '', chainId: null, network: '', demo: false, stats: null });
    try { localStorage.removeItem('mr.session'); } catch {}
    ui.set({ joined: false });
    paintWallet(); paintLobby(); paintYou();
    closeModals();
    toast('Disconnected');
  }

  function paintWallet() {
    const w = wallet.get();
    const item = $('.dock__it--wallet');
    item.classList.toggle('is-off', !w.address);
    if (w.address) {
      $('#accKind').textContent = w.label + (w.demo ? '' : ' · connected');
      $('#accAddr').textContent = w.address;
      $('#accNet').textContent = w.demo ? 'no network' : (w.network || 'unknown network'); $('#accNet').hidden = w.demo;
      $('#accDemo').hidden = !w.demo;
      $('#accStats').textContent = w.stats ? w.stats.wins + ' wins · ' + w.stats.races + ' races' : '';
    }
    $('#dockWallet').textContent = w.address ? short(w.address) : 'Connect';
  }
  $('#heroJoin').addEventListener('click', () => { SOUND.wake(); if (!wallet.get().address) openWallet(); else { setScreen('lobby'); join(); } });
  $('#accCopy').addEventListener('click', () => copy(wallet.get().address, 'Your address'));
  $('#accDisconnect').addEventListener('click', signOut);
  WALLET.on((ev) => {
    if (ev.type === 'accounts' && (!ev.accounts || !ev.accounts.length || !same(ev.accounts[0], wallet.get().address))) signOut();
    if (ev.type === 'chain') { wallet.set({ chainId: ev.chainId, network: WALLET.chainName(ev.chainId) }); paintWallet(); }
    if (ev.type === 'disconnect') signOut();
  });

  /* ---- joining --------------------------------------------------------------- */

  async function join(silent) {
    const w = wallet.get();
    if (!w.token) return openWallet();
    const r = game.get().race;
    if (!r || r.phase !== 'lobby') { if (!silent) toast('The queue is closed. Join the next race from its lobby when it opens.'); return; }
    const skin = ui.get().skin;
    const { tx, res } = await CONTRACTS.race.joinRace(w, { color: skin.color, face: skin.face, material: skin.material, name: skin.name });
    if (res && res.ok) { ui.set({ joined: true }); if (!silent) toast("You're in. Your marble is on the grid.", 'good'); paintJoinButton(); return; }
    if (res && res.already) { ui.set({ joined: true }); paintJoinButton(); return; }
    if (res && res.error === 'holders only') toast('Holders only: you need ' + res.need + ' tokens to race', 'bad');
    else if (res && res.queued) toast('This race is full. You are queued for the next one.');
    else if (!silent) toast((res && res.error) || 'Could not join', 'bad');
    if (res && String(res.error).includes('sign in')) signOut();
    paintJoinButton();
  }
  CONTRACTS.onTx((tx) => {
    chain.set({ tx });
    const line = $('#txLine');
    line.hidden = tx.status === 'idle';
    line.dataset.status = tx.status;
    $('#txText').textContent = CONTRACTS.labels[tx.status] + (tx.kind === 'join' ? ' · join' : ' · claim') + (tx.error ? ' · ' + tx.error : '') + (chain.get().mode === 'demo' ? ' · demo, nothing on-chain' : '');
    if (tx.status === 'confirmed' || tx.status === 'failed') setTimeout(() => { if (chain.get().tx === tx) line.hidden = true; }, 6000);
  });
  /* Race again takes you to the lobby; you join the next race yourself, the
     moment its queue is open. Nobody is entered into a race they did not join. */
  $('#raceAgain').addEventListener('click', () => {
    SOUND.wake(); setScreen('lobby');
    const r = game.get().race;
    if (r && r.phase === 'lobby') join(); else toast('The next race opens in a moment. Press join when it does.');
  });
  $('#resCopy').addEventListener('click', () => copy($('#resAddr').textContent, "Winner's address"));
  $('#resAddr').addEventListener('click', () => copy($('#resAddr').textContent, "Winner's address"));

  /* ---- your marble ------------------------------------------------------------ */

  function loadSkin() {
    let skin = { material: 'glass', color: '#ff7a1a', face: 'doge', name: '' };
    try { const raw = JSON.parse(localStorage.getItem('mr.skin') || 'null'); if (raw && raw.color) skin = Object.assign(skin, raw); } catch {}
    if (!RENDER.FACES.includes(skin.face)) skin.face = 'doge';
    if (!SKINS.MATERIALS.includes(skin.material)) skin.material = 'glass';
    ui.set({ skin });
  }
  function saveSkin(patch) {
    const skin = Object.assign({}, ui.get().skin, patch);
    ui.set({ skin });
    try { localStorage.setItem('mr.skin', JSON.stringify(skin)); } catch {}
    paintYou();
    if (SCENE.ready && wallet.get().address) SCENE.addPlayer({ address: wallet.get().address, color: skin.color, face: skin.face, material: skin.material, name: skin.name });
    pushSkin();
  }
  /* Once you are in the field, a change of look or name goes to the server
     so everyone's lobby, race and chat show it; sent a moment after the last
     keystroke rather than on every one. */
  let pushT = null;
  function pushSkin() {
    const w = wallet.get(), r = game.get().race;
    if (!w.token || !ui.get().joined || !r || r.phase !== 'lobby') return;
    clearTimeout(pushT);
    pushT = setTimeout(async () => {
      const skin = ui.get().skin;
      const res = await fetch('/api/skin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: w.token, color: skin.color, face: skin.face, material: skin.material, name: skin.name }) }).then((x) => x.json()).catch(() => ({ error: 'network' }));
      if (res && res.player) onSkin({ roundId: r.id, player: res.player });
    }, 500);
  }
  function onSkin(d) {
    const r = game.get().race;
    if (!r || d.roundId !== r.id) return;
    const p = r.players.find((x) => x.address === d.player.address);
    if (p) Object.assign(p, d.player); else return;
    game.set({ race: r });
    if (SCENE.ready) SCENE.addPlayer(d.player);
    paintLobby();
  }
  function paintYou() {
    const skin = ui.get().skin;
    const w = wallet.get();
    for (const id of ['#youPrev', '#skinPrev']) {
      const cv = $(id); const size = cv.width / 2; const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, cv.width, cv.height);
      const shot = window.THREE ? SKINS.render({ material: skin.material, color: skin.color, face: skin.face }, size * 0.9) : null;
      if (shot) { ctx.drawImage(shot, size * 0.1, size * 0.1, size * 1.8, size * 1.8); continue; }
      ctx.save(); ctx.scale(2, 2);
      ctx.drawImage(SKINS.swatch(skin.material, skin.color), size * 0.1, size * 0.1, size * 0.8, size * 0.8);
      RENDER.drawFace(ctx, size / 2, size / 2, size * 0.33, skin.face);
      ctx.restore();
    }
    paintPickers();
    $('#youName').textContent = skin.name || (w.address ? short(w.address) : '—');
    $('#youAddr').textContent = w.address ? w.address : 'connect a wallet';
    $('#youMat').textContent = SKINS.LABELS[skin.material] + ' · ' + skin.face.toUpperCase();
    $('#skinName').value = skin.name || '';
    if (document.activeElement !== $('#youNameInput')) $('#youNameInput').value = skin.name || '';
    $$('.mt').forEach((b) => b.classList.toggle('on', b.dataset.v === skin.material));
    $$('.fc').forEach((b) => b.classList.toggle('on', b.dataset.v === skin.face));
    $$('.sw').forEach((b) => b.classList.toggle('on', b.dataset.v === skin.color));
  }
  /* The pickers show each material in your colour with your coin, and each
     coin in its own colour, rendered like the marble itself. They redraw
     when the choice changes, so a material swatch always wears your coin. */
  let pickersKey = '';
  function paintPickers() {
    const skin = ui.get().skin;
    const key = skin.color + ':' + skin.face + ':' + skin.material + ':' + (window.THREE ? 3 : 2);
    if (pickersKey === key) return;
    pickersKey = key;
    $$('.mt').forEach((b) => { b.querySelector('canvas').replaceWith(marbleCanvas({ material: b.dataset.v, color: skin.color, face: skin.face }, 40)); });
    $$('.fc').forEach((b) => { b.querySelector('canvas').replaceWith(marbleCanvas({ material: 'glass', color: RENDER.SKIN_COLORS[b.dataset.v] || skin.color, face: b.dataset.v }, 40)); });
  }
  function buildPickers() {
    const mats = $('#mats');
    for (const m of SKINS.MATERIALS) {
      const b = document.createElement('button'); b.className = 'mt'; b.dataset.v = m;
      const cv = SKINS.swatch(m, ui.get().skin.color);
      const s = document.createElement('span'); s.textContent = SKINS.LABELS[m];
      b.append(cv, s); b.addEventListener('click', () => saveSkin({ material: m }));
      mats.appendChild(b);
    }
    const faces = $('#faces');
    for (const f of RENDER.FACES) {
      const b = document.createElement('button'); b.className = 'fc'; b.dataset.v = f;
      const cv = document.createElement('canvas'); cv.width = cv.height = 80;
      const ctx = cv.getContext('2d'); ctx.fillStyle = RENDER.SKIN_COLORS[f] || '#39415a';
      ctx.beginPath(); ctx.arc(40, 40, 32, 0, 6.283); ctx.fill(); RENDER.drawFace(ctx, 40, 40, 32, f);
      const s = document.createElement('span'); s.textContent = f.toUpperCase();
      b.append(cv, s); b.addEventListener('click', () => saveSkin({ face: f, color: RENDER.SKIN_COLORS[f] || ui.get().skin.color }));
      faces.appendChild(b);
    }
    const sw = $('#swatches');
    for (const c of SWATCH) {
      const b = document.createElement('button'); b.className = 'sw'; b.dataset.v = c; b.style.background = c; b.setAttribute('aria-label', 'colour ' + c);
      b.addEventListener('click', () => saveSkin({ color: c }));
      sw.appendChild(b);
    }
    $('#skinName').addEventListener('input', () => saveSkin({ name: $('#skinName').value.replace(/[^\w .\-]/g, '').slice(0, 16) }));
    $('#youNameInput').addEventListener('input', () => saveSkin({ name: $('#youNameInput').value.replace(/[^\w .\-]/g, '').slice(0, 16) }));
    $('#skinBtn').addEventListener('click', () => { SOUND.wake(); openModal('m-skin'); });
  }

  /* ---- themes -------------------------------------------------------------------- */

  /* Three looks: Legacy (the blue one), Black and White. The choice is kept
     in the browser; the world under the page takes the theme's sky, and the
     race itself is always the dark stage. */
  const THEMES = { legacy: { sky: '#eef2fc', apron: '#dfe6f7', dark: false }, white: { sky: '#f6f6f8', apron: '#e9e9ee', dark: false }, black: { sky: '#07070b', apron: '#08080d', dark: true } };
  /* Black is the default; Legacy (blue) and White are the choices. */
  function themeName() { const t = document.documentElement.dataset.theme; return THEMES[t] ? t : 'black'; }
  function applyBackdrop() {
    if (!SCENE.ready) return;
    const t = THEMES[themeName()];
    const screen = ui.get().screen;
    const dark = t.dark || screen === 'race' || screen === 'count';
    SCENE.setBackdrop(dark ? 'dark' : 'light', dark ? { sky: '#07070b', apron: '#08080d' } : { sky: t.sky, apron: t.apron });
  }
  function setTheme(name) {
    if (!THEMES[name]) name = 'black';
    if (name === 'legacy') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = name;
    try { localStorage.setItem('mr.theme', name); } catch {}
    $$('.theme').forEach((b) => b.classList.toggle('is-on', b.dataset.theme === name));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = name === 'black' ? '#07070b' : name === 'white' ? '#ffffff' : '#f5f7ff';
    applyBackdrop();
  }
  $$('.theme').forEach((b) => b.addEventListener('click', () => { SOUND.wake(); setTheme(b.dataset.theme); }));

  /* ---- the hero's floating coins and the window onto the track ---------------- */

  /* Coin marbles drift round the headline, drawn with the same routine the
     pickers use, so they are the marbles that race. A few are blurred, for
     depth. Below the fold a soft window in the page's veil shows the live
     world underneath; its place follows the stage element on every frame. */
  function buildFloaters() {
    const host = $('#floaters');
    /* The eight best known coins, each on the marble it suits, turned so the
       symbol faces the reader. Depth comes from size and a whisper of blur. */
    const spots = [
      { x: 9, y: 16, s: 104, f: 'btc', m: 'metal', c: '#f7931a', b: 0 }, { x: 3, y: 58, s: 78, f: 'doge', m: 'glass', c: '#c2a633', b: 0.8 },
      { x: 86, y: 12, s: 88, f: 'eth', m: 'chrome', c: '#8c8cf0', c2: '#627eea', b: 0 }, { x: 90, y: 56, s: 112, f: 'sol', m: 'holo', c: '#9945ff', b: 0.6 },
      { x: 14, y: 38, s: 64, f: 'xrp', m: 'glass', c: '#2b3a55', b: 1 }, { x: 93, y: 34, s: 70, f: 'bnb', m: 'metal', c: '#f3ba2f', b: 0 },
      { x: 24, y: 4, s: 60, f: 'usdt', m: 'neon', c: '#26a17b', b: 1 }, { x: 70, y: 2, s: 66, f: 'ada', m: 'glass', c: '#0d3b8e', b: 0 }
    ];
    const FACING = [0.35, 0.15, 0.6, 0.25, 0.5, 0.2, 0.4, 0.3];
    spots.forEach((sp, i) => {
      const w = document.createElement('span');
      w.className = 'fl';
      w.style.left = sp.x + '%'; w.style.top = sp.y + '%';
      w.style.width = w.style.height = sp.s + 'px';
      w.style.animationDelay = (0.1 + i * 0.12) + 's';
      const cv = marbleCanvas({ material: sp.m, color: sp.c, face: sp.f }, sp.s, FACING[i]);
      cv.className = 'floater';
      cv.dataset.spot = String(i);
      cv.style.filter = sp.b ? 'blur(' + sp.b + 'px)' : '';
      cv.style.opacity = sp.b ? String(0.92 - sp.b * 0.08) : '1';
      cv.dataset.m = sp.m; cv.dataset.c = sp.c; cv.dataset.f = sp.f; cv.dataset.s = String(sp.s);
      cv.style.animationDelay = (-i * 1.3) + 's';
      cv.style.animationDuration = (7 + (i % 4) * 1.5) + 's';
      w.appendChild(cv);
      host.appendChild(w);
    });
    /* if the renders never come (no WebGL), the flat coins arrive instead */
    setTimeout(() => host.classList.add('is-in'), 3500);
  }
  /* Once three is up, every flat marble on the page becomes a real one. */
  function upgradeMarbles() {
    if (!window.THREE) return;
    const spots = $$('.floater');
    spots.forEach((old, i) => {
      const m = { material: old.dataset.m, color: old.dataset.c, face: old.dataset.f };
      if (!m.material) return;
      const cv = marbleCanvas(m, Number(old.dataset.s), [0.35, 0.15, 0.6, 0.25, 0.5, 0.2, 0.4, 0.3][i % 8]);
      cv.className = old.className;
      cv.style.cssText = old.style.cssText;
      Object.assign(cv.dataset, old.dataset);
      old.replaceWith(cv);
    });
    /* the real marbles are in place: now they arrive */
    requestAnimationFrame(() => $('#floaters').classList.add('is-in'));
    pickersKey = '';
    paintYou();
    paintLobby();
  }
  function placeStage() {
    const veil = $('.veil');
    const screen = ui.get().screen;
    /* the dock shows once the home page is scrolled down to the track, and
       always on the other screens */
    const dock = $('#dock');
    const wantDock = screen !== 'race' && screen !== 'count';
    if (wantDock !== dock.classList.contains('is-shown')) dock.classList.toggle('is-shown', wantDock);
    if (screen === 'home') {
      const st = $('#stage');
      const r = st.getBoundingClientRect();
      const vis = r.bottom > 0 && r.top < innerHeight;
      veil.style.setProperty('--hx', (r.left + r.width / 2) + 'px');
      veil.style.setProperty('--hy', (r.top + r.height / 2) + 'px');
      veil.style.setProperty('--hw', (r.width * 0.56) + 'px');
      veil.style.setProperty('--hh', (r.height * 0.56) + 'px');
      veil.dataset.hole = vis ? '1' : '';
    } else if (screen === 'results' || screen === 'lobby') {
      veil.style.setProperty('--hx', (innerWidth * 0.82) + 'px');
      veil.style.setProperty('--hy', (innerHeight * 0.55) + 'px');
      veil.style.setProperty('--hw', (innerWidth * 0.24) + 'px');
      veil.style.setProperty('--hh', (innerHeight * 0.36) + 'px');
      veil.dataset.hole = '1';
    } else veil.dataset.hole = '';
  }

  /* ---- the notice on arrival ------------------------------------------------------ */

  /* A short word on arrival: a game, not gambling; nothing wagered; your keys
     stay yours; only your own preferences are kept, no tracking. Shown once
     per browser; dismissed for good with Got it. */
  function showNotice() {
    let seen = false;
    try { seen = localStorage.getItem('mr.notice') === 'ok'; } catch {}
    if (seen) return;
    $('#notice').hidden = false;
  }
  function closeNotice() {
    $('#notice').hidden = true;
    try { localStorage.setItem('mr.notice', 'ok'); } catch {}
  }
  $('#noticeOk').addEventListener('click', closeNotice);
  $$('[data-notice-ok]').forEach((a) => a.addEventListener('click', closeNotice));

  /* ---- the dock ---------------------------------------------------------------- */

  /* A taskbar along the bottom: every screen one tap away, the race's phase
     and clock always in view. It steps aside for the countdown and the race
     itself, which are the one time the whole screen is the track. */
  function paintDock() {
    const screen = ui.get().screen;
    const on = { home: 'home', lobby: 'lobby', results: 'lobby', race: 'lobby', count: 'lobby', launch: 'launch', fair: 'fair' }[screen];
    $$('.dock__it').forEach((b) => b.classList.toggle('is-on', b.dataset.dock === on));
  }
  $$('.dock__it').forEach((b) => b.addEventListener('click', () => {
    SOUND.wake();
    const go = b.dataset.dock;
    if (go === 'home' || go === 'lobby' || go === 'launch' || go === 'fair') {
      const r = game.get().race;
      if (go === 'lobby' && r && r.phase === 'racing') setScreen('race');
      else if (go === 'lobby' && r && r.phase === 'result' && r.winner) showResults({ winner: r.winner, order: r.order, pot: r.pot, number: r.number, mega: r.mega, mode: r.mode });
      else setScreen(go);
    } else if (go === 'modes') {
      setScreen('home');
      requestAnimationFrame(() => $('#modes').scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } else if (go === 'winners') openWinners();
    else if (go === 'wallet') openWallet();
  }));

  /* ---- rewards: what the creator has paid ------------------------------------- */

  function paintRewards() {
    const list = game.get().rewards || [];
    const host = $('#rewardRows');
    if (!host) return;
    host.innerHTML = '';
    $('#rewardsEmpty').hidden = list.length > 0;
    $('#paidTotal').textContent = usd(game.get().paidTotal || 0);
    const explorer = (game.get().config && game.get().config.explorer) || 'https://etherscan.io';
    for (const x of list) {
      const row = document.createElement('div');
      row.className = 'table__row';
      row.innerHTML = '<span class="mono"></span><span class="mono who"></span><span class="mono gold"></span><span class="mono"></span><span class="mono"></span>';
      const c = row.children;
      c[0].textContent = '#' + pad(x.number || 0) + (x.mega ? ' · MEGA' : '');
      c[1].textContent = short(x.winner); c[1].title = x.winner;
      c[2].textContent = x.pot === null || x.pot === undefined ? 'the pot' : usd(x.pot);
      c[3].textContent = x.paidAt ? new Date(x.paidAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'paid';
      if (x.tx && /^0x[0-9a-f]{64}$/i.test(x.tx)) { const a = document.createElement('a'); a.href = explorer.replace(/\/$/, '') + '/tx/' + x.tx; a.target = '_blank'; a.rel = 'noopener'; a.textContent = x.tx.slice(0, 10) + '…' + x.tx.slice(-6); c[4].appendChild(a); }
      else c[4].textContent = x.tx ? String(x.tx).slice(0, 18) : 'by hand';
      row.addEventListener('click', () => copy(x.winner, "Winner's address"));
      host.appendChild(row);
    }
  }
  function onPaid(d) {
    game.set({ rewards: d.rewards || [], paidTotal: d.paidTotal || 0 });
    const recent = (game.get().recent || []).map((x) => (x.id === d.round.id ? d.round : x));
    game.set({ recent });
    paintRewards(); paintRecent(); paintResultPaid();
    const me = wallet.get().address;
    if (same(d.round.winner, me)) { SOUND.play('win'); toast('Your reward for race #' + pad(d.round.number || 0) + ' was paid: ' + usd(d.round.pot), 'good'); }
    else toast('Race #' + pad(d.round.number || 0) + ' paid: ' + usd(d.round.pot) + ' to ' + short(d.round.winner), 'good');
  }

  /* ---- latest races on the home page ------------------------------------------- */

  function paintRecent() {
    const recent = (game.get().recent || []).slice(0, 8);
    const host = $('#recentRows');
    if (!host) return;
    host.innerHTML = '';
    $('#recentEmpty').hidden = recent.length > 0;
    for (const x of recent) {
      const row = document.createElement('div');
      row.className = 'table__row';
      row.innerHTML = '<span class="mono"></span><span></span><span class="mono who"></span><span class="mono"></span><span class="mono gold"></span><span></span>';
      const c = row.children;
      c[0].textContent = '#' + pad(x.number || 0) + (x.mega ? ' · MEGA' : '');
      c[1].textContent = modeInfo(x.mode || 'classic').name;
      c[2].textContent = x.winner ? short(x.winner) : 'no winner'; c[2].title = x.winner || '';
      c[3].textContent = x.podium && x.podium[0] ? x.podium[0].time.toFixed(2) + 's' : (x.seconds ? x.seconds.toFixed(1) + 's' : '—');
      c[4].textContent = x.pot === null || x.pot === undefined ? '—' : usd(x.pot);
      const st = document.createElement('i'); st.className = 'tag ' + (x.paid ? 'tag--paid' : 'tag--due'); st.textContent = x.paid ? 'PAID' : 'TO PAY';
      c[5].appendChild(st);
      if (x.winner) row.addEventListener('click', () => copy(x.winner, "Winner's address"));
      host.appendChild(row);
    }
  }
  $$('[data-dock="winners"]:not(.dock__it)').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); openWinners(); }));

  /* ---- winners ------------------------------------------------------------------ */

  function openWinners() {
    const recent = game.get().recent || [];
    const top = game.get().top || [];
    const ul = $('#winList'); ul.innerHTML = '';
    $('#winEmpty').hidden = recent.length > 0;
    for (const x of recent.slice(0, 12)) {
      const li = document.createElement('li');
      li.innerHTML = '<span class="no"></span><b class="who"></b><span class="pot gold"></span><span class="st"></span>';
      li.querySelector('.no').textContent = '#' + pad(x.number || 0) + (x.mega ? ' MEGA' : '');
      li.querySelector('.who').textContent = x.winner ? short(x.winner) : 'no winner';
      li.querySelector('.who').title = x.winner || '';
      li.querySelector('.pot').textContent = x.pot === null || x.pot === undefined ? '—' : usd(x.pot);
      li.querySelector('.st').textContent = (x.mode ? modeInfo(x.mode).name + ' · ' : '') + (x.paid ? 'paid' : 'to pay');
      if (x.winner) li.addEventListener('click', () => copy(x.winner, "Winner's address"));
      ul.appendChild(li);
    }
    const tl = $('#topList'); tl.innerHTML = '';
    if (!top.length) { const li = document.createElement('li'); li.className = 'dim'; li.textContent = 'nobody has won twice yet'; tl.appendChild(li); }
    for (const t of top.slice(0, 10)) {
      const li = document.createElement('li');
      li.innerHTML = '<span class="no"></span><b class="who"></b><span class="pot"></span>';
      li.querySelector('.no').textContent = (t.wins || 0) + '×';
      li.querySelector('.who').textContent = short(t.address || t.winner || '');
      li.querySelector('.pot').textContent = t.races ? t.races + ' races' : '';
      tl.appendChild(li);
    }
    openModal('m-winners');
  }

  /* ---- fair: verify a race in the page ------------------------------------------- */

  /* The same check /verify does, inside the page, so the one-file build and
     a phone have it too: hash the secret, recompute the seed from the field,
     replay the race in its mode, compare the winner with the one paid. */
  const sha256 = async (text) => {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  };
  function paintFair() {
    const r = game.get().race;
    $('#fairCommit').textContent = 'seed commit · ' + (r && r.commit ? r.commit : '—');
    const sel = $('#fairPick');
    const recent = (game.get().recent || []).filter((x) => x.winner);
    const had = sel.value;
    sel.innerHTML = '';
    if (!recent.length) { const o = document.createElement('option'); o.value = ''; o.textContent = 'no finished race yet'; sel.appendChild(o); return; }
    for (const x of recent) {
      const o = document.createElement('option'); o.value = x.id;
      o.textContent = 'Race #' + pad(x.number || 0) + ' · ' + modeInfo(x.mode || 'classic').name + ' · ' + short(x.winner);
      sel.appendChild(o);
    }
    if (had && recent.some((x) => x.id === had)) sel.value = had;
  }
  async function verifyRace(id) {
    const out = $('#fairOut'), verdict = $('#fairVerdict');
    verdict.hidden = true;
    if (!id) { out.textContent = 'No finished race to verify yet.'; return; }
    out.textContent = 'fetching the record…';
    const res = await fetch('/api/round?id=' + encodeURIComponent(id)).then((x) => x.json()).catch(() => ({ error: 'network' }));
    if (res.error || !res.round) { out.textContent = 'Could not fetch that race: ' + (res.error || 'unknown'); return; }
    const r = res.round;
    if (!r.secret) { out.textContent = 'That race has no secret yet: it has not finished.'; return; }
    const lines = [];
    const commit = await sha256(r.secret);
    const commitOk = commit === r.commit;
    lines.push('race             #' + pad(r.number || 0) + ' · ' + modeInfo(r.mode || 'classic').name);
    lines.push('published hash   ' + r.commit);
    lines.push('sha256(secret)   ' + commit + (commitOk ? '   ✓ match' : '   ✗ MISMATCH'));
    const field = r.field || r.players || [];
    const seed = parseInt((await sha256(r.secret + '|' + field.join(','))).slice(0, 8), 16) >>> 0;
    const seedOk = seed === r.seed;
    lines.push('');
    lines.push('field            ' + field.length + ' wallets');
    lines.push('seed announced   ' + r.seed);
    lines.push('seed recomputed  ' + seed + (seedOk ? '   ✓ match' : '   ✗ MISMATCH'));
    out.textContent = lines.join('\n') + '\n\nreplaying the race…';
    await new Promise((f) => setTimeout(f, 30));
    const replay = RACE.runToEnd(seed, field.map((a) => ({ id: a })), r.mode || 'classic');
    const winOk = replay.order[0].id === r.winner;
    lines.push('');
    lines.push('winner announced ' + r.winner);
    lines.push('winner replayed  ' + replay.order[0].id + (winOk ? '   ✓ match' : '   ✗ MISMATCH'));
    lines.push('time             ' + replay.order[0].time.toFixed(3) + 's');
    out.textContent = lines.join('\n');
    const ok = commitOk && seedOk && winOk;
    verdict.hidden = false; verdict.className = 'fair__verdict ' + (ok ? 'ok' : 'no');
    verdict.textContent = ok ? 'This race checks out: the marble that was paid is the marble that won.' : 'Something does not line up. Do not trust this round.';
  }
  $('#fairRun').addEventListener('click', () => { SOUND.wake(); verifyRace($('#fairPick').value); });
  $$('[data-verify-last]').forEach((a) => a.addEventListener('click', () => {
    const r = game.get().race;
    setTimeout(() => { if (r) { const sel = $('#fairPick'); if ([...sel.options].some((o) => o.value === r.id)) { sel.value = r.id; verifyRace(r.id); } } }, 50);
  }));

  /* ---- the launchpad -------------------------------------------------------------- */

  /* A launch is a draft of a token with races of its own, kept in this
     browser. Deploying it goes through CONTRACTS.launchpad, which tells the
     truth about there being no contract yet rather than inventing a receipt. */
  const LAUNCH_KEY = 'mr.launches';
  const loadLaunches = () => { try { return JSON.parse(localStorage.getItem(LAUNCH_KEY) || '[]'); } catch { return []; } };
  const saveLaunches = (list) => { try { localStorage.setItem(LAUNCH_KEY, JSON.stringify(list.slice(0, 30))); } catch {} };
  const lpField = () => ({
    name: $('#lpName').value.trim().slice(0, 32),
    ticker: $('#lpTicker').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10),
    desc: $('#lpDesc').value.trim().slice(0, 200),
    face: $('#lpFace').value,
    color: $('#lpColor').value,
    image: $('#lpImg').value.trim().slice(0, 300),
    twitter: $('#lpTwitter').value.trim().slice(0, 200),
    telegram: $('#lpTelegram').value.trim().slice(0, 200),
    website: $('#lpWebsite').value.trim().slice(0, 200),
    buyback: $('#lpBuyback').checked,
    buyEth: $('#lpBuy').value.trim().replace(',', '.')
  });
  function paintLaunchPreview() {
    const f = lpField();
    $('#lpCardName').textContent = f.name || 'Your token';
    $('#lpCardTicker').textContent = '$' + (f.ticker || 'TICKER');
    $('#lpCardDesc').textContent = f.desc || 'A line about it goes here.';
    const cv = $('#lpMarble'); const ctx = cv.getContext('2d'); const size = 60;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.save(); ctx.scale(2, 2);
    ctx.drawImage(SKINS.swatch('glass', f.color), size * 0.08, size * 0.08, size * 0.84, size * 0.84);
    if (f.image) {
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => { const c2 = cv.getContext('2d'); c2.save(); c2.scale(2, 2); c2.beginPath(); c2.arc(size / 2, size / 2, size * 0.33, 0, 6.283); c2.clip(); c2.drawImage(img, size * 0.17, size * 0.17, size * 0.66, size * 0.66); c2.restore(); };
      img.src = f.image;
    } else RENDER.drawFace(ctx, size / 2, size / 2, size * 0.34, f.face);
    ctx.restore();
  }
  const explorerOf = () => (CONTRACTS.launchpad && CONTRACTS.launchpad.pons && CONTRACTS.launchpad.pons.explorer) || 'https://robinhoodchain.blockscout.com';
  function paintLaunches() {
    const list = loadLaunches();
    const ul = $('#lpList'); ul.innerHTML = '';
    $('#lpEmpty').hidden = list.length > 0;
    for (const l of list) {
      const li = document.createElement('li');
      const cv = marbleCanvas({ material: 'glass', color: l.color, face: l.face }, 30);
      const meta = document.createElement('div');
      const b = document.createElement('b'); b.textContent = l.name + ' · $' + l.ticker;
      const sp = document.createElement('span'); sp.className = 'mono dim';
      if (l.token) { const a = document.createElement('a'); a.href = explorerOf() + '/token/' + l.token; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'live · ' + short(l.token); a.addEventListener('click', (e) => e.stopPropagation()); sp.appendChild(a); }
      else sp.textContent = 'draft · not launched';
      meta.append(b, sp);
      const x = document.createElement('button'); x.className = 'x'; x.type = 'button'; x.textContent = '×'; x.title = 'remove from this list';
      x.addEventListener('click', () => { saveLaunches(loadLaunches().filter((q) => q.id !== l.id)); paintLaunches(); });
      li.append(cv, meta, x);
      li.addEventListener('click', (e) => { if (e.target === x) return; fillLaunch(l); });
      ul.appendChild(li);
    }
  }
  /* ---- everyone's launches --------------------------------------------------- */
  const ago = (t) => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; };
  function tokenCard(l, fresh) {
    const el = document.createElement('article'); el.className = 'tok' + (fresh ? ' tok--new' : '');
    const pic = document.createElement('div'); pic.className = 'tok__pic';
    if (l.image && /^https?:\/\//i.test(l.image)) { const img = new Image(); img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; img.src = l.image; img.onerror = () => { img.remove(); pic.appendChild(marbleCanvas({ material: 'glass', color: l.color, face: l.face || 'doge' }, 46)); }; pic.appendChild(img); }
    else pic.appendChild(marbleCanvas({ material: 'glass', color: l.color, face: l.face || 'doge' }, 46));
    const head = document.createElement('div');
    const nm = document.createElement('div'); nm.className = 'tok__name'; nm.textContent = l.name + ' '; const em = document.createElement('em'); em.textContent = '$' + l.ticker; nm.appendChild(em);
    const by = document.createElement('div'); by.className = 'tok__by'; by.textContent = 'by ' + short(l.deployer) + ' · ' + ago(l.at); by.title = l.deployer;
    head.append(nm, by);
    el.append(pic, head);
    if (l.desc) { const d = document.createElement('p'); d.className = 'tok__desc'; d.textContent = l.desc; el.appendChild(d); }
    if (l.buyWei && window.ethers) { const b = document.createElement('div'); b.className = 'tok__buy'; b.textContent = 'creator opening buy ' + ethers.formatEther(l.buyWei) + ' ETH'; el.appendChild(b); }
    const links = document.createElement('div'); links.className = 'tok__links';
    const mk = (text, href, cls) => { const a = document.createElement('a'); a.textContent = text; a.href = href; a.target = '_blank'; a.rel = 'noopener'; if (cls) a.className = cls; return a; };
    links.appendChild(mk('Pons', (CONTRACTS.launchpad.pons.site || 'https://ponsfamily.com') + '/launchpad?search=' + l.token, 'pons'));
    links.appendChild(mk('Explorer', explorerOf() + '/token/' + l.token));
    if (l.hash) links.appendChild(mk('Launch tx', explorerOf() + '/tx/' + l.hash));
    if (l.twitter) links.appendChild(mk('X', l.twitter));
    if (l.telegram) links.appendChild(mk('Telegram', l.telegram));
    if (l.website) links.appendChild(mk('Site', l.website));
    const cp = document.createElement('button'); cp.type = 'button'; cp.textContent = 'Copy CA'; cp.addEventListener('click', () => copy(l.token, 'Contract address')); links.appendChild(cp);
    el.appendChild(links);
    return el;
  }
  function paintCommunity(freshId) {
    const list = game.get().launches || [];
    const grid = $('#communityGrid'); grid.innerHTML = '';
    for (const l of list) grid.appendChild(tokenCard(l, l.id === freshId));
    $('#communityEmpty').hidden = list.length > 0;
    $('#communityCount').textContent = String(list.length);
    const home = $('#homeLaunchGrid'); home.innerHTML = '';
    for (const l of list.slice(0, 4)) home.appendChild(tokenCard(l, l.id === freshId));
    $('#homeLaunches').hidden = list.length === 0;
  }
  function onLaunch(d) {
    game.set({ launches: d.launches || [] });
    paintCommunity(d.launch && d.launch.id);
    if (!same(d.launch && d.launch.deployer, wallet.get().address)) toast('New token on the pad: ' + d.launch.name + ' $' + d.launch.ticker + ' by ' + short(d.launch.deployer), 'good');
  }
  /* Tells the server about a confirmed launch so it lands on everyone's board;
     the server checks the receipt on the chain before listing it. */
  async function reportLaunch(rec) {
    const w = wallet.get();
    if (!w.token) return;
    const body = { token: w.token, hash: rec.hash, tokenAddress: rec.token, curve: rec.curve, name: rec.name, ticker: rec.ticker, desc: rec.desc, image: rec.image, twitter: rec.twitter, telegram: rec.telegram, website: rec.website, color: rec.color, face: rec.face, buyHash: rec.buyHash || '', buyWei: rec.buyWei || '', demo: !!w.demo };
    for (let i = 0; i < 4; i++) {
      try {
        const r = await fetch('/api/launch', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
        const out = await r.json();
        if (r.ok) return out;
        if (r.status !== 503) { toast('Not listed on the board: ' + (out.error || r.status), 'bad'); return null; }
      } catch { /* network; try again */ }
      await new Promise((res) => setTimeout(res, 4000 * (i + 1)));
    }
    toast('The board could not confirm the launch on the chain yet; it will be listed when it can.', 'bad');
    return null;
  }
  function fillLaunch(l) {
    $('#lpName').value = l.name; $('#lpTicker').value = l.ticker; $('#lpDesc').value = l.desc || ''; $('#lpFace').value = l.face || 'doge'; $('#lpColor').value = l.color || '#ff7a1a';
    $('#lpImg').value = l.image || ''; $('#lpTwitter').value = l.twitter || ''; $('#lpTelegram').value = l.telegram || ''; $('#lpWebsite').value = l.website || ''; $('#lpBuyback').checked = l.buyback !== false;
    if (l.token) showLaunched(l); else $('#lpDone').hidden = true;
    paintLaunchPreview();
  }
  function showLaunched(l) {
    $('#lpDone').hidden = false;
    $('#lpDoneToken').textContent = l.token;
    $('#lpLinkTx').href = explorerOf() + '/tx/' + l.hash;
    $('#lpLinkToken').href = explorerOf() + '/token/' + l.token;
    $('#lpLinkPons').href = (CONTRACTS.launchpad.pons.site || 'https://ponsfamily.com') + '/launchpad?search=' + l.token;
    const buy = $('#lpDoneBuy');
    if (l.buyHash) {
      buy.hidden = false;
      const eth = window.ethers && l.buyWei ? ethers.formatEther(l.buyWei) : '?';
      const toks = window.ethers && l.buyTokens ? Number(ethers.formatUnits(l.buyTokens, 18)).toLocaleString('en-US', { maximumFractionDigits: 0 }) : null;
      buy.textContent = '';
      buy.append('Opening buy: ');
      const b = document.createElement('b'); b.className = 'mono'; b.textContent = eth + ' ETH'; buy.append(b);
      if (toks) buy.append(' → ' + toks + ' ' + (l.ticker || ''));
      const a = document.createElement('a'); a.href = explorerOf() + '/tx/' + l.buyHash; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'transaction';
      buy.append(' · ', a);
    } else buy.hidden = true;
    $('#lpCardStatus').textContent = 'LIVE · ' + short(l.token) + ' · ROBINHOOD CHAIN';
    $('#lpCopy').onclick = () => copy(l.token, 'Contract address');
  }
  /* The fee Pons quotes right now, shown before anyone presses launch. */
  async function paintLaunchFee() {
    const el = $('#lpFee');
    const provider = WALLET.provider;
    if (!provider || !window.ethers || wallet.get().demo) { el.textContent = 'quoted by Pons when you launch'; return; }
    try {
      const chainId = parseInt(await provider.request({ method: 'eth_chainId' }), 16);
      if (chainId !== CONTRACTS.launchpad.pons.chainId) { el.textContent = 'quoted by Pons on Robinhood Chain (your wallet switches when you launch)'; return; }
      const fee = await CONTRACTS.launchpad.fee(provider);
      el.textContent = ethers.formatEther(fee) + ' ETH';
    } catch { el.textContent = 'quoted by Pons when you launch'; }
  }
  function buildLaunchpad() {
    $('#homeLaunches [data-go="launch"]').addEventListener('click', (e) => { e.preventDefault(); setScreen('launch'); setTimeout(() => $('#community').scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); });
    const sel = $('#lpFace');
    for (const f of RENDER.FACES) { const o = document.createElement('option'); o.value = f; o.textContent = f.toUpperCase(); sel.appendChild(o); }
    sel.value = 'doge';
    $('#launchForm').addEventListener('input', paintLaunchPreview);
    $('#launchForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = lpField();
      if (!f.name || !f.ticker) return toast('A launch needs a name and a ticker', 'bad');
      const list = loadLaunches();
      list.unshift(Object.assign({ id: 'L' + Date.now().toString(36), at: Date.now(), owner: wallet.get().address || null }, f));
      saveLaunches(list);
      paintLaunches();
      SOUND.play('join');
      toast('Draft saved in this browser. Launch it whenever you are ready.', 'good');
      $('#lpCardStatus').textContent = 'DRAFT · SAVED · NOT LAUNCHED';
    });
    /* Launch: one transaction from the wallet to Pons. The states on the
       line under the form are the real ones; nothing is shown that did not
       happen, and the address and links come from the receipt. */
    let launching = false;
    $('#lpDeploy').addEventListener('click', async () => {
      if (launching) return;
      const w = wallet.get();
      if (!w.token) return openWallet();
      const f = lpField();
      if (!f.name || !f.ticker) return toast('A launch needs a name and a ticker', 'bad');
      launching = true; $('#lpDeploy').disabled = true;
      const line = $('#lpTx');
      let buyWei = 0n;
      if (f.buyEth) {
        try { buyWei = ethers.parseEther(f.buyEth); } catch { buyWei = -1n; }
        if (buyWei < 0n) { launching = false; $('#lpDeploy').disabled = false; return toast('The opening buy has to be an amount of ETH, like 0.05', 'bad'); }
      }
      const off = CONTRACTS.onTx((tx) => {
        if (tx.kind !== 'launch' && tx.kind !== 'buy') return;
        line.hidden = false; line.dataset.status = tx.status;
        const fee = tx.kind === 'launch' && tx.fee !== undefined && window.ethers ? ' · fee ' + ethers.formatEther(tx.fee) + ' ETH' : '';
        const amt = tx.kind === 'buy' && tx.wei !== undefined && window.ethers ? ' · ' + ethers.formatEther(tx.wei) + ' ETH' : '';
        $('#lpTxText').textContent = CONTRACTS.labels[tx.status] + ' · ' + CONTRACTS.kinds[tx.kind] + fee + amt + (tx.hash ? ' · ' + tx.hash.slice(0, 12) + '…' : '') + (tx.error ? ' · ' + tx.error : '');
      });
      try {
        const { tx, res } = await CONTRACTS.launchpad.createToken(w, f);
        if (tx.status === 'confirmed' && res && res.token) {
          const list = loadLaunches();
          const rec = Object.assign({ id: 'L' + Date.now().toString(36), at: Date.now(), owner: w.address, token: res.token, curve: res.curve, hash: res.hash, feeWei: res.feeWei }, f);
          list.unshift(rec);
          saveLaunches(list); paintLaunches(); showLaunched(rec);
          SOUND.play('win');
          toast('Launched on Pons: ' + short(res.token), 'good');
          /* the opening buy: a second transaction on the new curve */
          if (buyWei > 0n && res.curve) {
            const b = await CONTRACTS.launchpad.openingBuy(w, res.curve, res.token, buyWei);
            if (b.tx.status === 'confirmed') {
              rec.buyHash = b.res.hash; rec.buyWei = b.res.wei; rec.buyTokens = b.res.tokens;
              saveLaunches(list); showLaunched(rec);
              toast('Opening buy in: ' + ethers.formatEther(buyWei) + ' ETH on the curve', 'good');
            } else SOUND.play('error');
          }
          reportLaunch(rec);
        } else if (tx.status === 'confirmed') {
          toast('The transaction went through but no TokenLaunched event was found; check it on the explorer.', 'bad');
        } else SOUND.play('error');
      } finally { off(); launching = false; $('#lpDeploy').disabled = false; }
    });
    paintLaunchPreview();
    paintLaunches();
  }

  /* ---- camera & sound buttons ------------------------------------------------ */

  $$('.cam').forEach((b) => b.addEventListener('click', () => {
    $$('.cam').forEach((x) => x.classList.toggle('is-on', x === b));
    ui.set({ cameraMode: b.dataset.cam });
    CAMERA.setMode(b.dataset.cam);
  }));
  /* No sound button on the page: cues stay off unless someone turns them on
     from the console with SOUND.toggle(), and there is no music. */
  $('#gl').addEventListener('click', () => { if (mode === 'preview') stir(); });

  /* ---- boot ------------------------------------------------------------------ */

  function boot() {
    loadSkin();
    buildPickers();
    bindBack();
    buildLaunchpad();
    buildFloaters();
    setTheme(themeName());
    paintYou();
    try {
      const saved = JSON.parse(localStorage.getItem('mr.session') || 'null');
      if (saved && saved.address && saved.token) signedIn(saved);
    } catch {}
    paintWallet();
    const start = () => {
      SCENE.init($('#gl'));
      if (current) SCENE.setRace(current, game.get().race ? playersOf(game.get().race) : [], wallet.get().address);
      applyBackdrop();
      queueUpgrade();
      upgradeMarbles();
    };
    if (window.THREE) start(); else addEventListener('three-ready', start, { once: true });
    setScreen('home');
    showNotice();
    connectStream();
    requestAnimationFrame(frame);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) lastTs = 0; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  window.MR = { setScreen, join, vote, openWinners, connectDemo, connectWith, get current() { return current; }, get mode() { return mode; } };
})();
