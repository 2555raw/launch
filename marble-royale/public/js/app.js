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

  const SCREENS = ['home', 'lobby', 'count', 'race', 'results'];
  function setScreen(name) {
    if (!SCREENS.includes(name)) return;
    ui.set({ screen: name });
    for (const s of SCREENS) $('#s-' + s).hidden = s !== name;
    document.body.dataset.screen = name;
    if (name === 'home') { CAMERA.setMode('idle'); window.scrollTo(0, 0); }
    else if (name === 'race') CAMERA.setMode(ui.get().cameraMode === 'auto' ? 'auto' : ui.get().cameraMode);
    else CAMERA.setMode('auto');
    if (name !== 'home') window.scrollTo(0, 0);
  }
  $$('[data-go]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); SOUND.wake(); setScreen(b.dataset.go); }));

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
    current = RACE.createRace(seed, round.players.map((p) => ({ id: p.address })), { hold: true });
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
    current = RACE.createRace(d.seed, players.map((p) => ({ id: p.address })));
    mode = 'race';
    raceStartAt = d.startAt;
    if (SCENE.ready) SCENE.setRace(current, players, wallet.get().address);
  }
  function replayFinished(round) {
    if (round.seed === null || round.seed === undefined || !round.players.length) return;
    const players = playersOf(round);
    current = RACE.createRace(round.seed, players.map((p) => ({ id: p.address })));
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

    if (fresh) { countdownShown = -1; $('#countNum').classList.remove('go'); }

    if (round.phase === 'lobby' || (round.phase === 'locked' && mode !== 'race')) {
      if (fresh || mode === 'idle' || mode === 'done') startPreview(round); else syncPreview(round);
      if (fresh && ui.get().screen === 'results') { /* stay on results until they choose */ }
      if (round.phase === 'lobby' && me && $('#autoJoin').checked && !joined) join(true);
    } else if (round.phase === 'racing') {
      if (mode !== 'race' && round.seed !== null) startLive({ seed: round.seed, startAt: round.raceAt, players: round.players });
      if (ui.get().screen !== 'race') setScreen('race');
    } else if (round.phase === 'result') {
      if (fresh || mode === 'idle' || mode === 'preview') replayFinished(round);
      if (round.winner && ui.get().screen !== 'results' && ui.get().screen !== 'home') showResults({ winner: round.winner, order: round.order, pot: round.pot, number: round.number, mega: round.mega });
    }
    paintStatic();
    paintLobby();
    paintRaces();
  }

  function onJoin(d) {
    const r = game.get().race;
    if (!r || d.roundId !== r.id) return;
    if (!r.players.some((p) => p.address === d.player.address)) r.players.push(d.player);
    game.set({ race: r });
    if (mode === 'preview') syncPreview(r);
    const me = wallet.get().address;
    if (same(d.player.address, me)) { ui.set({ joined: true }); SOUND.play('join'); }
    feed({ sys: true, text: (d.player.name || short(d.player.address)) + ' joined · ' + d.count + '/' + r.max });
    paintLobby();
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
    if (r) { r.phase = 'result'; r.winner = d.winner; r.order = d.order; game.set({ race: r }); }
    document.body.dataset.phase = 'result';
    game.set({ result: d });
    paintStatic();
    setTimeout(() => showResults(d), 1400);
    SOUND.play('finish');
    if (SCENE.ready) SCENE.celebrate(d.winner);
    fetch('/api/history?n=12').then((x) => x.json()).then((h) => game.set({ recent: h.rounds, top: h.top })).catch(() => {});
  }

  function onPot(d) {
    const r = game.get().race;
    if (r && d.roundId === r.id) { r.pot = d.pot; r.potDemo = !!d.demo; game.set({ race: r }); paintStatic(); }
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
    $('#lbPlayers').textContent = r.players.length + ' / ' + r.max; $('#loPlayers').textContent = r.players.length + ' / ' + r.max;
    $('#loMega').hidden = !r.mega;
    $('#commitLine').textContent = r.commit ? 'seed commit · ' + r.commit : '';
    $('#hudTrack').textContent = current ? (RENDER.THEMES[(current.course.theme || 0) % RENDER.THEMES.length].name.toUpperCase() + ' · ' + current.course.sections.length + ' SECTIONS') : '';
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
      const pot = i === 0 && r ? usd(r.pot) : (s.mega ? '$25.00' : '$3 – $7');
      card.innerHTML =
        '<div class="race__no"><b>RACE #' + pad(s.number) + '</b>' + (s.mega ? '<span class="pill pill--mega">MEGA</span>' : (s.open ? '<span class="pill pill--phase">OPEN</span>' : '<span class="pill">QUEUED</span>')) + '</div>' +
        '<div class="race__stats"><div><em>PLAYERS</em><b>' + s.count + ' / ' + s.max + '</b></div><div><em>ENTRY</em><b>FREE</b></div><div><em>PRIZE</em><b class="gold">' + pot + '</b></div><div><em>STARTING IN</em><b class="race__in">' + fmt(s.raceAt - serverNow()) + '</b></div></div>' +
        '<div class="race__bar"><i style="width:' + Math.min(100, (s.count / s.max) * 100) + '%"></i></div>';
      const btn = document.createElement('button');
      btn.className = 'btn ' + (s.open ? 'btn--accent' : 'btn--glass');
      btn.textContent = s.open ? 'Join race' : 'Queue for this race';
      btn.addEventListener('click', () => { SOUND.wake(); setScreen('lobby'); if (s.open) join(); else { $('#autoJoin').checked = true; localStorage.setItem('mr.auto', 'on'); toast('You will be entered when it opens', 'good'); } });
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
    $('#resNo').textContent = '#' + pad(d.number || (r && r.number) || 0);
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
    if (!r || r.phase !== 'lobby') { if (!silent) toast('The queue is closed. You are in the next one.'); $('#autoJoin').checked = true; return; }
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
  $('#autoJoin').addEventListener('change', () => {
    localStorage.setItem('mr.auto', $('#autoJoin').checked ? 'on' : 'off');
    if ($('#autoJoin').checked) { toast('Auto-join is on. A marble is yours every race.', 'good'); join(true); }
  });
  $('#raceAgain').addEventListener('click', () => { SOUND.wake(); $('#autoJoin').checked = true; localStorage.setItem('mr.auto', 'on'); setScreen('lobby'); join(true); });
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
    paintYou();
    $('#soundBtn').style.opacity = SOUND.on ? 1 : 0.4;
    try { $('#autoJoin').checked = localStorage.getItem('mr.auto') === 'on'; } catch {}
    try {
      const saved = JSON.parse(localStorage.getItem('mr.session') || 'null');
      if (saved && saved.address && saved.token) signedIn(saved);
    } catch {}
    paintWallet();
    const start = () => {
      SCENE.init($('#gl'));
      if (current) SCENE.setRace(current, game.get().race ? playersOf(game.get().race) : [], wallet.get().address);
    };
    if (window.THREE) start(); else addEventListener('three-ready', start, { once: true });
    setScreen('home');
    connectStream();
    requestAnimationFrame(frame);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) lastTs = 0; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  window.MR = { setScreen, join, get current() { return current; }, get mode() { return mode; } };
})();
