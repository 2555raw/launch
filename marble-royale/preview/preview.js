/* MARBLE ROYALE - the preview.

   The race here is the real one: shared/race.js and render.js are inlined above,
   byte for byte from the app. What is missing is everything that needs a server
   - the wallet signature, the field shared between strangers, the seed
   committed before anyone joins, the fees read off the chain. Those live in
   marble-royale/ in the repository and run wherever Node runs.

   So this page keeps the five minute clock and the look, fills the grid with
   demonstration marbles, and lets anyone press a button to race immediately. */

(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const ROUND_MS = 300000;
  const LOBBY_MS = 240000;          /* joining closes here */
  const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

  /* The renderer labels your own marble through I18N; the app ships the real
     dictionary, this page needs one word of it. */
  window.I18N = { t: (k) => (k === 'field.you' ? 'tú' : k) };

  const S = {
    phase: 'lobby',
    roundStart: Math.floor(Date.now() / ROUND_MS) * ROUND_MS,
    players: [],
    me: null,
    race: null,
    preview: null,
    startedAt: 0,
    pot: 0.18 + Math.random() * 0.5,
    resultUntil: 0,
    past: []
  };

  const short = (a) => a.slice(0, 4) + '…' + a.slice(-4);
  const sol = (v) => v.toFixed(3).replace('.', ',');

  /* Demonstration wallets. They are the right shape and belong to nobody. */
  function fakeAddress() {
    let s = '';
    for (let i = 0; i < 44; i++) s += B58[(Math.random() * B58.length) | 0];
    return s;
  }
  function colorOf(address) {
    let h = 2166136261;
    for (let i = 0; i < address.length; i++) { h ^= address.charCodeAt(i); h = Math.imul(h, 16777619); }
    h = h >>> 0;
    return 'hsl(' + (h % 360) + ' ' + (62 + (h >>> 9) % 26) + '% ' + (52 + (h >>> 17) % 14) + '%)';
  }

  function toast(text) {
    const old = document.querySelector('.toast');
    if (old) old.remove();
    const n = document.createElement('div');
    n.className = 'toast';
    n.textContent = text;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 3200);
  }

  function copy(text) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast('Dirección copiada'), () => {});
  }

  /* ---- the field --------------------------------------------------------- */

  function addMarble(address, mine) {
    if (S.players.some((p) => p.address === address)) return;
    const p = { address, color: colorOf(address), mine: !!mine };
    S.players.push(p);
    if (S.preview && S.phase === 'lobby') {
      RACE.addBall(S.preview, address);
      RENDER.addPlayer(address, p.color, p.mine);
      stir();
    }
    renderField();
    say();
  }

  const addBots = (n) => { for (let i = 0; i < n; i++) addMarble(fakeAddress(), false); };

  async function joinWithWallet() {
    const w = window.phantom?.solana || (window.solflare?.isSolflare ? window.solflare : null) ||
              window.backpack?.solana || window.solana;
    if (w && w.connect) {
      try {
        const res = await w.connect();
        const key = (res && res.publicKey) || w.publicKey;
        if (key) {
          S.me = key.toString();
          addMarble(S.me, true);
          $('#joinBtn').disabled = true;
          $('#joinBtn').textContent = short(S.me);
          toast('Tu cartera está en la parrilla');
          return;
        }
      } catch { toast('Has cancelado la conexión'); return; }
    }
    S.me = fakeAddress();
    addMarble(S.me, true);
    $('#joinBtn').disabled = true;
    $('#joinBtn').textContent = 'TÚ · demo';
    toast('Sin cartera en este navegador: te metemos con una de demostración');
  }

  /* ---- the round --------------------------------------------------------- */

  function openLobby() {
    S.phase = 'lobby';
    /* Open on the next whole window whenever this one has no lobby left, so a
       page opened at four minutes past does not fire a race in its first frame
       and then loop. */
    S.roundStart = Math.floor(Date.now() / ROUND_MS) * ROUND_MS;
    while (Date.now() > S.roundStart + LOBBY_MS - 20000) S.roundStart += ROUND_MS;
    S.race = null;
    $('#card').hidden = true;
    document.body.dataset.phase = 'lobby';
    const seed = (Date.now() / ROUND_MS) | 0;
    S.preview = RACE.createRace(seed >>> 0, S.players.map((p) => ({ id: p.address })), { hold: true });
    RENDER.setRace(S.preview, S.players, S.me);
    stir();
    renderField();
    say();
  }

  function startRace() {
    if (S.phase === 'racing' || !S.players.length) return;
    S.phase = 'racing';
    document.body.dataset.phase = 'racing';
    $('#card').hidden = true;
    const seed = (Math.random() * 0xffffffff) >>> 0;
    S.race = RACE.createRace(seed, S.players.map((p) => ({ id: p.address })));
    RENDER.setRace(S.race, S.players, S.me);
    S.startedAt = performance.now();
    banner('¡YA!');
    say();
  }

  function finishRace() {
    S.phase = 'result';
    document.body.dataset.phase = 'result';
    const winner = S.race.finished[0];
    const pot = S.pot;
    $('#card').hidden = false;
    $('#winAddr').textContent = winner.id;
    $('#winPay').textContent = sol(pot) + ' SOL para esta cartera';
    $('#winYou').hidden = winner.id !== S.me;
    RENDER.celebrate(winner.id);
    S.past.unshift({ at: Date.now(), winner: winner.id, pot, n: S.players.length });
    S.past.length = Math.min(S.past.length, 12);
    S.resultUntil = Date.now() + 12000;
    savePast();
    renderPast();
    renderField();
    S.pot = 0.12 + Math.random() * 0.6;
    say();
    setTimeout(() => { if (S.phase === 'result') openLobby(); }, 12000);
  }

  function banner(text) {
    const b = $('#banner');
    b.hidden = false;
    b.textContent = text;
    clearTimeout(banner.t);
    banner.t = setTimeout(() => { b.hidden = true; }, 1700);
  }

  function say() {
    const n = S.players.length;
    const msg = {
      lobby: n ? '<b>' + n + ' canicas</b> en la parrilla. La primera en cruzar la meta se lleva el bote.'
                : 'Parrilla vacía. Mete canicas y dale a correr.',
      racing: 'Han salido.',
      result: 'Carrera terminada. Esa es la cartera a la que pagarías.'
    }[S.phase];
    $('#status').innerHTML = msg;
    $('#runBtn').disabled = S.phase === 'racing' || !n;
  }

  /* ---- panels ------------------------------------------------------------ */

  function renderField() {
    const ul = $('#field');
    ul.innerHTML = '';
    $('#count').textContent = S.players.length + ' canicas';
    $('#hudCount').textContent = S.players.length + ' compitiendo';
    const state = S.race || S.preview;
    const rank = new Map();
    if (state) {
      [...state.balls].sort((a, b) => {
        if (a.done && b.done) return a.place - b.place;
        if (a.done) return -1;
        if (b.done) return 1;
        return b.y - a.y;
      }).forEach((b, i) => rank.set(b.id, i + 1));
    }
    const lead = state && state.leader ? state.leader.id : null;
    const order = [...S.players].sort((a, b) => (rank.get(a.address) || 99) - (rank.get(b.address) || 99));
    for (const p of order) {
      const ball = state && state.balls.find((b) => b.id === p.address);
      const li = document.createElement('li');
      if (p.mine) li.className = 'me';
      else if (S.phase === 'racing' && p.address === lead) li.className = 'lead';
      const n = document.createElement('span'); n.className = 'n';
      n.textContent = rank.get(p.address) || '·';
      const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = p.color;
      const who = document.createElement('span'); who.className = 'who';
      who.textContent = short(p.address) + (p.mine ? ' (tú)' : '');
      const t = document.createElement('span'); t.className = 't';
      if (ball && ball.done) { t.textContent = ball.time.toFixed(1) + 's'; li.classList.add('out'); }
      li.append(n, dot, who, t);
      ul.appendChild(li);
    }
  }

  function renderPast() {
    const ul = $('#past');
    ul.innerHTML = '';
    if (!S.past.length) {
      const li = document.createElement('li');
      li.textContent = 'Aún no hay carreras en esta sesión.';
      li.style.color = 'var(--dim)';
      ul.appendChild(li);
      return;
    }
    for (const r of S.past) {
      const li = document.createElement('li');
      const row = document.createElement('div'); row.className = 'row';
      const when = document.createElement('span');
      when.textContent = new Date(r.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · ' + r.n + ' canicas';
      const amt = document.createElement('span');
      amt.style.color = 'var(--gold)';
      amt.textContent = sol(r.pot) + ' SOL';
      row.append(when, amt);
      const a = document.createElement('div'); a.className = 'a';
      a.textContent = r.winner;
      a.title = 'copiar';
      a.addEventListener('click', () => copy(r.winner));
      li.append(row, a);
      ul.appendChild(li);
    }
  }

  function savePast() {
    try { localStorage.setItem('mr.preview.past', JSON.stringify(S.past)); } catch {}
  }
  function loadPast() {
    try {
      const raw = JSON.parse(localStorage.getItem('mr.preview.past') || '[]');
      if (Array.isArray(raw)) S.past = raw.slice(0, 12);
    } catch {}
  }

  /* ---- the loop ---------------------------------------------------------- */

  let last = 0, acc = 0, stirred = 0, settled = false, check = 0;
  const stir = () => { stirred = performance.now(); settled = false; };

  function busy(ts) {
    if (!settled && ts - stirred < 4000) return true;
    if (ts - check > 400) {
      check = ts;
      let fastest = 0;
      for (const b of S.preview.balls) {
        const sp = b.vx * b.vx + b.vy * b.vy;
        if (sp > fastest) fastest = sp;
      }
      settled = fastest < 400;
    }
    return !settled;
  }

  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016);
    last = ts;

    if (S.phase === 'racing' && S.race) {
      const due = (ts - S.startedAt) / 1000;
      let guard = 0;
      while (S.race.t < due && !S.race.over && guard++ < 200) RACE.step(S.race);
      if (S.race.over) finishRace();
      renderField();
    } else if (S.phase === 'result' && S.race) {
      let guard = 0;
      acc += dt;
      while (acc >= RACE.DT && guard++ < 4) { RACE.step(S.race); acc -= RACE.DT; }
    } else if (S.preview && busy(ts)) {
      acc += dt;
      let guard = 0;
      while (acc >= RACE.DT && guard++ < 6) { RACE.step(S.preview); acc -= RACE.DT; }
      renderField();
    }

    RENDER.draw(dt, {});
    clock(ts);
  }

  let lastSecond = -1;
  function clock(ts) {
    const now = Date.now();
    if (S.phase === 'lobby') {
      const left = Math.max(0, S.roundStart + LOBBY_MS - now);
      $('#clockLabel').textContent = 'PRÓXIMA EN';
      $('#clock').textContent = fmt(left);
      /* The demonstration pot creeps up the way real fees would. */
      const sec = Math.floor(now / 1000);
      if (sec !== lastSecond) { lastSecond = sec; S.pot += 0.0004; $('#pot').textContent = sol(S.pot); }
      if (left === 0) startRace();
      if (now >= S.roundStart + ROUND_MS) openLobby();
    } else if (S.phase === 'racing') {
      $('#clockLabel').textContent = 'EN CARRERA';
      $('#clock').textContent = fmt((ts - S.startedAt));
    } else {
      $('#clockLabel').textContent = 'NUEVA PARRILLA EN';
      $('#clock').textContent = fmt(Math.max(0, S.resultUntil - now));
    }
  }

  const fmt = (ms) => {
    const s = Math.floor(ms / 1000);
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  };

  /* ---- start ------------------------------------------------------------- */

  RENDER.init($('#stage'));
  loadPast();
  renderPast();
  openLobby();
  addBots(17);
  $('#pot').textContent = sol(S.pot);

  $('#joinBtn').addEventListener('click', joinWithWallet);
  $('#botBtn').addEventListener('click', () => { addBots(12); stir(); toast('12 canicas más en la parrilla'); say(); });
  $('#runBtn').addEventListener('click', startRace);
  $('#winAddr').addEventListener('click', () => copy($('#winAddr').textContent));
  $('#stage').addEventListener('click', () => { if (S.phase === 'lobby') stir(); });

  requestAnimationFrame(frame);
})();
