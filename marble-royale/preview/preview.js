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
    potPct: 100        // the winner takes the whole pot
  };

  const $ = (s) => document.querySelector(s);
  const ROUND_MS = 300000;
  const LOBBY_MS = 240000;
  const MEGA_EVERY = 1800000;      // a mega race on the hour and the half hour
  const MEGA_POT = 25;
  const isMega = (start) => start % MEGA_EVERY === 0;
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
    skin: { color: '#e3a94e', face: 'doge' },
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
    return RENDER.FACES[h % RENDER.FACES.length];
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
      face: mine ? S.skin.face : faceOf(address),
      color: mine ? S.skin.color : (RENDER.SKIN_COLORS[faceOf(address)] || colorOf(address))
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
        if (accounts && accounts[0]) return signedIn(accounts[0], 'Robinhood Chain');
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
      if (raw && raw.color && raw.face && RENDER.FACES.includes(raw.face)) S.skin = raw;
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
    RENDER.drawFace(ctx, w / 2, h / 2, r, S.skin.face);
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
    const names = { hood: 'HOOD', doge: 'DOGE', shib: 'SHIB', pepe: 'PEPE', bonk: 'BONK', wif: 'WIF', btc: 'BTC', eth: 'ETH',
                    sol: 'SOL', bnb: 'BNB', xrp: 'XRP', usdt: 'USDT', usdc: 'USDC', ada: 'ADA', avax: 'AVAX' };
    for (const f of RENDER.FACES) {
      const b = document.createElement('button');
      b.className = 'fc';
      const c = document.createElement('canvas');
      c.width = 46; c.height = 46;
      const ctx = c.getContext('2d');
      ctx.fillStyle = RENDER.SKIN_COLORS[f] || '#39415a';
      ctx.beginPath(); ctx.arc(23, 23, 17, 0, 6.283); ctx.fill();
      RENDER.drawFace(ctx, 23, 23, 17, f);
      const label = document.createElement('span');
      label.textContent = names[f] || f;
      b.append(c, label);
      b.addEventListener('click', () => {
        S.skin.face = f;
        if (RENDER.SKIN_COLORS[f]) {
          S.skin.color = RENDER.SKIN_COLORS[f];
          for (const c of sw.children) c.classList.toggle('on', c.title === S.skin.color);
        }
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
    /* A normal race collects three to seven dollars; the one on the hour and
       the half hour is the mega race and collects twenty-five. The rate is set
       so the jar is full when the race is due. */
    S.mega = isMega(S.roundStart);
    S.potTarget = S.mega ? MEGA_POT : 3 + Math.random() * 4;
    S.potPerSec = S.potTarget / Math.max(30, (S.roundStart + LOBBY_MS - Date.now()) / 1000);
    S.potAcc = 0;
    document.body.dataset.mega = S.mega ? '1' : '0';
    $('#megaBadge').hidden = !S.mega;
    $('#megaHud').hidden = !S.mega;
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
    /* Racing early, the jar completes to what the window would have collected,
       so a race called by hand pays what a race on the clock pays. */
    if (S.potState === 'filling' && S.pot < S.potTarget) {
      S.pot = Math.round(S.potTarget * 100) / 100;
      S.potAcc = 0;
    }
    S.phase = 'racing';
    document.body.dataset.phase = 'racing';
    $('#card').hidden = true;
    S.race = RACE.createRace((Math.random() * 0xffffffff) >>> 0,
      S.players.map((p) => ({ id: p.address })));
    RENDER.setRace(S.race, S.players, S.me);
    S.startedAt = performance.now();
    S.potState = 'locked';
    paintPot();
    banner(S.mega ? 'MEGA RACE · GO!' : 'GO!');
    paintQueueBtn();
    say();
  }

  function finishRace() {
    S.phase = 'result';
    document.body.dataset.phase = 'result';
    const winner = S.race.finished[0];
    $('#card').hidden = false;
    $('#winAddr').textContent = winner.id;
    /* An EIP-681 link: a wallet on the creator's phone or the extension opens
       a send to this address with nothing else filled in. */
    $('#winSend').href = 'ethereum:' + winner.id;
    $('#winPay').textContent = usd(S.pot) + (S.mega ? ' · MEGA RACE · the whole pot' : ' · the whole pot');
    $('#winYou').hidden = winner.id !== S.me;
    RENDER.celebrate(winner.id);
    S.past.unshift({ at: Date.now(), winner: winner.id, pot: S.pot, n: S.players.length, mega: S.mega });
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
        ' · ' + r.n + ' marbles' + (r.mega ? ' · MEGA' : '');
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

  let lastTick = 0, lastMegaSec = -1;
  function clock(ts) {
    const now = Date.now();
    const megaSec = Math.floor(now / 1000);
    if (megaSec !== lastMegaSec) {
      lastMegaSec = megaSec;
      const next = Math.ceil((now + 1) / MEGA_EVERY) * MEGA_EVERY;
      $('#megaIn').textContent = fmt(next - now);
    }
    if (S.phase === 'lobby') {
      const left = Math.max(0, S.roundStart + LOBBY_MS - now);
      $('#clockLabel').textContent = 'Next race in';
      $('#clock').textContent = fmt(left);
      /* About a dollar a minute, arriving a cent at a time, with the odd small
         trade on top that is worth a coin dropping in. */
      if (S.potState === 'filling' && now - lastTick >= 100) {
        lastTick = now;
        S.potAcc += S.potPerSec * 0.1;
        const trade = Math.random() < 0.004;
        let add = 0;
        if (S.potAcc >= 0.01) { add = Math.floor(S.potAcc * 100) / 100; S.potAcc -= add; }
        if (trade) add += (S.mega ? 0.5 : 0.1) + Math.random() * (S.mega ? 1.2 : 0.25);
        if (add > 0) {
          S.pot = Math.round((S.pot + add) * 100) / 100;
          paintPot();
          if (trade) drop();
        }
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
    $('#potState').textContent = (S.mega ? 'MEGA RACE · ' : '') + {
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

  /* ---- the launchpad ----------------------------------------------------- */

  /* The form fills the token card as you type and keeps the draft in this
     browser. Deploying is the launchpad contract's job once it is live; here
     the button only shows what the token's page would look like. */
  function wireLaunch() {
    const f = $('#launchForm');
    if (!f) return;
    const q = (id) => $('#' + id);
    let image = '';

    const paint = () => {
      const name = q('lfName').value.trim(), tick = q('lfTicker').value.trim().toUpperCase().replace(/^\$/, '');
      q('tkName').textContent = name || 'Your token';
      q('tkTicker').textContent = '$' + (tick || 'TICKER');
      q('tkDesc').textContent = q('lfDesc').value.trim() || (name ? 'Every ' + q('lfEvery').value + ' minutes one marble takes the fees of $' + tick + '.' : 'Fill the form and your token page appears here.');
      q('tkEvery').textContent = q('lfEvery').value + ' min';
      q('tkShare').textContent = q('lfShare').value + '%';
      q('lfShareOut').textContent = q('lfShare').value + '%';
      const min = Number(q('lfMin').value) || 0;
      q('tkMin').textContent = min > 0 ? min.toLocaleString('en-US') + '+ $' + (tick || 'TICKER') : 'anyone';
      const img = q('tkImg');
      img.innerHTML = '';
      if (image) { const el = document.createElement('img'); el.src = image; el.alt = ''; img.appendChild(el); }
      else { const sp = document.createElement('span'); sp.textContent = (tick || '?').slice(0, 2); img.appendChild(sp); }
      q('launchCard').dataset.empty = name || tick ? '0' : '1';
      try {
        localStorage.setItem('mr.launch', JSON.stringify({
          name, tick, desc: q('lfDesc').value, every: q('lfEvery').value, share: q('lfShare').value, min: q('lfMin').value
        }));
      } catch {}
    };

    try {
      const d = JSON.parse(localStorage.getItem('mr.launch') || 'null');
      if (d) {
        q('lfName').value = d.name || ''; q('lfTicker').value = d.tick || ''; q('lfDesc').value = d.desc || '';
        q('lfEvery').value = d.every || '5'; q('lfShare').value = d.share || '100'; q('lfMin').value = d.min || '0';
      }
    } catch {}

    for (const id of ['lfName', 'lfTicker', 'lfDesc', 'lfEvery', 'lfShare', 'lfMin']) q(id).addEventListener('input', paint);
    q('lfImage').addEventListener('change', () => {
      const file = q('lfImage').files && q('lfImage').files[0];
      if (!file) return;
      const r = new FileReader();
      r.onload = () => { image = String(r.result); paint(); };
      r.readAsDataURL(file);
    });
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      paint();
      q('tkState').textContent = 'previewed';
      q('launchCard').scrollIntoView({ block: 'center', behavior: 'smooth' });
      toast('That is your token page. Deploying opens when the launchpad is live.');
    });
    paint();
  }

  /* ---- the marbles drifting round the headline --------------------------- */

  /* Seven coin marbles, drawn with the same routine the track uses, scattered
     round the hero the way a shop scatters its wares. Purely decorative: they
     never touch the race. */
  function floaters() {
    const host = $('#floaters');
    if (!host) return;
    /* Kept to the margins, well clear of the headline, the copy and the trust
       row: the two near ones high in the corners, the far ones lower down. */
    const spots = [
      { f: 'doge', x: 7, y: 12, r: 34, far: true, d: 0 },
      { f: 'btc', x: 82, y: 10, r: 40, far: false, d: 1.2 },
      { f: 'pepe', x: 3, y: 50, r: 30, far: true, d: 0.8 },
      { f: 'hood', x: 89, y: 44, r: 34, far: false, d: 2.3 },
      { f: 'sol', x: 85, y: 68, r: 34, far: false, d: 3.1 },
      { f: 'wif', x: 12, y: 34, r: 22, far: true, d: 2.7 }
    ];
    for (const sp of spots) {
      const el = document.createElement('div');
      el.className = 'fl ' + (sp.far ? 'fl--far' : 'fl--near');
      el.style.left = sp.x + '%';
      el.style.top = sp.y + '%';
      el.style.animationDelay = (-sp.d) + 's';
      el.style.animationDuration = (6 + sp.d) + 's';
      const cv = document.createElement('canvas');
      const size = sp.r * 2 + 12;
      cv.width = size * 2; cv.height = size * 2;
      cv.style.width = size + 'px'; cv.style.height = size + 'px';
      const ctx = cv.getContext('2d');
      ctx.scale(2, 2);
      const c = RENDER.SKIN_COLORS[sp.f];
      const g = ctx.createRadialGradient(size / 2 - sp.r * 0.38, size / 2 - sp.r * 0.42, sp.r * 0.1, size / 2, size / 2, sp.r);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.22, c); g.addColorStop(0.78, c); g.addColorStop(1, 'rgba(0,0,0,.55)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(size / 2, size / 2, sp.r, 0, 6.283); ctx.fill();
      RENDER.drawFace(ctx, size / 2, size / 2, sp.r, sp.f);
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.beginPath(); ctx.arc(size / 2 - sp.r * 0.42, size / 2 - sp.r * 0.45, sp.r * 0.14, 0, 6.283); ctx.fill();
      const label = document.createElement('b');
      label.textContent = sp.f.toUpperCase();
      el.append(cv, label);
      host.appendChild(el);
    }
  }

  /* ---- what the coin fills in later -------------------------------------- */

  function applyCoin() {
    $('#ticker').textContent = COIN.ticker ? (COIN.ticker.startsWith('$') ? COIN.ticker : '$' + COIN.ticker) : '';
    const val = $('#caVal');
    if (COIN.ca) {
      val.textContent = short(COIN.ca);
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
    } else {
      x.removeAttribute('href');
      x.style.opacity = '.4';
    }

  }

  /* The sidebar follows the reading position, and closes itself once a link on
     a phone has taken you somewhere. */
  function wireNav() {
    const links = [...document.querySelectorAll('.nl')];
    const nav = $('#nav');
    for (const a of links) a.addEventListener('click', () => nav.classList.remove('open'));
    $('#navToggle').addEventListener('click', (e) => { e.stopPropagation(); nav.classList.toggle('open'); });
    document.addEventListener('click', (e) => {
      if (nav.classList.contains('open') && !nav.contains(e.target)) nav.classList.remove('open');
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
  wireLaunch();
  floaters();
  openLobby();
  addBots(17);
  paintPot();

  $('#joinBtn').addEventListener('click', () => { if (S.me) copy(S.me, 'Your address'); else connect(); });
  $('#queueBtn').addEventListener('click', queueUp);
  $('#botBtn').addEventListener('click', () => { addBots(12); stir(); toast('12 more marbles in the queue'); });
  $('#runBtn').addEventListener('click', startRace);
  $('#winAddr').addEventListener('click', () => copy($('#winAddr').textContent));
  $('#winCopy').addEventListener('click', () => copy($('#winAddr').textContent, "Winner's address"));
  $('#caBtn').addEventListener('click', () => copy(COIN.ca, 'Contract address'));
  $('#stage').addEventListener('click', () => { if (S.phase === 'lobby') stir(); });

  requestAnimationFrame(frame);
})();
