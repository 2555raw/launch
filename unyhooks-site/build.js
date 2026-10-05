/* UnyHooks builder — page behaviour. builder.js does the work (understanding
   the request, writing the Solidity); this file wires it to the page:
   conversation, settings form, code view, copy and download. The current
   hook is remembered in this browser only. */

(() => {
  'use strict';

  const B = window.UnyBuilder;
  const CONFIG = window.UNYHOOKS || {};
  const NET = CONFIG.NETWORK || {};

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- state ---------- */

  const KEY = 'unyhooks-builder';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { return null; } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) { /* storage blocked */ } };

  const saved = load();
  const state = saved && B.RECIPES[saved.recipe]
    ? { recipe: saved.recipe, settings: { ...B.defaults(saved.recipe), ...saved.settings }, view: 'hook' }
    : { recipe: 'fee', settings: B.defaults('fee'), view: 'hook' };

  let current = null;

  /* ---------- wallet chip ---------- */

  const wallet = $('#wallet');
  try {
    const s = JSON.parse(sessionStorage.getItem('unyhooks-session') || 'null');
    if (s?.address) {
      wallet.classList.add('is-on');
      wallet.innerHTML = `<code>${esc(s.address.slice(0, 6))}…${esc(s.address.slice(-4))}</code>`;
      wallet.title = s.address;
    }
  } catch (_) { /* storage blocked */ }

  $$('[data-net="name"]').forEach((el) => { if (NET.name) el.textContent = NET.name; });
  if (NET.poolManager) $('#pm-known').textContent = NET.poolManager;

  const colour = B.highlight;

  const renderCode = (text, flashLines = []) => {
    const lines = text.replace(/\n$/, '').split('\n');
    $('#code code').innerHTML = lines
      .map((l, i) => `<span class="ln${flashLines.includes(i) ? ' flash' : ''}">${colour(l) || ' '}</span>`)
      .join('');
    $('#lines').textContent = `${lines.length} lines`;
  };

  /* ---------- settings form ---------- */

  const renderRecipes = () => {
    $('#recipes').innerHTML = Object.entries(B.RECIPES).map(([key, r]) =>
      `<button class="bd-recipe${key === state.recipe ? ' is-active' : ''}" type="button" role="tab" aria-selected="${key === state.recipe}" data-recipe="${key}">${esc(r.title)}</button>`
    ).join('');
    $('#blurb').textContent = B.RECIPES[state.recipe].blurb;
  };

  const fieldHtml = (f) => {
    const v = state.settings[f.key];
    const id = `f-${state.recipe}-${f.key}`;
    if (f.type === 'checkbox') {
      return `<label class="bd-check" for="${id}"><input id="${id}" type="checkbox" data-key="${f.key}"${v ? ' checked' : ''}>${esc(f.label)}</label>`;
    }
    const attrs = f.type === 'number'
      ? `type="number" inputmode="decimal" min="${f.min}" max="${f.max}" step="${f.step}"`
      : f.type === 'time' ? 'type="time"' : 'type="text" spellcheck="false" placeholder="0x…"';
    const unit = f.key === 'maxBuy' ? (Number(state.settings.pairDecimals) === 6 ? 'USDC' : 'ETH') : f.unit;
    return `<div class="bd-field" data-field="${f.key}">
      <label for="${id}">${esc(f.label)}</label>
      <div class="bd-input"><input id="${id}" ${attrs} data-key="${f.key}" data-type="${f.type}" value="${esc(v ?? '')}">${unit ? `<span class="bd-unit">${esc(unit)}</span>` : ''}</div>
    </div>`;
  };

  const renderFields = () => {
    const fields = B.RECIPES[state.recipe].fields;
    const main = fields.filter((f) => !f.advanced).map(fieldHtml).join('');
    const adv = fields.filter((f) => f.advanced);
    $('#fields').innerHTML = main + (adv.length
      ? `<details class="bd-advanced"><summary>More options</summary>${adv.map(fieldHtml).join('')}</details>`
      : '');
  };

  /* ---------- output ---------- */

  const PERM_LABEL = {
    afterSwap: 'afterSwap', afterSwapReturnDelta: 'afterSwapReturnDelta',
    afterInitialize: 'afterInitialize', beforeSwap: 'beforeSwap'
  };

  const summaryFor = (recipe, s) => {
    if (recipe === 'fee') return [
      `Takes <b>${esc(s.feePercent)}%</b> of every swap, from the token leaving the pool on a normal swap.`,
      B.isAddress(s.recipient) ? `Sends it straight to <code>${esc(s.recipient)}</code>, fixed at deploy.` : 'Sends it to the wallet you set, fixed at deploy.',
      'Works with any pair, ETH included. The pool\'s own LP fee is charged as usual on top.'
    ];
    if (recipe === 'dynamic') return [
      `Charges <b>${esc(s.floorPercent)}%</b> when the price is still and up to <b>${esc(s.ceilingPercent)}%</b> when it moves.`,
      `Reaches the top after a <b>${esc(s.fullMovePercent)}%</b> price move within about ${esc(s.windowMinutes)} minute${Number(s.windowMinutes) === 1 ? '' : 's'}.`,
      'The fee goes to liquidity providers, like any pool fee.'
    ];
    if (recipe === 'launch') return [
      `For the first <b>${esc(s.windowMinutes)} minutes</b>, each buy is capped at <b>${esc(s.maxBuy)}</b> of the paying token.`,
      `A wallet must wait <b>${esc(s.cooldownSeconds)} s</b> between buys. Selling is never limited.`,
      'After the window the pool trades freely. Determined bots can still use many wallets; this slows them down.'
    ];
    return [
      `Swaps go through between <b>${esc(s.open)}</b> and <b>${esc(s.close)}</b> UTC${s.weekdaysOnly ? ', Monday to Friday' : ', every day'}.`,
      'Outside those hours swaps fail. Liquidity can be added or removed at any time.',
      'Hours are fixed in UTC: they do not move with daylight saving time.'
    ];
  };

  const render = (opts = {}) => {
    const prev = current ? (state.view === 'hook' ? current.source : current.script) : '';
    current = B.generate(state.recipe, state.settings);
    const text = state.view === 'hook' ? current.source : current.script;

    // Highlight the lines that changed, so an edit is easy to spot.
    let flash = [];
    if (opts.flash && prev) {
      const a = prev.split('\n');
      flash = text.split('\n').map((l, i) => (l !== a[i] ? i : -1)).filter((i) => i >= 0);
      if (flash.length > 30) flash = [];
    }
    renderCode(text, flash);
    $('#filename').textContent = state.view === 'hook' ? `src/${current.file}` : `script/${current.scriptFile}`;
    $('#step-src').textContent = `src/${current.file}`;
    $('#step-script').textContent = `script/${current.scriptFile}`;

    const ok = current.problems.length === 0;
    const status = $('#status');
    status.className = `bd-status ${ok ? 'is-ok' : 'is-todo'}`;
    status.textContent = ok ? 'Ready to deploy' : 'Needs details';
    const box = $('#problems');
    box.hidden = ok;
    box.innerHTML = ok ? '' : `<b>Before deploying:</b><ul>${current.problems.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`;

    $$('#fields .bd-field').forEach((el) => {
      const f = B.RECIPES[state.recipe].fields.find((x) => x.key === el.dataset.field);
      const bad = current.problems.some((p) => p.startsWith(f.label) || (f.type === 'address' && /address|wallet that receives/i.test(p)));
      el.classList.toggle('is-bad', bad);
    });

    $('#summary').innerHTML = summaryFor(state.recipe, state.settings).map((l) => `<li>${l}</li>`).join('');
    $('#perms').innerHTML = current.permissions.map((p) => `<span class="bd-chip">${PERM_LABEL[p] || p}</span>`).join('');
    const hex = current.flags.toString(16).padStart(4, '0');
    $('#flags').textContent = `0x…${hex}`;
    $('#flags-note').textContent = ' (low 14 bits; the deploy script finds one)';
    $('#pool-row').hidden = false;
    $('#poolfee').innerHTML = current.dynamicFee
      ? 'Create the pool with the <b>dynamic fee</b> flag (<code>0x800000</code>)'
      : 'Any fixed fee, for example 0.3% (<code>3000</code>)';

    save();
    // deploy.js follows the hook on screen through this event.
    document.dispatchEvent(new CustomEvent('unyhooks:hook', { detail: { recipe: state.recipe, settings: { ...state.settings }, hook: current } }));
  };

  /* ---------- conversation ---------- */

  const thread = $('#thread');
  const addMsg = (who, html) => {
    const el = document.createElement('div');
    el.className = `bd-msg ${who === 'me' ? 'bd-me' : 'bd-ai'}`;
    el.innerHTML = who === 'me'
      ? `<div class="bd-bubble">${esc(html)}</div>`
      : `<span class="bd-av"><svg aria-hidden="true"><use href="#uh-mark"/></svg></span><div class="bd-bubble">${html}</div>`;
    thread.appendChild(el);
    thread.scrollTop = thread.scrollHeight;
    return el;
  };

  const applyHook = (recipe, settings) => {
    state.recipe = recipe;
    state.settings = settings;
    renderRecipes();
    renderFields();
    render({ flash: true });
  };

  const missingHtml = (missing) => (missing.length
    ? `<p class="bd-todo">Still needed: ${missing.map(esc).join(' ')} Fill it in under Settings, or tell me here.</p>`
    : '<p>The hook is ready. Read it on the right, then deploy it.</p>');

  // The built-in reader: keywords, numbers, addresses and times. Always available.
  const replyFromRules = (text) => {
    const got = B.understand(text, state);
    if (!got) {
      addMsg('ai', `<p>I couldn't tell which kind of hook you want. Right now I can build:</p>
        <ul>${Object.values(B.RECIPES).map((r) => `<li><b>${esc(r.title)}</b>: ${esc(r.blurb)}</li>`).join('')}</ul>
        <p>Try one of the examples above, or pick a kind under Settings.</p>`);
      return;
    }
    applyHook(got.recipe, got.settings);
    const r = B.RECIPES[got.recipe];
    const heard = got.heard.length ? `<ul>${got.heard.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : '';
    addMsg('ai', `<p>Got it: a <b>${esc(r.title.toLowerCase())}</b> hook.</p>${heard}${missingHtml(got.missing)}`);
  };

  // The AI side, served by server.js at /api/chat. When the page is hosted
  // without it (404, 405, 501, 503, or an answer that is not JSON) the page
  // stops asking and uses the built-in reader for the rest of the visit.
  let aiOff = CONFIG.AI_URL === false;
  const askAI = async (text) => {
    if (aiOff) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    try {
      const res = await fetch(CONFIG.AI_URL || 'api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, current: { recipe: state.recipe, settings: state.settings } }),
        signal: ctrl.signal
      });
      if ([404, 405, 501, 503].includes(res.status)) { aiOff = true; return null; }
      if (!res.ok) return null;
      const data = await res.json().catch(() => { aiOff = true; return null; });
      return data && data.source === 'ai' && typeof data.reply === 'string' ? data : null;
    } catch (_) {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  let asking = false;
  const reply = async (text) => {
    if (asking) return;
    asking = true;
    prompt.disabled = true;
    const typing = aiOff ? null : addMsg('ai', '<p class="bd-typing" aria-label="Thinking"><i></i><i></i><i></i></p>');
    try {
      const ai = await askAI(text);
      if (typing) typing.remove();
      if (!ai) { replyFromRules(text); return; }
      const said = esc(ai.reply).replace(/\n+/g, '</p><p>');
      if (!ai.recipe || !B.RECIPES[ai.recipe]) { addMsg('ai', `<p>${said}</p>`); return; }
      applyHook(ai.recipe, { ...B.defaults(ai.recipe), ...ai.settings });
      addMsg('ai', `<p>${said}</p>${missingHtml(current.problems)}`);
    } finally {
      asking = false;
      prompt.disabled = false;
    }
  };

  $('#examples').innerHTML = B.EXAMPLES.map((e) => `<button class="bd-example" type="button">${esc(e)}</button>`).join('');
  $('#examples').addEventListener('click', (e) => {
    const btn = e.target.closest('.bd-example');
    if (!btn) return;
    addMsg('me', btn.textContent);
    reply(btn.textContent);
  });

  const prompt = $('#prompt');
  $('#ask').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = prompt.value.trim();
    if (!text) return;
    addMsg('me', text);
    prompt.value = '';
    reply(text);
  });
  prompt.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#ask').requestSubmit(); }
  });

  /* ---------- settings events ---------- */

  $('#recipes').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-recipe]');
    if (!btn || btn.dataset.recipe === state.recipe) return;
    state.recipe = btn.dataset.recipe;
    state.settings = B.defaults(state.recipe);
    renderRecipes();
    renderFields();
    render();
  });

  const onField = (e) => {
    const input = e.target.closest('[data-key]');
    if (!input) return;
    const key = input.dataset.key;
    state.settings[key] = input.type === 'checkbox' ? input.checked : input.value.trim();
    if (key === 'pairDecimals') {
      const unit = $('[data-field="maxBuy"] .bd-unit');
      if (unit) unit.textContent = Number(input.value) === 6 ? 'USDC' : 'ETH';
    }
    render({ flash: true });
  };
  $('#fields').addEventListener('input', onField);
  $('#fields').addEventListener('change', onField);
  $('#fields').addEventListener('submit', (e) => e.preventDefault());

  /* ---------- code view ---------- */

  $$('.bd-tab').forEach((tab) => tab.addEventListener('click', () => {
    state.view = tab.dataset.view;
    $$('.bd-tab').forEach((t) => {
      t.classList.toggle('is-active', t === tab);
      t.setAttribute('aria-selected', String(t === tab));
    });
    render();
  }));

  const toastEl = document.createElement('div');
  toastEl.className = 'bd-toast';
  toastEl.setAttribute('role', 'status');
  document.body.appendChild(toastEl);
  let toastTimer;
  const toast = (msg) => {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 1800);
  };

  const shownText = () => (state.view === 'hook' ? current.source : current.script);
  const shownFile = () => (state.view === 'hook' ? current.file : current.scriptFile);

  $('#copy').addEventListener('click', async () => {
    const text = shownText();
    try {
      await navigator.clipboard.writeText(text);
      toast(`Copied ${shownFile()}`);
    } catch (_) {
      // Fall back to selecting the code so it can be copied by hand.
      const range = document.createRange();
      range.selectNodeContents($('#code'));
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      toast('Selected: press Ctrl+C (or ⌘C) to copy');
    }
  });

  $('#download').addEventListener('click', () => {
    const blob = new Blob([shownText()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = shownFile();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Downloading ${shownFile()}`);
  });

  /* ---------- start ---------- */

  window.UnyBuild = { current: () => ({ recipe: state.recipe, settings: { ...state.settings }, hook: current }) };

  renderRecipes();
  renderFields();
  render();

  // A request handed over from the landing page (build.html#ask=…) is not
  // possible inside every host, so the landing passes it through storage.
  try {
    const handoff = sessionStorage.getItem('unyhooks-ask');
    if (handoff) {
      sessionStorage.removeItem('unyhooks-ask');
      addMsg('me', handoff);
      reply(handoff);
    }
  } catch (_) { /* storage blocked */ }
})();
