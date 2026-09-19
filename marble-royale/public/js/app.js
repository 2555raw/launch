/* MARBLE ROYALE - the app.

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

  const SCREENS = ['home', 'lobby', 'count', 'race', 'results', 'launch'];
  function setScreen(name) {
    if (!SCREENS.includes(name)) return;
    ui.set({ screen: name });
    for (const s of SCREENS) $('#s-' + s).hidden = s !== name;
    document.body.dataset.screen = name;
    if (name === 'home' || name === 'launch') { CAMERA.setMode('idle'); window.scrollTo(0, 0); }
    else if (name === 'race') CAMERA.setMode(ui.get().cameraMode === 'auto' ? 'auto' : ui.get().cameraMode);
    else CAMERA.setMode('auto');
    if (name !== 'home') window.scrollTo(0, 0);
    if (SCENE.ready) SCENE.setBackdrop(name === 'race' || name === 'count' ? 'dark' : 'light');
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
    if (round.seed === null || round.seed === undefined || !round.players.length) return;
    const players = playersOf(round);
    current = RACE.createRace(round.seed, players.map((p) => ({ id: p.address })), { mode: round.mode });
    let guard = 0;
    while (!current.over && guard++ < RACE.MAX_SECONDS * 60 + 10) RACE.step(current);
    for (let i = 0; i < 60; i++) RACE.step(current);
    mode = 'done';
    if (SCENE.ready) SCENE.setRace(current, players, wallet.get().address);
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
      if (ui.get().screen === 'lobby' || ui.get().screen === 'home') setScreen('race');
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
    es.addEventListener('chat', (e) => feed(JSON.parse(e.data)));
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
    game.set({ config: s.config, offset: s.now - Date.now(), watching: s.watching, recent: s.recent, top: s.top, schedule: s.schedule || [] });
    applyConfig(s.config);
    paintModes();
    $('#feed').innerHTML = '';
    for (const m of s.chat || []) feed(m, true);
    onPhase(s.round);
    paintRaces();
  }

  function applyConfig(c) {
    if (!c) return;
    $('#demoRow').hidden = !c.demoMode;
    $('#loEntry').textContent = c.entry || 'FREE';
    if (c.mint) { $('#caBtn').hidden = false; $('#caVal').textContent = short(c.mint); $('#caBtn').title = c.mint; $('#caBtn').onclick = () => copy(c.mint, 'Contract address'); }
    if (c.links && c.links.x) { $('#xLink').hidden = false; $('#xLink').href = c.links.x; }
    document.title = (c.coin || 'MARBLE ROYALE') + ' · race your marble';
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
      if (fresh || mode === 'idle' || mode === 'preview') replayFinished(round);
      if (round.winner && ui.get().screen !== 'results' && ui.get().screen !== 'home' && ui.get().screen !== 'launch') showResults({ winner: round.winner, order: round.order, pot: round.pot, number: round.number, mega: round.mega, mode: round.mode });
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
    paintStatic();
    if (r) drainPot(r);
    setTimeout(() => { showResults(d); paintPoll(); }, 1400);
    SOUND.play('finish');
    if (SCENE.ready) SCENE.celebrate(d.winner);
    fetch('/api/history?n=12').then((x) => x.json()).then((h) => game.set({ recent: h.rounds, top: h.top })).catch(() => {});
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
    const text = { filling: 'filling', locked: 'locked for the race', paid: 'paid to the winner' }[state];
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
    $('#topRaceNo').textContent = 'RACE ' + no;
    $('#topPhase').textContent = { lobby: 'LOBBY', locked: 'LOCKED', racing: 'LIVE', result: 'RESULT' }[r.phase] || r.phase.toUpperCase();
    $('#lbNo').textContent = no; $('#loNo').textContent = no; $('#hudNo').textContent = 'RACE ' + no;
    const potText = usd(r.pot) + (r.potDemo ? ' ·demo' : '');
    $('#lbPot').textContent = potText; $('#loPot').textContent = potText;
    paintPot();
    $('#lbPlayers').textContent = r.players.length + ' / ' + r.max; $('#loPlayers').textContent = r.players.length + ' / ' + r.max;
    $('#loMega').hidden = !r.mega;
    $('#commitLine').textContent = r.commit ? 'seed commit · ' + r.commit : '';
    $('#hudTrack').textContent = current ? (modeInfo(current.course.mode).name.toUpperCase() + ' · ' + RENDER.THEMES[(current.course.theme || 0) % RENDER.THEMES.length].name.toUpperCase() + ' · ' + current.course.sections.length + ' SECTIONS') : '';
    $('#dockPot').textContent = usd(r.pot);
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
    const tick = () => {
      const next = document.querySelector('.mode__img[data-flat]');
      if (!next || !SCENE.ready || !SCENE.snapshot) { upgrading = false; return; }
      fillPic(next);
      setTimeout(tick, 60);
    };
    setTimeout(tick, 200);
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
      const pot = i === 0 && r ? usd(r.pot) : (s.mega ? '$25.00' : '$4 – $7.50');
      const track = s.mode ? modeInfo(s.mode).name : 'Decided by vote';
      card.innerHTML =
        '<div class="race__no"><b>RACE #' + pad(s.number) + '</b>' + (s.mega ? '<span class="pill pill--mega">MEGA</span>' : (s.open ? '<span class="pill pill--phase">OPEN</span>' : '<span class="pill">QUEUED</span>')) + '</div>' +
        '<div class="race__track' + (s.mode ? '' : ' is-tbd') + '"><em>TRACK</em><b></b></div>' +
        '<div class="race__stats"><div><em>PLAYERS</em><b>' + s.count + ' / ' + s.max + '</b></div><div><em>ENTRY</em><b>FREE</b></div><div><em>PRIZE</em><b class="gold">' + pot + '</b></div><div><em>STARTING IN</em><b class="race__in">' + fmt(s.raceAt - serverNow()) + '</b></div></div>' +
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

  const cardCanvas = new Map();
  function marbleCanvas(p, size) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size * 2;
    const ctx = cv.getContext('2d');
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
    if (!w.address) { btn.disabled = false; btn.textContent = 'Connect to join'; btn.onclick = () => openWallet(); return; }
    btn.onclick = () => join();
    if (joined) { btn.disabled = true; btn.textContent = "You're in ✓"; }
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
    setScreen('results');
  }

  /* ---- feed & chat --------------------------------------------------------- */

  function feed(m, quiet) {
    const li = document.createElement('li');
    if (m.sys) { li.className = 'sys'; li.textContent = m.text; }
    else { const b = document.createElement('b'); b.textContent = short(m.from) + ' '; li.append(b, document.createTextNode(m.text)); }
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
    $('#walletHint').textContent = list.length ? '' : (WALLET.isMobile() ? 'No wallet found in this browser. Open this page inside MetaMask or Phantom.' : 'No wallet found. Install MetaMask or Phantom, or use the demo wallet.');
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
  $('#demoBtn').addEventListener('click', connectDemo);

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
    const btn = $('#walletBtn');
    if (w.address) {
      $('#walletLabel').textContent = (w.demo ? 'DEMO · ' : '') + short(w.address);
      btn.classList.remove('btn--accent'); btn.classList.add('btn--glass');
      $('#netPill').hidden = !w.network || w.demo; $('#netName').textContent = w.network;
      $('#accKind').textContent = w.label + (w.demo ? '' : ' · connected');
      $('#accAddr').textContent = w.address;
      $('#accNet').textContent = w.demo ? 'no network' : (w.network || 'unknown network'); $('#accNet').hidden = w.demo;
      $('#accDemo').hidden = !w.demo;
      $('#accStats').textContent = w.stats ? w.stats.wins + ' wins · ' + w.stats.races + ' races' : '';
    } else {
      $('#walletLabel').textContent = 'Connect wallet';
      btn.classList.add('btn--accent'); btn.classList.remove('btn--glass');
      $('#netPill').hidden = true;
    }
    $('#dockWallet').textContent = w.address ? short(w.address) : 'Wallet';
  }
  $('#walletBtn').addEventListener('click', openWallet);
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
  }
  function paintYou() {
    const skin = ui.get().skin;
    const w = wallet.get();
    for (const id of ['#youPrev', '#skinPrev']) {
      const cv = $(id); const size = cv.width / 2; const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.save(); ctx.scale(2, 2);
      ctx.drawImage(SKINS.swatch(skin.material, skin.color), size * 0.1, size * 0.1, size * 0.8, size * 0.8);
      RENDER.drawFace(ctx, size / 2, size / 2, size * 0.33, skin.face);
      ctx.restore();
    }
    $('#youName').textContent = skin.name || (w.address ? short(w.address) : '—');
    $('#youAddr').textContent = w.address ? w.address : 'connect a wallet';
    $('#youMat').textContent = SKINS.LABELS[skin.material] + ' · ' + skin.face.toUpperCase();
    $('#skinName').value = skin.name || '';
    $$('.mt').forEach((b) => b.classList.toggle('on', b.dataset.v === skin.material));
    $$('.fc').forEach((b) => b.classList.toggle('on', b.dataset.v === skin.face));
    $$('.sw').forEach((b) => b.classList.toggle('on', b.dataset.v === skin.color));
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
    $('#skinBtn').addEventListener('click', () => { SOUND.wake(); openModal('m-skin'); });
  }

  /* ---- the hero's floating coins and the window onto the track ---------------- */

  /* Coin marbles drift round the headline, drawn with the same routine the
     pickers use, so they are the marbles that race. A few are blurred, for
     depth. Below the fold a soft window in the page's veil shows the live
     world underneath; its place follows the stage element on every frame. */
  function buildFloaters() {
    const host = $('#floaters');
    const spots = [
      { x: 8, y: 14, s: 96, f: 'btc', m: 'metal', c: '#ffd36e', b: 0 }, { x: 18, y: 62, s: 72, f: 'doge', m: 'glass', c: '#ff7a1a', b: 2 },
      { x: 84, y: 10, s: 84, f: 'eth', m: 'chrome', c: '#b98bff', b: 0 }, { x: 90, y: 58, s: 110, f: 'sol', m: 'holo', c: '#6ee7ff', b: 1.5 },
      { x: 4, y: 40, s: 56, f: 'pepe', m: 'neon', c: '#7dff9b', b: 3 }, { x: 74, y: 78, s: 64, f: 'hood', m: 'galaxy', c: '#ff5ea8', b: 0 },
      { x: 28, y: 6, s: 52, f: 'usdc', m: 'clear', c: '#4cd9ff', b: 2.5 }, { x: 62, y: 4, s: 60, f: 'shib', m: 'lava', c: '#ff8a4c', b: 0 }
    ];
    spots.forEach((sp, i) => {
      const cv = marbleCanvas({ material: sp.m, color: sp.c, face: sp.f }, sp.s);
      cv.className = 'floater';
      cv.style.left = sp.x + '%'; cv.style.top = sp.y + '%';
      cv.style.width = cv.style.height = sp.s + 'px';
      cv.style.filter = sp.b ? 'blur(' + sp.b + 'px)' : '';
      cv.style.opacity = sp.b ? String(0.75 - sp.b * 0.08) : '1';
      cv.style.animationDelay = (-i * 1.3) + 's';
      cv.style.animationDuration = (7 + (i % 4) * 1.5) + 's';
      host.appendChild(cv);
    });
  }
  function placeStage() {
    const veil = $('.veil');
    const screen = ui.get().screen;
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

  /* ---- the dock ---------------------------------------------------------------- */

  /* A taskbar along the bottom: every screen one tap away, the race's phase
     and clock always in view. It steps aside for the countdown and the race
     itself, which are the one time the whole screen is the track. */
  function paintDock() {
    const screen = ui.get().screen;
    const on = { home: 'home', lobby: 'lobby', results: 'lobby', race: 'lobby', count: 'lobby', launch: 'launch' }[screen];
    $$('.dock__it').forEach((b) => b.classList.toggle('is-on', b.dataset.dock === on));
  }
  $$('.dock__it').forEach((b) => b.addEventListener('click', () => {
    SOUND.wake();
    const go = b.dataset.dock;
    if (go === 'home' || go === 'lobby' || go === 'launch') {
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

  /* ---- the launchpad -------------------------------------------------------------- */

  /* A launch is a draft of a token with races of its own, kept in this
     browser. Deploying it goes through CONTRACTS.launchpad, which tells the
     truth about there being no contract yet rather than inventing a receipt. */
  const LAUNCH_KEY = 'mr.launches';
  const loadLaunches = () => { try { return JSON.parse(localStorage.getItem(LAUNCH_KEY) || '[]'); } catch { return []; } };
  const saveLaunches = (list) => { try { localStorage.setItem(LAUNCH_KEY, JSON.stringify(list.slice(0, 20))); } catch {} };
  const lpField = () => ({
    name: $('#lpName').value.trim().slice(0, 24),
    ticker: $('#lpTicker').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8),
    desc: $('#lpDesc').value.trim().slice(0, 120),
    face: $('#lpFace').value,
    color: $('#lpColor').value,
    every: Number($('#lpEvery').value) || 5,
    share: Number($('#lpShare').value) || 100,
    min: Math.max(0, Number($('#lpMin').value) || 0),
    image: $('#lpImg').value.trim().slice(0, 300)
  });
  function paintLaunchPreview() {
    const f = lpField();
    $('#lpShareVal').textContent = f.share + '%';
    $('#lpCardName').textContent = f.name || 'Your token';
    $('#lpCardTicker').textContent = '$' + (f.ticker || 'TICKER');
    $('#lpCardDesc').textContent = f.desc || 'One line about it goes here.';
    $('#lpCardEvery').textContent = f.every + ' MIN';
    $('#lpCardShare').textContent = f.share + '%';
    $('#lpCardMin').textContent = f.min ? f.min.toLocaleString('en-US') + '+' : 'NO';
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
  function paintLaunches() {
    const list = loadLaunches();
    const ul = $('#lpList'); ul.innerHTML = '';
    $('#lpEmpty').hidden = list.length > 0;
    for (const l of list) {
      const li = document.createElement('li');
      const cv = marbleCanvas({ material: 'glass', color: l.color, face: l.face }, 30);
      const meta = document.createElement('div');
      const b = document.createElement('b'); b.textContent = l.name + ' · $' + l.ticker;
      const sp = document.createElement('span'); sp.className = 'mono dim'; sp.textContent = 'every ' + l.every + ' min · winner ' + l.share + '% · ' + (l.deployed ? 'deployed' : 'draft, not deployed');
      meta.append(b, sp);
      const x = document.createElement('button'); x.className = 'x'; x.type = 'button'; x.textContent = '×'; x.title = 'remove';
      x.addEventListener('click', () => { saveLaunches(loadLaunches().filter((q) => q.id !== l.id)); paintLaunches(); });
      li.append(cv, meta, x);
      li.addEventListener('click', (e) => { if (e.target === x) return; fillLaunch(l); });
      ul.appendChild(li);
    }
  }
  function fillLaunch(l) {
    $('#lpName').value = l.name; $('#lpTicker').value = l.ticker; $('#lpDesc').value = l.desc || ''; $('#lpFace').value = l.face; $('#lpColor').value = l.color;
    $('#lpEvery').value = String(l.every); $('#lpShare').value = String(l.share); $('#lpMin').value = String(l.min || 0); $('#lpImg').value = l.image || '';
    paintLaunchPreview();
  }
  function buildLaunchpad() {
    const sel = $('#lpFace');
    for (const f of RENDER.FACES) { const o = document.createElement('option'); o.value = f; o.textContent = f.toUpperCase(); sel.appendChild(o); }
    sel.value = 'doge';
    $('#launchForm').addEventListener('input', paintLaunchPreview);
    $('#launchForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = lpField();
      if (!f.name || !f.ticker) return toast('A launch needs a name and a ticker', 'bad');
      const list = loadLaunches();
      const id = 'L' + Date.now().toString(36);
      list.unshift(Object.assign({ id, at: Date.now(), deployed: false, owner: wallet.get().address || null }, f));
      saveLaunches(list);
      paintLaunches();
      SOUND.play('join');
      toast('Saved as a draft. It deploys when the launchpad contract is live.', 'good');
      $('#lpCardStatus').textContent = 'DRAFT · SAVED · NOT DEPLOYED';
    });
    $('#lpDeploy').addEventListener('click', async () => {
      const w = wallet.get();
      if (!w.token) return openWallet();
      const f = lpField();
      if (!f.name || !f.ticker) return toast('A launch needs a name and a ticker', 'bad');
      const { tx } = await CONTRACTS.launchpad.createToken(w, f);
      const line = $('#lpTx');
      line.hidden = false; line.dataset.status = tx.status;
      $('#lpTxText').textContent = CONTRACTS.labels[tx.status] + ' · deploy' + (tx.error ? ' · ' + tx.error : '');
      if (tx.status === 'failed') SOUND.play('error');
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
  $('#soundBtn').addEventListener('click', () => { $('#soundBtn').style.opacity = SOUND.toggle() ? 1 : 0.4; });
  $('#gl').addEventListener('click', () => { if (mode === 'preview') stir(); });

  /* ---- boot ------------------------------------------------------------------ */

  function boot() {
    loadSkin();
    buildPickers();
    buildLaunchpad();
    buildFloaters();
    paintYou();
    $('#soundBtn').style.opacity = SOUND.on ? 1 : 0.4;
    try {
      const saved = JSON.parse(localStorage.getItem('mr.session') || 'null');
      if (saved && saved.address && saved.token) signedIn(saved);
    } catch {}
    paintWallet();
    const start = () => {
      SCENE.init($('#gl'));
      if (current) SCENE.setRace(current, game.get().race ? playersOf(game.get().race) : [], wallet.get().address);
      SCENE.setBackdrop(ui.get().screen === 'race' || ui.get().screen === 'count' ? 'dark' : 'light');
      queueUpgrade();
    };
    if (window.THREE) start(); else addEventListener('three-ready', start, { once: true });
    setScreen('home');
    connectStream();
    requestAnimationFrame(frame);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) lastTs = 0; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  window.MR = { setScreen, join, vote, openWinners, get current() { return current; }, get mode() { return mode; } };
})();
