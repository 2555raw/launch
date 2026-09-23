/* spinpad — the whole app.
 *
 * The rule the product is built around: a coin cannot be launched until the
 * dial has been spun, and the colour it stops on decides the underlying asset.
 * That is enforced in three places on purpose — the launch button starts
 * disabled, the step machine refuses to reach step 3 without a resolved spin,
 * and launch() checks the spin again before it writes anything. Forcing the
 * button from the console gets you nowhere.
 *
 * Nothing here touches a chain. Caps, replies and curve progress are invented
 * numbers and the UI says so.
 */

(() => {
  'use strict';

  /* ---------- the four colours, the four assets ---------- */

  const COLORS = {
    green:  { id: 'green',  label: 'verde',    asset: 'Nvidia', ticker: 'NVDA' },
    yellow: { id: 'yellow', label: 'amarillo', asset: 'Amazon', ticker: 'AMZN' },
    blue:   { id: 'blue',   label: 'azul',     asset: 'Meta',   ticker: 'META' },
    red:    { id: 'red',    label: 'rojo',     asset: 'Tesla',  ticker: 'TSLA' },
  };

  // Quadrants run clockwise from twelve o'clock, in the order the labels sit
  // around the dial: top-right, bottom-right, bottom-left, top-left.
  const LIMBS = ['mano derecha', 'pie derecho', 'pie izquierdo', 'mano izquierda'];

  // Mat order, rotated one step per quadrant so no two neighbouring quadrants
  // start on the same colour. Four sectors per colour, sixteen in total.
  const BASE = ['green', 'yellow', 'blue', 'red'];
  const SECTORS = [];
  for (let q = 0; q < 4; q++) {
    for (let k = 0; k < 4; k++) {
      SECTORS.push({ color: BASE[(k + q) % 4], limb: LIMBS[q] });
    }
  }

  const SEG = 360 / SECTORS.length;   // 22.5 degrees
  const GRADUATE = 69000;             // simulated cap that fills the curve
  const KEY = 'spinpad.coins.v1';

  /* ---------- small helpers ---------- */

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const rnd = (n) => {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] % n;           // 2^32 divides by 16 and by 1000, so this stays flat
  };

  const miles = (n) => n.toLocaleString('es-ES');

  const cap = (n) => n >= 1e6
    ? '$' + (n / 1e6).toFixed(1) + 'M'
    : n >= 1000 ? '$' + (n / 1000).toFixed(1) + 'K' : '$' + n;

  const hace = (ts) => {
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return 'hace ' + Math.floor(s) + ' s';
    if (s < 3600) return 'hace ' + Math.floor(s / 60) + ' min';
    if (s < 86400) return 'hace ' + Math.floor(s / 3600) + ' h';
    return 'hace ' + Math.floor(s / 86400) + ' d';
  };

  const initials = (t) => t.replace(/[^A-Z0-9]/gi, '').slice(0, 3).toUpperCase() || '??';

  /* ---------- store ---------- */

  const DEMO = [
    { name: 'Ruleta Rusa Capital', ticker: 'RRC',     color: 'red',    limb: 'pie derecho',    supply: 1000000000, desc: 'la casa siempre gira. tu solo pones el pie.',        cap: 48200, replies: 214, age: 41 },
    { name: 'Se Me Va La Mano',    ticker: 'MANO',    color: 'green',  limb: 'mano derecha',   supply: 500000000,  desc: 'cayo verde y ahora vivimos de las gpu ajenas.',       cap: 31800, replies: 96,  age: 96 },
    { name: 'Caida Controlada',    ticker: 'CAIDA',   color: 'blue',   limb: 'mano izquierda', supply: 1000000000, desc: 'aguantar la postura es toda la tesis de inversion.',  cap: 12400, replies: 41,  age: 180 },
    { name: 'Amarillo O Nada',     ticker: 'NADA',    color: 'yellow', limb: 'pie izquierdo',  supply: 210000000,  desc: 'pedimos verde, salio amarillo, se lanza igual.',      cap: 8100,  replies: 27,  age: 320 },
    { name: 'Postura Imposible',   ticker: 'POSTURA', color: 'green',  limb: 'pie derecho',    supply: 888888888,  desc: 'cuatro extremidades, cuatro colores, cero plan.',     cap: 5600,  replies: 12,  age: 615 },
  ];

  const seed = () => DEMO.map((d, i) => ({
    id: 'demo' + i,
    name: d.name, ticker: d.ticker, color: d.color, limb: d.limb,
    supply: d.supply, desc: d.desc, cap: d.cap, replies: d.replies,
    ts: Date.now() - d.age * 60000, demo: true,
  }));

  let coins = [];

  const load = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw === null) { coins = seed(); save(); return; }
      const parsed = JSON.parse(raw);
      coins = Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      coins = seed();              // storage blocked or corrupt: run from memory
    }
  };

  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(coins.slice(0, 60))); } catch (e) { /* ignore */ }
  };

  /* ---------- the dial ---------- */

  const sectorPath = (cx, cy, r, a0, a1) => {
    const pt = (a) => {
      const rad = (a - 90) * Math.PI / 180;
      return [(cx + r * Math.cos(rad)).toFixed(2), (cy + r * Math.sin(rad)).toFixed(2)];
    };
    const [x0, y0] = pt(a0), [x1, y1] = pt(a1);
    return `M${cx} ${cy} L${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1} Z`;
  };

  const drawDial = (svg) => {
    const hex = { green: '#2FA84F', yellow: '#FDD208', blue: '#1B75BC', red: '#E4322B' };
    let out = '<circle cx="100" cy="100" r="93" fill="#fff"/>';
    SECTORS.forEach((s, i) => {
      out += `<path d="${sectorPath(100, 100, 90, i * SEG, (i + 1) * SEG)}" fill="${hex[s.color]}" class="sp-cut" stroke="#fff"/>`;
    });
    out += '<circle cx="100" cy="100" r="93" class="sp-rim"/>';
    out += '<circle cx="100" cy="100" r="19" fill="#fff" stroke="#14161A" stroke-width="2"/>';
    svg.innerHTML = out;
  };

  /* ---------- board rendering ---------- */

  const grid = $('grid');
  const state = { filter: 'all', sort: 'new', q: '' };

  const visible = () => {
    let list = coins.slice();
    if (state.filter !== 'all') list = list.filter((c) => c.color === state.filter);
    if (state.q) {
      const q = state.q.toLowerCase();
      list = list.filter((c) => (c.name + ' ' + c.ticker).toLowerCase().includes(q));
    }
    const by = { new: (a, b) => b.ts - a.ts, cap: (a, b) => b.cap - a.cap, replies: (a, b) => b.replies - a.replies };
    return list.sort(by[state.sort]);
  };

  const coinCard = (c) => {
    const col = COLORS[c.color];
    const pct = Math.min(100, Math.round(c.cap / GRADUATE * 100));
    return `
      <article class="sp-coin" data-color="${c.color}">
        <span class="sp-avatar">${esc(initials(c.ticker))}</span>
        <div class="sp-coin-body">
          <p class="sp-coin-name">${esc(c.name)} <em>$${esc(c.ticker)}</em></p>
          <p class="sp-coin-meta">cap <b>${cap(c.cap)}</b> · ${c.replies} resp · ${hace(c.ts)}${c.demo ? '<span class="sp-coin-demo">demo</span>' : ''}</p>
          <p class="sp-coin-desc">${esc(c.desc || 'sin descripcion.')}</p>
          <span class="sp-coin-asset"><i class="sp-dot" data-color="${c.color}"></i>${esc(col.asset)} · ${esc(col.ticker)}</span>
          <div class="sp-curve"><i style="width:${pct}%"></i></div>
        </div>
      </article>`;
  };

  const renderHill = () => {
    const card = $('hill');
    const top = coins.slice().sort((a, b) => b.cap - a.cap)[0];
    if (!top) { card.hidden = true; return; }
    card.hidden = false;
    const col = COLORS[top.color];
    card.dataset.color = top.color;
    $('hillAvatar').textContent = initials(top.ticker);
    $('hillName').textContent = top.name + ' ($' + top.ticker + ')';
    $('hillMeta').innerHTML = `cap <b>${cap(top.cap)}</b> · ${top.replies} resp · ${esc(col.asset)} (${esc(col.ticker)}) · ${esc(top.limb)}`;
    $('hillDesc').textContent = top.desc || 'sin descripcion.';
    $('hillCurve').style.width = Math.min(100, Math.round(top.cap / GRADUATE * 100)) + '%';
  };

  const renderTicker = () => {
    const last = coins.slice().sort((a, b) => b.ts - a.ts).slice(0, 10);
    if (!last.length) { $('tickerTrack').innerHTML = ''; return; }
    const one = last.map((c) => {
      const col = COLORS[c.color];
      return `<span class="sp-tick"><i class="sp-dot" data-color="${c.color}"></i><b>$${esc(c.ticker)}</b> salio ${esc(col.label)} → ${esc(col.ticker)} · ${hace(c.ts)}</span>`;
    }).join('');
    $('tickerTrack').innerHTML = one + one;   // two copies: the marquee loops at -50%
  };

  const renderBoard = () => {
    const list = visible();
    grid.innerHTML = list.map(coinCard).join('');
    $('empty').hidden = list.length > 0;
    $('count').textContent = `${list.length} de ${coins.length} coins · numeros simulados`;
    renderHill();
    renderTicker();
  };

  /* ---------- the create flow ---------- */

  const modal = $('create');
  const pad = $('pad');
  const flow = { step: 1, draft: null, spin: null, spinning: false, rot: 0 };

  const setStep = (n) => {
    flow.step = n;
    pad.dataset.step = String(n);
    [...$('steps').children].forEach((li) => {
      const s = Number(li.dataset.step);
      li.classList.toggle('is-on', s === n);
      li.classList.toggle('is-done', s < n);
    });

    $('fields').disabled = n > 1;
    $('toSpin').hidden = n > 1;
    $('backToForm').hidden = n !== 2 || flow.spinning;
    $('discard').hidden = n !== 3;
    $('spin').disabled = n !== 2 || flow.spinning || !!flow.spin;
    $('launch').disabled = n !== 3 || !flow.spin;
    $('spinCount').textContent = 'giros ' + (flow.spin ? 1 : 0) + '/1';
  };

  const err = (id, msg) => {
    const box = document.querySelector(`.sp-err[data-for="${id}"]`);
    box.textContent = msg || '';
    box.classList.toggle('is-on', !!msg);
    $(id).setAttribute('aria-invalid', msg ? 'true' : 'false');
    return !msg;
  };

  const readForm = () => {
    const name = $('fName').value.trim();
    const ticker = $('fTicker').value.trim().toUpperCase();
    const supply = Number($('fSupply').value.replace(/\D/g, ''));
    const desc = $('fDesc').value.trim();

    let ok = true;
    ok = err('fName', name.length < 2 || name.length > 32 ? 'entre 2 y 32 caracteres.' : '') && ok;
    ok = err('fTicker', /^[A-Z0-9]{2,8}$/.test(ticker) ? '' : 'de 2 a 8 letras o numeros, sin espacios.') && ok;
    ok = err('fSupply', !supply || supply < 1000 || supply > 1e12 ? 'entre 1.000 y 1.000.000.000.000.' : '') && ok;
    ok = err('fDesc', desc.length > 140 ? 'maximo 140 caracteres.' : '') && ok;

    if (coins.some((c) => c.ticker === ticker)) {
      ok = err('fTicker', 'ese ticker ya esta en el tablero.') && ok;
    }
    return ok ? { name, ticker, supply, desc } : null;
  };

  const doSpin = () => {
    if (flow.step !== 2 || flow.spin || flow.spinning) return;
    flow.spinning = true;
    setStep(2);
    $('status').textContent = 'girando… la aguja decide, tu no.';

    const i = rnd(SECTORS.length);
    const centre = i * SEG + SEG / 2;
    const jitter = (rnd(1000) / 1000 - 0.5) * (SEG - 6);
    const turns = 5 + rnd(3);
    const target = centre + jitter;
    const delta = ((target - flow.rot) % 360 + 360) % 360;
    flow.rot += turns * 360 + delta;

    const needle = $('needle');
    needle.style.transform = `rotate(${flow.rot}deg)`;

    const done = () => {
      needle.removeEventListener('transitionend', done);
      clearTimeout(guard);
      resolveSpin(SECTORS[i]);
    };
    needle.addEventListener('transitionend', done);
    // transitionend never fires on a tab that was backgrounded mid-spin
    const guard = setTimeout(done, 5200);
  };

  const resolveSpin = (sector) => {
    if (flow.spin) return;
    flow.spinning = false;
    flow.spin = sector;

    const col = COLORS[sector.color];
    $('result').hidden = false;
    $('result').dataset.color = sector.color;
    $('resDot').dataset.color = sector.color;
    $('resColor').textContent = col.label + ' → ' + col.asset;
    $('resLimb').textContent = sector.limb + ' · ' + col.ticker;
    $('resLine').textContent = `tu coin queda atada a ${col.asset} (${col.ticker}). no se cambia ni se vuelve a girar.`;

    $('assetSlot').dataset.color = sector.color;
    $('assetName').textContent = col.asset + ' · ' + col.ticker;
    $('assetHint').textContent = 'bloqueado por el giro';
    $('status').textContent = `salio ${col.label}. el boton de lanzar ya esta encendido.`;

    setStep(3);
  };

  const launch = () => {
    // The rule, checked again at the last possible moment.
    if (!flow.spin || !flow.draft || flow.step !== 3) {
      $('status').textContent = 'no hay giro. aqui no se lanza nada sin girar.';
      setStep(flow.step);          // put back any button that was forced open
      return;
    }

    const col = COLORS[flow.spin.color];
    const coin = {
      id: 'c' + Date.now().toString(36) + rnd(4096).toString(36),
      name: flow.draft.name,
      ticker: flow.draft.ticker,
      supply: flow.draft.supply,
      desc: flow.draft.desc,
      color: flow.spin.color,
      limb: flow.spin.limb,
      cap: 3800 + rnd(2600),       // simulated, like every figure on the board
      replies: rnd(4),
      ts: Date.now(),
      demo: false,
    };

    coins.unshift(coin);
    save();
    renderBoard();
    showTicket(coin, col);
  };

  const showTicket = (coin, col) => {
    pad.hidden = true;
    const t = $('ticket');
    t.hidden = false;
    t.dataset.color = coin.color;
    $('tkId').textContent = coin.id;
    $('tkAvatar').textContent = initials(coin.ticker);
    $('tkName').textContent = coin.name;
    $('tkTicker').textContent = '$' + coin.ticker;
    $('tkRows').innerHTML = [
      ['color del giro', col.label],
      ['activo subyacente', col.asset + ' (' + col.ticker + ')'],
      ['postura', coin.limb],
      ['suministro', miles(coin.supply)],
      ['cap inicial', cap(coin.cap) + ' (simulada)'],
      ['hora', new Date(coin.ts).toLocaleString('es-ES')],
    ].map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
    $('tkNote').textContent =
      `${coin.name} sale atada a ${col.asset} porque la aguja cayo en ${col.label} sobre ${coin.limb}. ` +
      'un giro, un lanzamiento: para otra coin hay que volver a girar.';
    $('tkCopy').textContent = 'copiar acta';
  };

  const resetFlow = () => {
    flow.draft = null;
    flow.spin = null;
    flow.spinning = false;
    $('form').reset();
    $('fSupply').value = '1.000.000.000';
    $('descCount').textContent = '0/140';
    ['fName', 'fTicker', 'fSupply', 'fDesc'].forEach((id) => err(id, ''));
    $('result').hidden = true;
    $('assetSlot').dataset.color = 'none';
    $('assetName').textContent = 'lo decide la ruleta';
    $('assetHint').textContent = 'bloqueado hasta el giro';
    $('status').textContent = 'rellena los datos para desbloquear el giro.';
    $('ticket').hidden = true;
    pad.hidden = false;
    setStep(1);
  };

  const openCreate = () => {
    if (!modal.open) {
      if (typeof modal.showModal === 'function') modal.showModal();
      else modal.setAttribute('open', '');
    }
    $('fName').focus();
  };

  /* ---------- wiring ---------- */

  const init = () => {
    drawDial($('dial'));
    load();
    renderBoard();
    resetFlow();

    $('openCreate').addEventListener('click', openCreate);
    $('openCreate2').addEventListener('click', openCreate);
    modal.addEventListener('close', () => { if (!$('ticket').hidden) resetFlow(); });

    $('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const draft = readForm();
      if (!draft) return;
      flow.draft = draft;
      $('status').textContent = 'listo. un giro, y lo que salga manda.';
      setStep(2);
      $('spin').focus();
    });

    $('backToForm').addEventListener('click', () => {
      if (flow.spin || flow.spinning) return;     // spun already: no going back
      $('status').textContent = 'rellena los datos para desbloquear el giro.';
      setStep(1);
    });

    $('spin').addEventListener('click', doSpin);
    $('launch').addEventListener('click', launch);

    $('discard').addEventListener('click', () => {
      if (!confirm('esto tira el borrador entero: nombre, ticker, suministro y el giro. no es repetir el giro, es empezar de cero.')) return;
      flow.rot = 0;
      $('needle').style.transition = 'none';
      $('needle').style.transform = 'rotate(0deg)';
      requestAnimationFrame(() => { $('needle').style.transition = ''; });
      resetFlow();
    });

    $('tkAgain').addEventListener('click', () => { resetFlow(); $('fName').focus(); });

    $('tkCopy').addEventListener('click', async (e) => {
      const rows = [...$('tkRows').children].map((d) => d.querySelector('dt').textContent + ': ' + d.querySelector('dd').textContent);
      const text = ['spinpad — acta del giro', $('tkId').textContent, $('tkName').textContent + ' (' + $('tkTicker').textContent + ')', ...rows].join('\n');
      try {
        await navigator.clipboard.writeText(text);
        e.target.textContent = 'copiada';
      } catch (err2) {
        e.target.textContent = 'no se pudo copiar';
      }
      setTimeout(() => { e.target.textContent = 'copiar acta'; }, 1800);
    });

    $('fTicker').addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });

    // Only on blur: rewriting the value while the field has focus fights with
    // whatever the user (or the browser) is doing to it mid-edit.
    $('fSupply').addEventListener('blur', (e) => {
      const n = Number(e.target.value.replace(/\D/g, ''));
      e.target.value = n ? miles(n) : '';
    });

    $('fDesc').addEventListener('input', (e) => { $('descCount').textContent = e.target.value.length + '/140'; });

    $('filters').addEventListener('click', (e) => {
      const b = e.target.closest('.sp-chip');
      if (!b) return;
      state.filter = b.dataset.filter;
      [...$('filters').children].forEach((c) => c.classList.toggle('is-on', c === b));
      renderBoard();
    });

    $('sort').addEventListener('change', (e) => { state.sort = e.target.value; renderBoard(); });
    $('search').addEventListener('input', (e) => { state.q = e.target.value.trim(); renderBoard(); });

    $('clear').addEventListener('click', () => {
      if (!confirm('vacia el tablero de este navegador, incluidas las coins de ejemplo. sin vuelta atras.')) return;
      coins = [];
      save();
      renderBoard();
    });

    document.querySelectorAll('[data-scroll]').forEach((el) => {
      el.addEventListener('click', () => {
        const t = document.getElementById(el.dataset.scroll);
        if (t) t.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
    });

    // the board ages: "hace 3 min" should not stay frozen on an open tab
    setInterval(renderBoard, 60000);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
