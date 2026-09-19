/* MARBLE ROYALE - the preview.

   The race is the real one: shared/race.js and render.js are inlined above,
   byte for byte from the app. What is missing is everything that needs a
   server - the signature that proves a wallet, the queue shared between
   strangers, the seed committed before anyone joins, and the fees read off the
   chain. Those live in marble-royale/ and run wherever Node runs.

   So this page keeps the clock and the look, fills its own queue with
   demonstration marbles, and lets anyone race immediately.

   Everything the coin has to fill in later is in COIN, right here. */

(function () {
  'use strict';

  const COIN = {
    ticker: '',        // '$MARBLE'
    ca: '',            // the token's contract address on Ethereum, 0x…
    x: '',             // https://x.com/your_account
    potPct: 20         // the share of the fees the winner takes
  };

  const $ = (s) => document.querySelector(s);
  const ROUND_MS = 300000;
  const LOBBY_MS = 240000;
  const HEX = '0123456789abcdef';
  const SKINS = ['#6ee7ff', '#7dff9b', '#ffd36e', '#ff5ea8', '#b98bff', '#ff8a4c',
                 '#4cd9ff', '#ff5252', '#9dff4c', '#ffffff'];

  /* The renderer labels your own marble through I18N; the app ships the real
     dictionary, this page needs one word of it. */
  window.I18N = { t: (k) => (k === 'field.you' ? 'you' : k) };

  const S = {
    phase: 'lobby',
    roundStart: 0,
    resultUntil: 0,
    players: [],
    me: null,
    skin: { color: SKINS[0], face: 'smile' },
    queued: false,
    race: null,
    preview: null,
    startedAt: 0,
    pot: 0.18 + Math.random() * 0.5,
    past: []
  };

  const short = (a) => (a.length > 12 ? a.slice(0, 6) + '…' + a.slice(-4) : a);
  /* Dollars, the way the pot is shown: the fees are in ETH on the chain and are
     converted at the current price when it is live. */
  const usd = (v) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* Demonstration wallets: the right shape, belonging to nobody. */
  function fakeAddress() {
    let s = '0x';
    for (let i = 0; i < 40; i++) s += HEX[(Math.random() * 16) | 0];
    return s;
  }
  function colorOf(address) {
    let h = 2166136261;
    for (let i = 0; i < address.length; i++) { h ^= address.charCodeAt(i); h = Math.imul(h, 16777619); }
    h = h >>> 0;
    return 'hsl(' + (h % 360) + ' ' + (62 + (h >>> 9) % 26) + '% ' + (52 + (h >>> 17) % 14) + '%)';
  }
  const faceOf = (address) => {
    let h = 5381;
    for (let i = 0; i < address.length; i++) h = (Math.imul(h, 33) ^ address.charCodeAt(i)) >>> 0;
    return RENDER.FACES[1 + (h % (RENDER.FACES.length - 1))];
  };

  function toast(text) {
    const old = document.querySelector('.toast');
    if (old) old.remove();
    const n = document.createElement('div');
    n.className = 'toast';
    n.textContent = text;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 3400);
  }
  function copy(text, what) {
    if (!text) return;
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast((what || 'Address') + ' copied'), () => {});
  }

  /* ---- the queue --------------------------------------------------------- */

  function addMarble(address, mine) {
    if (S.players.some((p) => p.address === address)) return;
    const p = {
      address, mine: !!mine,
      color: mine ? S.skin.color : colorOf(address),
      face: mine ? S.skin.face : faceOf(address)
    };
    S.players.push(p);
    if (S.preview && S.phase === 'lobby') {
      RACE.addBall(S.preview, address);
      RENDER.addPlayer(address, p.color, p.mine, p.face);
      stir();
    }
    renderField();
    say();
  }

  const addBots = (n) => { for (let i = 0; i < n; i++) addMarble(fakeAddress(), false); };

  function queueUp() {
    if (!S.me || S.queued) return;
    S.queued = true;
    addMarble(S.me, true);
    paintQueueBtn();
    toast('You are in the queue. Your marble runs in the next race.');
  }

  function paintQueueBtn() {
    const b = $('#queueBtn');
    b.disabled = !S.me || S.queued || S.phase !== 'lobby';
    b.textContent = S.queued ? 'In the queue ✓' : 'Join the queue';
  }

  /* An Ethereum wallet first, since that is where the coin lives; a Solana one
     if that is all the browser has; a demonstration address with neither. */
  async function connect() {
    if (window.ethereum && window.ethereum.request) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts && accounts[0]) return signedIn(accounts[0], 'Ethereum');
      } catch { return toast('You cancelled the connection'); }
    }
    const sol = window.phantom?.solana || window.solana;
    if (sol && sol.connect) {
      try {
        const res = await sol.connect();
        const key = (res && res.publicKey) || sol.publicKey;
        if (key) return signedIn(key.toString(), 'Solana');
      } catch { return toast('You cancelled the connection'); }
    }
    signedIn(fakeAddress(), 'demo');
    toast('No wallet in this browser, so you are in with a demonstration address');
  }

  function signedIn(address, chain) {
    S.me = address;
    const btn = $('#joinBtn');
    btn.textContent = short(address);
    btn.classList.add('btn--wallet');
    btn.classList.remove('btn--accent');
    btn.title = 'copy your address';
    $('#skinWho').textContent = short(address) + ' · ' + chain;
    paintQueueBtn();
    drawSkin();
    if (chain !== 'demo') toast('Wallet connected. Join the queue to race.');
  }

  /* ---- your marble ------------------------------------------------------- */

  function loadSkin() {
    try {
      const raw = JSON.parse(localStorage.getItem('mr.skin') || 'null');
      if (raw && raw.color && raw.face) S.skin = raw;
    } catch {}
  }
  function saveSkin() {
    try { localStorage.setItem('mr.skin', JSON.stringify(S.skin)); } catch {}
  }

  function applySkin() {
    saveSkin();
    const mine = S.players.find((p) => p.mine);
    if (mine) {
      mine.color = S.skin.color;
      mine.face = S.skin.face;
      RENDER.addPlayer(mine.address, mine.color, true, mine.face);
      renderField();
    }
    drawSkin();
  }

  /* The customiser draws with the same routine the track uses, so what you pick
     is exactly what runs. */
  function drawSkin() {
    const cv = $('#skinPrev');
    const ctx = cv.getContext('2d');
    const w = cv.width, h = cv.height, r = 52;
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w / 2 - r * 0.35, h / 2 - r * 0.4, r * 0.15, w / 2, h / 2, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.28, S.skin.color);
    g.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, r, 0, 6.283);
    ctx.fill();
    if (S.skin.face !== 'none') RENDER.drawFace(ctx, w / 2, h / 2, r, S.skin.face);
  }

  function buildPickers() {
    const sw = $('#swatches');
    for (const c of SKINS) {
      const b = document.createElement('button');
      b.className = 'sw';
      b.style.background = c;
      b.title = c;
      b.setAttribute('aria-label', 'color ' + c);
      b.addEventListener('click', () => {
        S.skin.color = c;
        markOn(sw, b);
        applySkin();
      });
      if (c === S.skin.color) b.classList.add('on');
      sw.appendChild(b);
    }
    const fc = $('#faces');
    const names = { none: 'plain', smile: 'smile', grin: 'grin', wink: 'wink', cool: 'shades', angry: 'angry', dead: 'k.o.' };
    for (const f of RENDER.FACES) {
      const b = document.createElement('button');
      b.className = 'fc';
      const c = document.createElement('canvas');
      c.width = 46; c.height = 46;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#39415a';
      ctx.beginPath(); ctx.arc(23, 23, 17, 0, 6.283); ctx.fill();
      if (f !== 'none') RENDER.drawFace(ctx, 23, 23, 17, f);
      const label = document.createElement('span');
      label.textContent = names[f] || f;
      b.append(c, label);
      b.addEventListener('click', () => {
        S.skin.face = f;
        markOn(fc, b);
        applySkin();
      });
      if (f === S.skin.face) b.classList.add('on');
      fc.appendChild(b);
    }
  }
  const markOn = (parent, el) => {
    for (const c of parent.children) c.classList.toggle('on', c === el);
  };

  /* ---- the round --------------------------------------------------------- */

  function openLobby() {
    S.phase = 'lobby';
    S.roundStart = Math.floor(Date.now() / ROUND_MS) * ROUND_MS;
    /* Open on the next whole window when this one has no queue time left, so a
       page opened at four minutes past does not fire a race in its first frame
       and then loop. */
    while (Date.now() > S.roundStart + LOBBY_MS - 20000) S.roundStart += ROUND_MS;
    S.race = null;
    $('#card').hidden = true;
    document.body.dataset.phase = 'lobby';
    /* The jar fills from empty and is about full when the race is due: the
       target is drawn per round, the per-second rate follows from how long
       the queue is open, and every tick jitters so it lands like trades do. */
    S.pot = 0;
    S.potTarget = 40 + Math.random() * 140;
    S.potPerSec = S.potTarget / Math.max(30, (S.roundStart + LOBBY_MS - Date.now()) / 1000);
    S.potState = 'filling';
    paintPot();
    S.preview = RACE.createRace(((Date.now() / ROUND_MS) | 0) >>> 0,
      S.players.map((p) => ({ id: p.address })), { hold: true });
    RENDER.setRace(S.preview, S.players, S.me);
    stir();
    renderField();
    paintQueueBtn();
    say();
  }

  function startRace() {
    if (S.phase === 'racing' || !S.players.length) return;
    S.phase = 'racing';
    document.body.dataset.phase = 'racing';
    $('#card').hidden = true;
    S.race = RACE.createRace((Math.random() * 0xffffffff) >>> 0,
      S.players.map((p) => ({ id: p.address })));
    RENDER.setRace(S.race, S.players, S.me);
    S.startedAt = performance.now();
    S.potState = 'locked';
    paintPot();
    banner('GO!');
    paintQueueBtn();
    say();
  }

  function finishRace() {
    S.phase = 'result';
    document.body.dataset.phase = 'result';
    const winner = S.race.finished[0];
    $('#card').hidden = false;
    $('#winAddr').textContent = winner.id;
    $('#winPay').textContent = usd(S.pot) + ' · ' + COIN.potPct + '% of the fees';
    $('#winYou').hidden = winner.id !== S.me;
    RENDER.celebrate(winner.id);
    S.past.unshift({ at: Date.now(), winner: winner.id, pot: S.pot, n: S.players.length });
    S.past.length = Math.min(S.past.length, 12);
    S.resultUntil = Date.now() + 12000;
    savePast();
    renderPast();
    renderField();
    S.queued = false;
    setTimeout(drainPot, 2200);
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
      lobby: n ? '<b>' + n + ' marbles</b> queued. First one across the line takes the pot.'
                : 'Queue empty. Add some marbles and race.',
      racing: 'They are off.',
      result: 'Race over. That is the wallet that gets paid.'
    }[S.phase];
    $('#status').innerHTML = msg;
    $('#runBtn').disabled = S.phase === 'racing' || !n;
  }

  /* ---- panels ------------------------------------------------------------ */

  function renderField() {
    const ul = $('#field');
    ul.innerHTML = '';
    $('#count').textContent = S.players.length;
    $('#hudCount').textContent = S.players.length + ' queued';
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
      who.textContent = short(p.address) + (p.mine ? ' (you)' : '');
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
      li.textContent = 'No races in this session yet.';
      li.style.color = 'var(--dim)';
      ul.appendChild(li);
      return;
    }
    for (const r of S.past) {
      const li = document.createElement('li');
      const row = document.createElement('div'); row.className = 'row';
      const when = document.createElement('span');
      when.textContent = new Date(r.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
        ' · ' + r.n + ' marbles';
      const amt = document.createElement('span');
      amt.style.color = 'var(--gold)';
      amt.textContent = usd(r.pot);
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
      acc += dt;
      let guard = 0;
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

  let lastTick = 0;
  function clock(ts) {
    const now = Date.now();
    if (S.phase === 'lobby') {
      const left = Math.max(0, S.roundStart + LOBBY_MS - now);
      $('#clockLabel').textContent = 'Next race in';
      $('#clock').textContent = fmt(left);
      /* The pot ticks up in cents, ten times a second, so the figure is always
         moving; once in a while a trade lands that is worth a coin falling. */
      if (S.potState === 'filling' && now - lastTick >= 100) {
        lastTick = now;
        const trade = Math.random() < 0.012;
        const add = trade ? 0.3 + Math.random() * 0.6 : S.potPerSec * 0.1 * (0.5 + Math.random());
        S.pot = Math.min(S.potTarget * 1.15, Math.round((S.pot + add) * 100) / 100);
        paintPot();
        if (trade) drop();
      }
      if (left === 0) startRace();
    } else if (S.phase === 'racing') {
      $('#clockLabel').textContent = 'Racing';
      $('#clock').textContent = fmt(ts - S.startedAt);
    } else {
      $('#clockLabel').textContent = 'New queue in';
      $('#clock').textContent = fmt(Math.max(0, S.resultUntil - now));
    }
  }

  /* The jar, the bar, the big figure and the ticker all read from S.pot. */
  function paintPot() {
    const level = Math.max(0, Math.min(1, S.pot / S.potTarget));
    const liquid = $('#liquid'), top = $('#liquidTop');
    liquid.setAttribute('y', (134 - 100 * level).toFixed(1));
    liquid.setAttribute('height', (100 * level).toFixed(1));
    top.setAttribute('cy', (134 - 100 * level).toFixed(1));
    $('#potFill').style.width = (level * 100).toFixed(1) + '%';
    $('#potBig').textContent = usd(S.pot);
    $('#pot').textContent = usd(S.pot);
    $('#potbox').dataset.state = S.potState;
    $('#potState').textContent = {
      filling: 'Filling with fees while the queue is open',
      locked: 'Locked for the race',
      draining: 'Paid out to the winner'
    }[S.potState];
  }

  function drop() {
    const box = $('#drops');
    if (box.children.length > 6) return;
    const d = document.createElement('i');
    d.className = 'drop';
    d.style.left = (44 + Math.random() * 52) + 'px';
    box.appendChild(d);
    setTimeout(() => d.remove(), 900);
  }

  /* After the winner is announced the jar empties over a second or so, and
     the next queue starts it again from nothing. */
  function drainPot() {
    S.potState = 'draining';
    const from = S.pot, t0 = performance.now();
    const tick = (ts) => {
      const k = Math.min(1, (ts - t0) / 1200);
      S.pot = from * (1 - k * k);
      paintPot();
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  const fmt = (ms) => {
    const s = Math.floor(ms / 1000);
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  };

  /* ---- what the coin fills in later -------------------------------------- */

  function applyCoin() {
    $('#ticker').textContent = COIN.ticker ? (COIN.ticker.startsWith('$') ? COIN.ticker : '$' + COIN.ticker) : '';
    const val = $('#caVal');
    if (COIN.ca) {
      val.textContent = COIN.ca;
      $('#caBtn').title = 'copy ' + COIN.ca;
      $('#footCa').textContent = COIN.ca;
    } else {
      val.textContent = 'not live yet';
      $('#footCa').textContent = 'CA not live yet';
    }
    const x = $('#xLink');
    if (COIN.x) {
      x.href = COIN.x;
      $('#xHandle').textContent = COIN.x.replace(/^https?:\/\/(x|twitter)\.com\//i, '@');
    }
    for (const id of ['#pctA', '#pctB', '#pctC']) $(id).textContent = COIN.potPct + '%';
  }

  /* The sidebar follows the reading position, and closes itself once a link on
     a phone has taken you somewhere. */
  function wireNav() {
    const links = [...document.querySelectorAll('.nl')];
    const nav = $('#nav');
    for (const a of links) {
      a.addEventListener('click', () => nav.classList.remove('open'));
    }
    $('#navToggle').addEventListener('click', () => nav.classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if (nav.classList.contains('open') && !nav.contains(e.target) && e.target.id !== 'navToggle') {
        nav.classList.remove('open');
      }
    });
    const targets = links
      .map((a) => ({ a, el: document.querySelector(a.getAttribute('href')) }))
      .filter((t) => t.el);
    if (!('IntersectionObserver' in window)) return;
    const seen = new Set();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) seen.add(e.target); else seen.delete(e.target);
      }
      const first = targets.find((t) => seen.has(t.el));
      for (const t of targets) t.a.classList.toggle('is-on', !!first && t === first);
    }, { rootMargin: '-45% 0px -45% 0px' });
    for (const t of targets) io.observe(t.el);
  }

  /* ---- start ------------------------------------------------------------- */

  RENDER.init($('#stage'));
  loadSkin();
  loadPast();
  renderPast();
  buildPickers();
  drawSkin();
  applyCoin();
  wireNav();
  openLobby();
  addBots(17);
  paintPot();

  $('#joinBtn').addEventListener('click', () => { if (S.me) copy(S.me, 'Your address'); else connect(); });
  $('#queueBtn').addEventListener('click', queueUp);
  $('#botBtn').addEventListener('click', () => { addBots(12); stir(); toast('12 more marbles in the queue'); });
  $('#runBtn').addEventListener('click', startRace);
  $('#winAddr').addEventListener('click', () => copy($('#winAddr').textContent));
  $('#caBtn').addEventListener('click', () => copy(COIN.ca, 'Contract address'));
  $('#stage').addEventListener('click', () => { if (S.phase === 'lobby') stir(); });

  requestAnimationFrame(frame);
})();
