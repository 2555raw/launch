/* MARBLE ROYALE - the page.

   Everything the browser does: listen to the server's event stream, keep a clock
   in step with it, run the race engine at sixty steps a second so the picture
   matches the result the server already worked out, and wire up the wallet, the
   chat and the cheers.

   The one rule worth stating: the winner shown on screen always comes from the
   server's `result` event, never from the replay running here. The replay is
   deterministic and should agree to the last bounce, but if a browser ever
   disagreed, the money follows the server. */

(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const el = {
    body: document.body,
    canvas: $('#stage'),
    clock: $('#clock'), phaseLabel: $('#phaseLabel'),
    pot: $('#potValue'), potUnit: $('#potUnit'),
    coin: $('#coinName'), ticker: $('#coinTicker'),
    connect: $('#connectBtn'), join: $('#joinBtn'), auto: $('#autoJoin'), autoWrap: $('#autoWrap'),
    lang: $('#langBtn'), sound: $('#soundBtn'),
    status: $('#status'), banner: $('#banner'),
    winner: $('#winnerCard'), winnerAddr: $('#winnerAddr'), winnerPot: $('#winnerPot'),
    winnerYou: $('#winnerYou'), winnerNote: $('#winnerNote'),
    field: $('#field'), fieldCount: $('#fieldCount'),
    chat: $('#chat'), chatForm: $('#chatForm'), chatInput: $('#chatInput'),
    winners: $('#winners'), topList: $('#topList'),
    hudPlayers: $('#hudPlayers'), hudWatching: $('#hudWatching'), hudMe: $('#hudMe'),
    commit: $('#commitLine'), links: $('#links'),
    caBtn: $('#caBtn'), caVal: $('#caVal'), xLink: $('#xLink'), potPct: $('#potPct'),
    skinBtn: $('#skinBtn'), skinPrev: $('#skinPrev'), swatches: $('#swatches'), faces: $('#faces')
  };

  const S = {
    cfg: null,
    round: null,
    offset: 0,             // server time minus local time
    me: null,              // { address, token }
    provider: null,
    joined: false,
    watching: 0,
    cheerCounts: new Map(),
    skin: { color: '#6ee7ff', face: 'smile' },
    mode: 'idle',          // idle | preview | race | done
    raceStartAt: 0,
    official: null
  };

  const serverNow = () => Date.now() + S.offset;
  const same = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
  const short = (a) => (a ? a.slice(0, 6) + '…' + a.slice(-4) : '');
  const t = (k, v) => window.I18N.t(k, v);

  /* ---- sound ------------------------------------------------------------- */

  /* Small noises, made on the spot: no files to load and nothing to license.
     Off until the first tap, because browsers insist and because a page that
     starts making noise on its own deserves to be closed. */
  const SND = (() => {
    let ctx = null;
    let on = localStorage.getItem('mr.sound') !== 'off';
    const wake = () => {
      if (!ctx && window.AudioContext) ctx = new AudioContext();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    };
    function beep(freq, len, type, gain) {
      if (!on || !ctx) return;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'triangle';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(gain || 0.09, ctx.currentTime + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + len);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + len + 0.02);
    }
    return {
      wake,
      get on() { return on; },
      toggle() {
        on = !on;
        localStorage.setItem('mr.sound', on ? 'on' : 'off');
        if (on) { wake(); beep(660, 0.1); }
        return on;
      },
      tick: () => beep(880, 0.07, 'square', 0.05),
      go: () => { beep(320, 0.18, 'sawtooth', 0.08); setTimeout(() => beep(640, 0.25, 'sawtooth', 0.07), 90); },
      join: () => beep(520, 0.09),
      pop: () => beep(980, 0.06, 'sine', 0.05),
      win: () => [0, 130, 260, 430].forEach((d, i) => setTimeout(() => beep([523, 659, 784, 1046][i], 0.35, 'triangle', 0.08), d))
    };
  })();

  /* ---- toast ------------------------------------------------------------- */

  let toastTimer = null;
  function toast(msg, kind) {
    const old = document.querySelector('.toast');
    if (old) old.remove();
    const node = document.createElement('div');
    node.className = 'toast' + (kind ? ' ' + kind : '');
    node.textContent = msg;
    document.body.appendChild(node);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.remove(), 3600);
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast(t('toast.copied'), 'good');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast(t('toast.copied'), 'good'); } catch {}
      ta.remove();
    }
  }

  /* ---- the stream -------------------------------------------------------- */

  let es = null;
  function connectStream() {
    es = new EventSource('/api/stream');
    es.addEventListener('state', (e) => onState(JSON.parse(e.data)));
    es.addEventListener('phase', (e) => onPhase(JSON.parse(e.data)));
    es.addEventListener('join', (e) => onJoin(JSON.parse(e.data)));
    es.addEventListener('start', (e) => onStart(JSON.parse(e.data)));
    es.addEventListener('result', (e) => onResult(JSON.parse(e.data)));
    es.addEventListener('pot', (e) => onPot(JSON.parse(e.data)));
    es.addEventListener('chat', (e) => onChat(JSON.parse(e.data)));
    es.addEventListener('cheer', (e) => onCheer(JSON.parse(e.data)));
    es.addEventListener('tick', (e) => {
      const d = JSON.parse(e.data);
      S.offset = d.now - Date.now();
      if (typeof d.watching === 'number') { S.watching = d.watching; el.hudWatching.firstChild.nodeValue = d.watching + ' '; }
      if (S.round && d.count !== undefined && d.id === S.round.id && d.count > S.round.players.length) {
        /* a join we somehow missed: ask for the field again */
        fetch('/api/state').then((r) => r.json()).then((s) => { if (s.round.id === S.round.id) { S.round.players = s.round.players; syncPreview(s.round); renderField(); } }).catch(() => {});
      }
    });
  }

  function onState(s) {
    S.cfg = s.config;
    S.offset = s.now - Date.now();
    S.watching = s.watching;
    applyConfig();
    renderWinners(s.recent);
    renderTop(s.top);
    el.chat.innerHTML = '';
    for (const m of s.chat) onChat(m, true);
    onPhase(s.round);
  }

  function applyConfig() {
    const c = S.cfg;
    el.coin.textContent = c.coin;
    document.title = c.coin + ' - MARBLE ROYALE';
    el.ticker.textContent = c.ticker ? '$' + c.ticker.replace(/^\$/, '') : '';
    el.potUnit.textContent = '';
    if (c.potPct) el.potPct.textContent = '· ' + c.potPct + '% ' + t('pot.share');
    if (c.mint) {
      el.caBtn.hidden = false;
      el.caVal.textContent = c.mint.slice(0, 4) + '…' + c.mint.slice(-4);
      el.caBtn.title = c.mint;
    }
    if (c.links.x) { el.xLink.hidden = false; el.xLink.href = c.links.x; }
    if (c.payoutNote) el.winnerNote.textContent = c.payoutNote;
    const links = [];
    if (c.links.buy) links.push(['BUY', c.links.buy]);
    if (c.links.x) links.push(['X', c.links.x]);
    if (c.links.telegram) links.push(['TELEGRAM', c.links.telegram]);
    el.links.innerHTML = '';
    for (const [label, href] of links) {
      const a = document.createElement('a');
      a.href = href; a.textContent = label; a.target = '_blank'; a.rel = 'noopener';
      el.links.appendChild(a);
    }
  }

  /* ---- phases ------------------------------------------------------------ */

  function onPhase(round) {
    if (!round) return;
    const fresh = !S.round || S.round.id !== round.id;
    S.round = round;
    el.body.dataset.phase = round.phase;

    if (fresh) {
      S.joined = false;
      S.official = null;
      S.cheerCounts = new Map();
      el.winner.hidden = true;
    }
    if (round.players.some((p) => S.me && same(p.address, S.me.address))) S.joined = true;

    el.commit.textContent = round.commit ? 'seed commit ' + round.commit.slice(0, 32) + '…' : '';

    if (round.phase === 'lobby' || (round.phase === 'locked' && S.mode !== 'race')) {
      if (fresh || S.mode === 'idle' || S.mode === 'done') startPreview(round);
      else syncPreview(round);
      if (round.phase === 'lobby') {
        banner(fresh ? '' : null);
        if (S.me && el.auto.checked && !S.joined) join(true);
      } else {
        banner(t('banner.locked'));
      }
    } else if (round.phase === 'racing') {
      /* Arrived mid-race: build the same race from the seed and fast-forward. */
      if (S.mode !== 'race' && round.seed !== null) {
        onStart({ roundId: round.id, seed: round.seed, startAt: round.raceAt, players: round.players });
      }
    } else if (round.phase === 'result') {
      /* Landing here between races used to mean an empty black track. Replay the
         race that just finished, all the way to the end, so the picture is the
         finish line with the marbles piled past it. */
      if (fresh || S.mode === 'idle' || S.mode === 'preview') replayFinished(round);
      if (round.winner) showWinner({ winner: round.winner, pot: round.pot, order: round.order, roundId: round.id });
      else banner(t('winner.none'));
    }
    if (round.pot !== null && round.pot !== undefined) el.pot.textContent = fmtSol(round.pot);
    else if (!S.cfg.feeWallet) el.pot.textContent = '—';
    renderField();
    paintStatus();
  }

  function onJoin(d) {
    if (!S.round || d.roundId !== S.round.id) return;
    if (!S.round.players.some((p) => p.address === d.player.address)) S.round.players.push(d.player);
    if (S.mode === 'preview' && preview) {
      RACE.addBall(preview, d.player.address);
      previewStirred();
      RENDER.addPlayer(d.player.address, d.player.color, !!(S.me && d.player.address === S.me.address), d.player.face);
    }
    if (S.me && same(d.player.address, S.me.address)) { S.joined = true; SND.join(); }
    renderField();
    paintStatus();
  }

  function onStart(d) {
    if (!S.round) return;
    /* The race is announced by its own event rather than a phase change, so the
       page moves itself into the racing phase here. */
    S.round.phase = 'racing';
    el.body.dataset.phase = 'racing';
    S.mode = 'race';
    S.raceStartAt = d.startAt;
    const live = RACE.createRace(d.seed, d.players.map((p) => ({ id: p.address })));
    RENDER.setRace(live, d.players, S.me && S.me.address);
    current = live;
    preview = null;
    banner(t('banner.go'));
    SND.go();
    renderField();
    paintStatus();
  }

  function onResult(d) {
    S.official = d;
    showWinner(d);
    if (S.round) { S.round.phase = 'result'; S.round.winner = d.winner; el.body.dataset.phase = 'result'; }
    paintStatus();
  }

  function onPot(d) {
    if (S.round && d.roundId === S.round.id) S.round.pot = d.pot;
    el.pot.textContent = fmtSol(d.pot);
    if (S.official && S.official.roundId === d.roundId) {
      S.official.pot = d.pot;
      el.winnerPot.textContent = fmtSol(d.pot);
    }
  }

  function showWinner(d) {
    if (!d || !d.winner) return;
    el.winner.hidden = false;
    el.winnerAddr.textContent = d.winner;
    el.winnerPot.textContent = (d.pot === null || d.pot === undefined)
      ? t('winner.pending')
      : fmtSol(d.pot) + (S.cfg && S.cfg.potPct ? ' · ' + S.cfg.potPct + '%' : '');
    const mine = !!(S.me && same(d.winner, S.me.address));
    el.winnerYou.hidden = !mine;
    banner('');
    RENDER.celebrate(d.winner);
    SND.win();
    if (mine) toast(t('toast.win'), 'good');
    fetch('/api/history?n=12').then((r) => r.json()).then((h) => {
      renderWinners(h.rounds);
      renderTop(h.top);
    }).catch(() => {});
  }

  function banner(text) {
    if (text === null) return;
    if (!text) { el.banner.hidden = true; return; }
    el.banner.hidden = false;
    el.banner.textContent = text;
    clearTimeout(banner.timer);
    banner.timer = setTimeout(() => { el.banner.hidden = true; }, 1800);
  }

  /* ---- the picture ------------------------------------------------------- */

  let preview = null;    // the lobby: marbles piling up behind the gate
  let current = null;    // whichever race state is being drawn

  function startPreview(round) {
    const seed = parseInt((round.commit || '0').slice(0, 8), 16) >>> 0;
    preview = RACE.createRace(seed, round.players.map((p) => ({ id: p.address })), { hold: true });
    RENDER.setRace(preview, round.players, S.me && S.me.address);
    current = preview;
    S.mode = 'preview';
    previewStirred();
  }

  function syncPreview(round) {
    if (!preview) return startPreview(round);
    for (const p of round.players) {
      if (!preview.balls.some((b) => b.id === p.address)) {
        RACE.addBall(preview, p.address);
        RENDER.addPlayer(p.address, p.color, !!(S.me && p.address === S.me.address), p.face);
        previewStirred();
      }
    }
  }

  /* The lobby is on screen for most of five minutes, and simulating a heap of
     marbles that have already come to rest is a good way to cook a phone. Once
     everything has settled the preview stops stepping, and starts again the
     moment a marble is added or something starts moving. */
  function replayFinished(round) {
    if (round.seed === null || round.seed === undefined || !round.players.length) return;
    const done = RACE.createRace(round.seed, round.players.map((p) => ({ id: p.address })));
    let guard = 0;
    while (!done.over && guard++ < RACE.MAX_SECONDS * 60 + 10) RACE.step(done);
    for (let i = 0; i < 90; i++) RACE.step(done);   /* let them drop out of shot */
    RENDER.setRace(done, round.players, S.me && S.me.address);
    current = done;
    preview = null;
    S.mode = 'done';
  }

  let settleCheck = 0, settled = false, lastChange = 0;
  const previewStirred = () => { lastChange = performance.now(); settled = false; };
  function previewBusy(ts) {
    if (!settled && ts - lastChange < 4000) return true;
    if (ts - settleCheck > 400) {
      settleCheck = ts;
      let fastest = 0;
      for (const b of current.balls) {
        const sp = b.vx * b.vx + b.vy * b.vy;
        if (sp > fastest) fastest = sp;
      }
      settled = fastest < 400;
    }
    return !settled;
  }

  let last = 0, acc = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016);
    last = ts;

    if (S.mode === 'race' && current) {
      const due = (serverNow() - S.raceStartAt) / 1000;
      let guard = 0;
      while (current.t < due && !current.over && guard++ < 200) RACE.step(current);
    } else if (S.mode === 'preview' && current && previewBusy(ts)) {
      acc += dt;
      let guard = 0;
      while (acc >= RACE.DT && guard++ < 6) { RACE.step(current); acc -= RACE.DT; }
    }

    RENDER.draw(dt, { right: S.round ? S.round.id : '' });
    paintClock();
    if (S.mode === 'race') paintField();
  }

  /* ---- the clock --------------------------------------------------------- */

  let lastTickSecond = -1;
  function paintClock() {
    const r = S.round;
    if (!r) return;
    const now = serverNow();
    let ms, label;
    if (r.phase === 'lobby') { ms = r.raceAt - now; label = 'phase.lobby'; }
    else if (r.phase === 'locked') { ms = r.raceAt - now; label = 'phase.locked'; }
    else if (r.phase === 'racing') { ms = now - r.raceAt; label = 'phase.racing'; }
    else { ms = r.endAt - now; label = 'phase.result'; }
    ms = Math.max(0, ms);
    el.phaseLabel.textContent = t(label);
    el.clock.textContent = fmtClock(ms);

    const secs = Math.ceil(ms / 1000);
    if ((r.phase === 'lobby' || r.phase === 'locked') && secs <= 5 && secs > 0 && secs !== lastTickSecond) {
      lastTickSecond = secs;
      SND.tick();
      if (secs === 5 && !S.joined && S.me) banner(t('banner.soon'));
    }
  }

  const fmtClock = (ms) => {
    const s = Math.floor(ms / 1000);
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  };
  /* The pot is dollars: fees arrive in ETH and are priced when they are read. */
  const fmtSol = (v) => (v === null || v === undefined ? '—' :
    '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

  /* ---- panels ------------------------------------------------------------ */

  function renderField() {
    const r = S.round;
    if (!r) return;
    const n = r.players.length;
    r.count = n;
    el.fieldCount.textContent = n + ' / ' + r.max;
    el.hudPlayers.firstChild.nodeValue = n + ' ';
    el.field.innerHTML = '';
    if (!r.players.length) {
      const li = document.createElement('li');
      li.textContent = t('field.empty');
      li.style.gridTemplateColumns = '1fr';
      li.style.color = 'var(--dim)';
      el.field.appendChild(li);
      return;
    }
    for (const p of r.players) el.field.appendChild(row(p));
    paintField();
  }

  function row(p) {
    const li = document.createElement('li');
    li.dataset.addr = p.address;
    const pos = document.createElement('span'); pos.className = 'pos'; pos.textContent = '·';
    const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = p.color;
    const who = document.createElement('span'); who.className = 'who';
    who.textContent = short(p.address);
    const cheers = document.createElement('span'); cheers.className = 'cheers';
    if (S.me && p.address === S.me.address) { li.classList.add('is-me'); who.textContent += ' (' + t('field.you') + ')'; }
    li.append(pos, dot, who, cheers);
    li.addEventListener('click', () => sendCheer(p.address));
    return li;
  }

  /* Live order, straight off the marbles: how far down each one is. */
  function paintField() {
    if (!current || !S.round) return;
    const rank = new Map();
    const sorted = [...current.balls].sort((a, b) => {
      if (a.done && b.done) return a.place - b.place;
      if (a.done) return -1;
      if (b.done) return 1;
      return b.y - a.y;
    });
    sorted.forEach((b, i) => rank.set(b.id, i + 1));
    const lead = current.leader && current.leader.id;
    for (const li of el.field.children) {
      const addr = li.dataset && li.dataset.addr;
      if (!addr) continue;
      const pos = rank.get(addr);
      li.firstChild.textContent = pos ? pos : '·';
      li.classList.toggle('is-lead', S.mode === 'race' && addr === lead);
      const n = S.cheerCounts.get(addr) || 0;
      li.lastChild.textContent = n ? '♥' + n : '';
      li.style.order = pos || 999;
    }
    el.field.style.display = 'flex';
    el.field.style.flexDirection = 'column';
  }

  function renderWinners(rounds) {
    el.winners.innerHTML = '';
    if (!rounds || !rounds.length) {
      const li = document.createElement('li');
      li.textContent = t('winners.empty');
      li.style.color = 'var(--dim)';
      el.winners.appendChild(li);
      return;
    }
    for (const r of rounds) {
      if (!r.winner) continue;
      const li = document.createElement('li');
      const top = document.createElement('div'); top.className = 'row';
      const when = document.createElement('span'); when.className = 'muted';
      when.textContent = new Date(r.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const amt = document.createElement('span'); amt.className = 'amt';
      amt.textContent = fmtSol(r.pot);
      top.append(when, amt);
      const addr = document.createElement('div'); addr.className = 'addr';
      addr.textContent = r.winner;
      addr.title = 'copy';
      addr.addEventListener('click', () => copy(r.winner));
      const tag = document.createElement('div');
      tag.className = r.paid ? 'paid' : 'due';
      tag.textContent = r.paid ? '✓ ' + t('winners.paid') + (r.tx ? ' · ' + r.tx.slice(0, 10) + '…' : '') : '· ' + t('winners.due');
      li.append(top, addr, tag);
      el.winners.appendChild(li);
    }
  }

  function renderTop(list) {
    el.topList.innerHTML = '';
    for (let i = 0; i < (list || []).length; i++) {
      const s = list[i];
      const li = document.createElement('li');
      const n = document.createElement('span'); n.className = 'muted'; n.textContent = (i + 1) + '.';
      const a = document.createElement('span'); a.textContent = short(s.address);
      const w = document.createElement('span'); w.className = 'wins'; w.textContent = s.wins + '×';
      li.append(n, a, w);
      el.topList.appendChild(li);
    }
  }

  function onChat(m, quiet) {
    const div = document.createElement('div');
    div.className = 'msg' + (S.me && m.from === S.me.address ? ' is-me' : '');
    const b = document.createElement('b');
    b.textContent = short(m.from) + ' ';
    b.style.color = S.me && m.from === S.me.address ? '' : colorOf(m.from);
    const span = document.createElement('span');
    span.textContent = m.text;
    div.append(b, span);
    el.chat.appendChild(div);
    while (el.chat.children.length > 120) el.chat.firstChild.remove();
    el.chat.scrollTop = el.chat.scrollHeight;
  }

  function onCheer(c) {
    S.cheerCounts.set(c.target, (S.cheerCounts.get(c.target) || 0) + 1);
    RENDER.cheer(c.target);
    if (S.me && c.from === S.me.address) SND.pop();
    paintField();
  }

  /* Same hash the server uses, so a wallet is the same colour everywhere. */
  function colorOf(address) {
    address = String(address).toLowerCase();
    let h = 2166136261;
    for (let i = 0; i < address.length; i++) { h ^= address.charCodeAt(i); h = Math.imul(h, 16777619); }
    h = h >>> 0;
    return 'hsl(' + (h % 360) + ' ' + (62 + (h >>> 9) % 26) + '% ' + (52 + (h >>> 17) % 14) + '%)';
  }

  /* ---- your marble ------------------------------------------------------- */

  /* Ten colours and the faces the renderer knows how to draw. The choice lives
     in this browser and rides along with the join, so everyone sees the marble
     you picked. */
  const SKINS = ['#6ee7ff', '#7dff9b', '#ffd36e', '#ff5ea8', '#b98bff', '#ff8a4c',
                 '#4cd9ff', '#ff5252', '#9dff4c', '#ffffff'];

  function loadSkin() {
    try {
      const raw = JSON.parse(localStorage.getItem('mr.skin') || 'null');
      if (raw && raw.color && raw.face) S.skin = raw;
    } catch {}
  }

  function drawSkin() {
    const cv = el.skinPrev;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const w = cv.width, h = cv.height, r = 46;
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

  function pickSkin(part, value) {
    S.skin[part] = value;
    try { localStorage.setItem('mr.skin', JSON.stringify(S.skin)); } catch {}
    drawSkin();
    if (S.me) RENDER.addPlayer(S.me.address, S.skin.color, true, S.skin.face);
  }

  function buildPickers() {
    const names = { none: 'plain', smile: 'smile', grin: 'grin', wink: 'wink', cool: 'shades', angry: 'angry', dead: 'k.o.',
                    doge: 'doge', pepe: 'pepe', eth: 'ETH', sol: 'SOL', btc: 'BTC', bnb: 'BNB' };
    for (const c of SKINS) {
      const b = document.createElement('button');
      b.className = 'sw' + (c === S.skin.color ? ' on' : '');
      b.style.background = c;
      b.setAttribute('aria-label', 'colour ' + c);
      b.addEventListener('click', () => {
        for (const x of el.swatches.children) x.classList.toggle('on', x === b);
        pickSkin('color', c);
      });
      el.swatches.appendChild(b);
    }
    for (const f of RENDER.FACES) {
      const b = document.createElement('button');
      b.className = 'fc' + (f === S.skin.face ? ' on' : '');
      const cv = document.createElement('canvas');
      cv.width = 38; cv.height = 38;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = RENDER.SKIN_COLORS[f] || '#39415a';
      ctx.beginPath(); ctx.arc(19, 19, 14, 0, 6.283); ctx.fill();
      if (f !== 'none') RENDER.drawFace(ctx, 19, 19, 14, f);
      const label = document.createElement('span');
      label.textContent = names[f] || f;
      b.append(cv, label);
      b.addEventListener('click', () => {
        for (const x of el.faces.children) x.classList.toggle('on', x === b);
        if (RENDER.SKIN_COLORS[f]) {
          for (const x of el.swatches.children) x.classList.remove('on');
          pickSkin('color', RENDER.SKIN_COLORS[f]);
        }
        pickSkin('face', f);
      });
      el.faces.appendChild(b);
    }
  }

  /* ---- wallet ------------------------------------------------------------ */

  async function connect() {
    SND.wake();
    try {
      const w = await WALLET.connect();
      S.provider = w.provider;
      const nonceRes = await fetch('/api/nonce?address=' + encodeURIComponent(w.address)).then((r) => r.json());
      if (nonceRes.error) return toast(nonceRes.error, 'bad');
      toast(t('toast.signin'));
      const signature = await WALLET.signMessage(w.provider, nonceRes.message, w.address);
      const auth = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address: w.address, nonce: nonceRes.nonce, signature })
      }).then((r) => r.json());
      if (auth.error) return toast(auth.error, 'bad');
      signedIn(auth.address, auth.token);
      join();
    } catch (err) {
      if (err && err.code === 'NO_WALLET') {
        if (WALLET.isMobile()) { location.href = WALLET.deepLink(); return; }
        return toast(t('toast.nowallet'), 'bad');
      }
      toast(t('toast.rejected'), 'bad');
    }
  }

  function signedIn(address, token) {
    S.me = { address, token };
    localStorage.setItem('mr.session', JSON.stringify(S.me));
    el.connect.textContent = short(address);
    el.connect.classList.remove('btn--go');
    el.autoWrap.hidden = false;
    el.hudMe.hidden = false;
    el.hudMe.textContent = short(address);
    el.join.disabled = false;
    renderField();
    paintStatus();
  }

  function signOut() {
    S.me = null;
    S.joined = false;
    localStorage.removeItem('mr.session');
    el.connect.textContent = t('btn.connect');
    el.connect.classList.add('btn--go');
    el.autoWrap.hidden = true;
    el.hudMe.hidden = true;
    el.join.disabled = true;
    paintStatus();
  }

  async function join(silent) {
    if (!S.me) return connect();
    const res = await fetch('/api/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: S.me.token, color: S.skin.color, face: S.skin.face })
    }).then((r) => r.json()).catch(() => ({ error: 'network' }));

    if (res.ok) {
      S.joined = true;
      if (!silent) toast(t('toast.joined'), 'good');
      paintStatus();
      return;
    }
    if (res.error === 'holders only') {
      toast(t('status.gate', { need: res.need, ticker: S.cfg.ticker || 'tokens' }), 'bad');
    } else if (res.queued) {
      toast(t('status.full'), 'bad');
    } else if (!silent) {
      toast(res.error || 'could not join', 'bad');
    }
    if (String(res.error).includes('sign in')) signOut();
    paintStatus();
  }

  async function sendCheer(address) {
    if (!S.me) return toast(t('status.watch'));
    SND.wake();
    await fetch('/api/cheer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: S.me.token, target: address })
    }).catch(() => {});
  }

  function paintStatus() {
    const r = S.round;
    if (!r) return;
    let key = 'status.watch';
    if (S.me) {
      if (S.joined && r.phase === 'lobby') key = 'status.joined';
      else if (r.phase === 'lobby') key = 'status.canjoin';
      else if (r.phase === 'locked') key = S.joined ? 'status.joined' : 'status.closed';
      else if (r.phase === 'racing') key = 'status.racing';
      else key = 'status.result';
    }
    el.status.textContent = t(key);
    const canJoin = !!S.me && r.phase === 'lobby' && !S.joined;
    el.join.disabled = !canJoin;
    el.join.textContent = S.joined ? t('btn.joined') : t('btn.join');
  }

  /* The marble picker has no tab of its own - it opens from the button beside
     join, and closes back to whichever tab you were on. */
  function showPanel(name) {
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('is-on', x.dataset.panel === name));
    document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('is-on', p.id === 'panel-' + name));
  }

  /* ---- wiring ------------------------------------------------------------ */

  function boot() {
    I18N.apply();
    loadSkin();
    buildPickers();
    drawSkin();
    el.lang.textContent = I18N.other();
    el.sound.style.opacity = SND.on ? 1 : 0.4;
    RENDER.init(el.canvas);

    try {
      const saved = JSON.parse(localStorage.getItem('mr.session') || 'null');
      if (saved && saved.address && saved.token) signedIn(saved.address, saved.token);
    } catch {}
    el.auto.checked = localStorage.getItem('mr.auto') === 'on';

    el.connect.addEventListener('click', () => { if (S.me) copy(S.me.address); else connect(); });
    el.join.addEventListener('click', () => { SND.wake(); join(); });
    el.auto.addEventListener('change', () => {
      localStorage.setItem('mr.auto', el.auto.checked ? 'on' : 'off');
      if (el.auto.checked) { toast(t('toast.auto'), 'good'); if (S.round && S.round.phase === 'lobby' && !S.joined) join(true); }
    });
    el.lang.addEventListener('click', () => {
      I18N.toggle();
      el.lang.textContent = I18N.other();
      I18N.apply();
      renderField(); paintStatus(); paintClock();
      fetch('/api/history?n=12').then((r) => r.json()).then((h) => { renderWinners(h.rounds); renderTop(h.top); }).catch(() => {});
    });
    el.sound.addEventListener('click', () => { el.sound.style.opacity = SND.toggle() ? 1 : 0.4; });
    el.winnerAddr.addEventListener('click', () => copy(el.winnerAddr.textContent));

    el.skinBtn.addEventListener('click', () => showPanel('skin'));
    document.querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', () => showPanel(tab.dataset.panel));
    });

    el.chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = el.chatInput.value.trim();
      if (!text) return;
      if (!S.me) return toast(t('status.watch'));
      el.chatInput.value = '';
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: S.me.token, text })
      }).then((r) => r.json()).catch(() => ({ error: 'network' }));
      if (res.error) toast(res.error, 'bad');
    });

    /* Tapping the track cheers whatever marble was tapped. */
    el.canvas.addEventListener('click', (ev) => {
      if (!current || !S.me) return;
      const rect = el.canvas.getBoundingClientRect();
      const cam = RENDER.camera;
      const ox = (rect.width - RACE.WIDTH * cam.scale) / 2;
      const x = (ev.clientX - rect.left - ox) / cam.scale;
      const y = (ev.clientY - rect.top) / cam.scale + cam.y;
      let best = null, bestD = 60 * 60;
      for (const b of current.balls) {
        const d = (b.x - x) * (b.x - x) + (b.y - y) * (b.y - y);
        if (d < bestD) { bestD = d; best = b; }
      }
      if (best) sendCheer(best.id);
    });

    document.addEventListener('visibilitychange', () => { if (!document.hidden) last = 0; });
    connectStream();
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
