/* The /ask app. One file, hash-routed views, everything through /api. */
(() => {
  const { api, getKey, setKey, usd, cr, pct, esc, mark, vendorMark, theme, toast } = seekr;
  const $ = (s, r = document) => r.querySelector(s);
  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

  const state = {
    me: null, cfg: null, models: [], cats: [], model: null, imgModel: null, vidModel: null, ttsModel: null,
    mode: 'ask', skill: null, chat: null, chats: [], library: [], attachments: [], web: false, streaming: false, size: '1024x1024', seconds: 5
  };

  const ICONS = {
    ask: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16v11H9l-5 4z"/></svg>',
    code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m8 8-4 4 4 4m8-8 4 4-4 4M14 5l-4 14"/></svg>',
    images: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m3 16 5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.5"/></svg>',
    video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/></svg>',
    collab: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5a5 5 0 016 5"/></svg>',
    attach: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21 11.5-8.5 8.5a5 5 0 01-7-7l9-9a3.3 3.3 0 014.7 4.7l-9 9a1.6 1.6 0 01-2.3-2.3l8-8"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 19V5m0 0-6 6m6-6 6 6"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16v11H9l-5 4z"/></svg>',
    wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 15h2"/></svg>',
    key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="12" r="4"/><path d="M12 12h9m-3 0v3m-3-3v2"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>',
    cap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/></svg>',
    wrench: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a4 4 0 00-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 005.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/></svg>',
    pulse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 000-7.8z"/><path d="M3.5 12h4l2-3 3 6 2-3h6"/></svg>',
    translate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h9M8.5 3v2M6 5c1 3.5 3.5 6 6 7M11 5c-1 3.5-3.5 6.5-7 8"/><path d="m13 21 4-9 4 9M14.5 18h5"/></svg>',
    piggy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 10c.7 0 2 .5 2 2v2h-2l-1 2v3h-3v-2h-4v2H8v-3c-2-1-3-3-3-5a6 6 0 016-6h3c2 0 4 1 5 3z"/><circle cx="15.5" cy="10.5" r=".8" fill="currentColor"/><path d="M5 11H3"/></svg>',
    bulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0012 3z"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h6"/></svg>',
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 7h12l1 14H5z"/><path d="M9 7a3 3 0 016 0"/></svg>',
    speaker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 010 6"/></svg>'
  };

  /* ---------- markdown (small, safe) ---------- */
  function md(src) {
    const blocks = [];
    let s = esc(src).replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => { blocks.push({ lang, code }); return `\u0000${blocks.length - 1}\u0000`; });
    s = s.replace(/^### (.*)$/gm, '<h3>$1</h3>').replace(/^## (.*)$/gm, '<h2>$1</h2>').replace(/^# (.*)$/gm, '<h1>$1</h1>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>').replace(/`([^`\n]+)`/g, '<code>$1</code>');
    s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a class="accent" href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/(?:^(?:\d+\. .*)\n?)+/gm, (m) => '<ol>' + m.trim().split('\n').map((l) => `<li>${l.replace(/^\d+\. /, '')}</li>`).join('') + '</ol>');
    s = s.replace(/(?:^(?:[-*] .*)\n?)+/gm, (m) => '<ul>' + m.trim().split('\n').map((l) => `<li>${l.replace(/^[-*] /, '')}</li>`).join('') + '</ul>');
    s = s.split(/\n{2,}/).map((p) => (/^<(h\d|ul|ol|\u0000)/.test(p) || /\u0000/.test(p) ? p : `<p>${p.replace(/\n/g, '<br>')}</p>`)).join('');
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => { const b = blocks[i]; const html = b.lang === 'html' ? `<div class="preview"><div class="ph"><span>preview</span><button class="copy" data-copy="${i}">copy code</button></div><iframe sandbox="allow-scripts" srcdoc="${esc(unesc(b.code))}"></iframe></div>` : ''; return `<pre data-lang="${b.lang}"><code>${b.code}</code></pre>${html}`; });
  }
  const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

  /* ---------- boot ---------- */
  async function boot() {
    const [cfg, mm] = await Promise.all([api('/api/config'), api('/api/models')]);
    state.cfg = cfg; state.models = mm.models; state.cats = mm.categories;
    const q = new URLSearchParams(location.search);
    state.model = state.models.find((m) => m.id === q.get('model') && m.kind === 'chat') || state.models.find((m) => m.id === mm.default);
    state.imgModel = state.models.find((m) => m.id === q.get('model') && m.kind === 'image') || state.models.find((m) => (m.rec || []).includes('image'));
    state.vidModel = state.models.find((m) => m.id === q.get('model') && m.kind === 'video') || state.models.find((m) => (m.rec || []).includes('video'));
    state.ttsModel = state.models.find((m) => m.kind === 'tts');
    if (q.get('model')) { const m = state.models.find((x) => x.id === q.get('model')); if (m) state.mode = { chat: 'ask', image: 'images', video: 'video' }[m.kind] || 'ask'; }
    if (getKey()) await loadMe(); else renderSignbox();
    wireSidebar();
    window.addEventListener('hashchange', route);
    route();
  }

  async function loadMe() {
    try { state.me = (await api('/api/me')).account; } catch (e) { if (e.status === 401) { setKey(''); state.me = null; } }
    renderSignbox();
    if (state.me) { loadChats(); loadLibrary(); }
  }

  function renderSignbox() {
    const b = $('#signbox');
    if (!state.me) { b.innerHTML = '<span class="mono">NOT SIGNED IN</span><b>Sign in to start</b>'; b.onclick = openSignIn; return; }
    const a = state.me;
    b.innerHTML = `<span class="mono">BALANCE</span><b>${cr(a.balance)} credits</b><small>${a.username ? '@' + esc(a.username) : a.email ? esc(a.email) : a.wallet ? a.wallet.slice(0, 6) + '…' + a.wallet.slice(-4) : 'access key'}${a.tier.holder ? ` · ${a.holdingsPct.toFixed(3)}% $WONDR` : ''}</small>`;
    b.onclick = () => { location.hash = '#account'; };
  }

  async function loadChats() { try { state.chats = (await api('/api/chats')).chats; } catch { state.chats = []; } renderRecent(); }
  async function loadLibrary() { try { state.library = (await api('/api/library')).items; } catch { state.library = []; } if (currentView() === 'home') renderLibBlock(); }

  function renderRecent(filter = '') {
    const r = $('#recent');
    const list = state.chats.filter((c) => !filter || c.title.toLowerCase().includes(filter.toLowerCase())).slice(0, 30);
    r.innerHTML = list.length ? list.map((c) => `<a href="#chat/${c.id}" class="${state.chat && state.chat.id === c.id ? 'on' : ''}">${ICONS.chat}<span>${esc(c.title)}</span></a>`).join('') : `<span class="empty">${state.me ? 'No chats yet.' : 'Sign in to keep your chats.'}</span>`;
  }

  function wireSidebar() {
    $('#newChat').onclick = () => { state.chat = null; state.mode = 'ask'; state.skill = null; location.hash = '#home'; route(); };
    $('#searchBox').oninput = (e) => renderRecent(e.target.value);
    $('#themeBtn').onclick = () => theme.toggle();
    /* desktop: collapse the sidebar (remembered); phone: slide it away */
    const wide = () => matchMedia('(min-width: 861px)').matches;
    const app = document.querySelector('.app');
    const collapse = (on) => { app.classList.toggle('side-hidden', on); try { localStorage.setItem('seekr.sideHidden', on ? '1' : ''); } catch { /* private mode */ } };
    try { if (localStorage.getItem('seekr.sideHidden')) app.classList.add('side-hidden'); } catch { /* private mode */ }
    $('#sideClose').onclick = () => { if (wide()) collapse(true); else $('#side').classList.remove('open'); };
    $('#sideOpen').onclick = () => { if (wide()) collapse(false); else $('#side').classList.add('open'); };
    document.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); const p = $('#pickerBtn'); if (p) p.click(); } });
    $('#fileInput').onchange = (e) => uploadFiles([...e.target.files]);
  }

  /* ---------- routing ---------- */
  const currentView = () => (location.hash.slice(1) || 'home').split('/')[0].split('?')[0];
  async function route() {
    const [view, arg] = (location.hash.slice(1) || 'home').split('/');
    const v = view.split('?')[0];
    document.querySelectorAll('#sideNav a').forEach((a) => a.classList.toggle('on', a.dataset.view === (v === 'chat' ? 'home' : v)));
    $('#side').classList.remove('open');
    if (v === 'chat' && arg) { if (!state.me) return openSignIn(); try { state.chat = (await api('/api/chats/' + arg)).chat; state.mode = state.chat.mode === 'code' ? 'code' : 'ask'; state.skill = state.chat.skill || null; const m = state.models.find((x) => x.id === state.chat.model); if (m) state.model = m; } catch { state.chat = null; } renderRecent(); return renderHome(); }
    if (v === 'share' && arg) return renderShared(arg);
    if (v === 'account') return renderAccount(arg);
    if (v === 'library') return renderLibrary();
    if (v === 'files') return renderFiles();
    if (v === 'history') return renderHistory();
    if (v === 'collab') return renderCollab();
    if (v === 'home') { if (!(state.chat && state.chat.id)) state.chat = null; }
    renderHome();
  }

  /* ---------- home / chat ---------- */
  function renderHome() {
    const stage = $('#stage');
    const inChat = state.chat && state.chat.messages && state.chat.messages.length;
    stage.innerHTML = `
      ${inChat ? `<div class="shared-h"><div><div class="stage-logo" style="font-size:22px;margin:0"><img class="logo-mark" src="/art/brand/wondr-mark.svg" alt="" width="26" height="26">wondr</div><div class="note mono">${esc(state.chat.title)}</div></div><div class="cta-row"><button class="btn btn-ghost btn-sm" id="shareBtn">Share</button><button class="btn btn-ghost btn-sm" id="newBtn">New chat</button></div></div>` :
        `<div class="stage-logo"><img class="logo-mark" src="/art/brand/wondr-mark.svg" alt="" width="26" height="26">wondr</div><h1>What are we <span class="accent" id="modeWord">${{ ask: 'experimenting?', code: 'building?', images: 'picturing?', video: 'filming?' }[state.mode] || 'experimenting?'}</span></h1>`}
      <div class="modes" id="modes"></div>
      <div class="thread" id="thread"></div>
      <div class="composer" id="composer"></div>
      ${inChat ? '' : `<div class="block" id="libBlock"></div>`}`;
    renderModes();
    renderThread();
    renderComposer();
    if (!inChat) renderLibBlock();
    if (inChat) { $('#shareBtn').onclick = () => shareChat(state.chat.id); $('#newBtn').onclick = () => $('#newChat').click(); }
  }

  function renderModes() {
    const videoOn = (state.models || []).some((x) => x.kind === 'video' && x.live);
    if (!videoOn && state.mode === 'video') state.mode = 'ask';
    const modes = [['ask', 'Ask'], ['code', 'Code'], ['images', 'Images'], ...(videoOn ? [['video', 'Video']] : []), ['collab', 'Collab']];
    const m = $('#modes');
    m.innerHTML = modes.map(([id, label]) => `<button class="mode ${state.mode === id ? 'on' : ''}" data-mode="${id}">${ICONS[id]}${label}</button>`).join('');
    m.querySelectorAll('.mode').forEach((b) => b.onclick = (e) => { if (b.dataset.mode === 'collab') { location.hash = '#collab'; return; } if (b.dataset.mode === 'ask') { e.stopPropagation(); toggleSkills(); } else closeSkills(); state.mode = b.dataset.mode; renderModes(); renderComposer(); const w = $('#modeWord'); if (w) w.textContent = { ask: 'experimenting?', code: 'building?', images: 'picturing?', video: 'filming?' }[state.mode]; });
  }

  function skillsList() { return (state.cfg && state.cfg.skills) || []; }
  function closeSkills() { const p = $('#skillsPop'); if (p) p.remove(); }
  function toggleSkills() {
    if ($('#skillsPop')) return closeSkills();
    const host = $('#modes');
    const pop = el(`<div class="skills-pop" id="skillsPop" role="dialog" aria-label="Ask">
      <div class="sp-h">Ask</div>
      <button class="sp-main ${state.skill ? '' : 'on'}" data-skill=""><span class="sp-ic big">${ICONS.ask}</span><span><b>Ask anything</b><small>Any question, any model, the plain chat</small></span></button>
      <div class="sp-h">Or ask a skill</div>
      <div class="sp-grid">${skillsList().map((k) => `<button class="sp-item ${state.skill === k.id ? 'on' : ''}" data-skill="${k.id}"><span class="sp-ic">${ICONS[k.icon] || ICONS.ask}</span><span><b>${esc(k.title)}</b><small>${esc(k.blurb)}</small></span></button>`).join('')}</div>
    </div>`);
    host.insertAdjacentElement('afterend', pop);
    pop.addEventListener('click', (e) => e.stopPropagation());
    pop.querySelectorAll('[data-skill]').forEach((b) => b.onclick = () => { setSkill(b.dataset.skill || null); closeSkills(); });
    const away = () => { closeSkills(); document.removeEventListener('click', away); document.removeEventListener('keydown', esc1); };
    const esc1 = (e) => { if (e.key === 'Escape') away(); };
    setTimeout(() => { document.addEventListener('click', away); document.addEventListener('keydown', esc1); });
  }
  function setSkill(id) {
    state.skill = id;
    state.mode = 'ask';
    if (state.chat && state.chat.messages && state.chat.messages.length && state.chat.skill !== id) state.chat = null; // a new skill starts a new chat
    renderHome();
  }
  const currentSkill = () => skillsList().find((k) => k.id === state.skill) || null;

  function activeModel() { return state.mode === 'images' ? state.imgModel : state.mode === 'video' ? state.vidModel : state.model; }

  function renderComposer() {
    const c = $('#composer');
    const m = activeModel();
    const hints = { ask: `${m.name} answers as it thinks. Long questions can take a moment.`, code: `${m.name} thinks before it writes. A big build brief can take several minutes.`, images: `${m.name} renders one image per request at ${state.size}.`, video: m.live ? `${m.name} renders ${state.seconds}s of video. Clips take a few minutes.` : 'Video is not switched on yet: it needs a video provider connected on the server. Coming soon.' };
    const sk = state.mode === 'ask' ? currentSkill() : null;
    if (sk) hints.ask = `${sk.title}: ${sk.blurb.toLowerCase()}. ${m.name} answers${sk.web ? ' and searches when it helps' : ''}.`;
    const ph = { ask: sk ? ({ lookup: 'What do you want to look up?', write: 'Paste a draft or say what to write…', learn: 'What are you learning?', fix: 'What needs fixing, and on which device?', health: 'Paste a result or describe what you want to understand…', translate: 'Paste the text and say which language…', money: 'Describe the budget, loan or bill…', brainstorm: 'What do you need ideas for?', summarise: 'Paste anything long…', shop: 'What are you buying, and your budget?' }[sk.id] || 'Ask anything…') : 'Ask anything…', code: 'Describe what to build…', images: 'Describe the image…', video: 'Describe the clip…' };
    c.innerHTML = `
      <div class="hint">${esc(hints[state.mode])}</div>
      <div class="row"><span class="plus">+</span><textarea id="prompt" rows="1" placeholder="${ph[state.mode]}"></textarea></div>
      <div class="attach-list" id="attachList"></div>
      <div class="bar">
        <span class="pill-sm mode-pill"><span class="dot"></span>${sk ? esc(sk.title) : { ask: 'Ask', code: 'Code', images: 'Image', video: 'Video' }[state.mode]}${sk ? '<button class="pill-x" id="clearSkill" title="Back to plain chat">✕</button>' : ''}</span>
        <div class="picker"><button class="pill-sm" id="pickerBtn">${esc(m.name)}<span class="caret"></span></button><div class="menu" id="pickerMenu"></div></div>
        <span class="kbd">⌘K</span>
        ${state.mode === 'images' ? `<select class="pill-sm" id="sizeSel"><option value="1024x1024">1:1</option><option value="1536x1024">3:2</option><option value="1024x1536">2:3</option></select>` : ''}
        ${state.mode === 'video' ? `<select class="pill-sm" id="secSel">${[4, 5, 6, 8, 10].map((s) => `<option value="${s}">${s}s</option>`).join('')}</select>` : ''}
        <span class="sp"></span>
        ${state.mode === 'ask' || state.mode === 'code' ? `<button class="icon-btn" id="attachBtn" title="Attach files">${ICONS.attach}</button><button class="icon-btn ${state.web ? 'accent' : ''}" id="webBtn" title="Search the web">${ICONS.globe}</button><button class="icon-btn" id="micBtn" title="Speak">${ICONS.mic}</button>` : ''}
        <span class="est" id="est">~0 cr</span>
        <button class="send" id="sendBtn" title="Send">${ICONS.send}</button>
      </div>`;
    const ta = $('#prompt');
    const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(240, ta.scrollHeight) + 'px'; };
    ta.oninput = () => { grow(); estimate(); };
    ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
    $('#sendBtn').onclick = send;
    if ($('#clearSkill')) $('#clearSkill').onclick = () => setSkill(null);
    $('#pickerBtn').onclick = (e) => { e.stopPropagation(); togglePicker(); };
    document.addEventListener('click', () => { const mn = $('#pickerMenu'); if (mn) mn.classList.remove('open'); }, { once: true });
    if ($('#sizeSel')) { $('#sizeSel').value = state.size; $('#sizeSel').onchange = (e) => { state.size = e.target.value; renderComposer(); }; }
    if ($('#secSel')) { $('#secSel').value = String(state.seconds); $('#secSel').onchange = (e) => { state.seconds = Number(e.target.value); renderComposer(); }; }
    if ($('#attachBtn')) $('#attachBtn').onclick = () => { if (!state.me) return openSignIn(); $('#fileInput').click(); };
    if ($('#webBtn')) $('#webBtn').onclick = () => { state.web = !state.web; $('#webBtn').classList.toggle('accent', state.web); toast(state.web ? 'Web search on: Claude models search when it helps.' : 'Web search off.'); };
    if ($('#micBtn')) $('#micBtn').onclick = record;
    renderAttachments();
    estimate();
    ta.focus();
  }

  function togglePicker() {
    const mn = $('#pickerMenu');
    if (mn.classList.contains('open')) return mn.classList.remove('open');
    const kind = state.mode === 'images' ? 'image' : state.mode === 'video' ? 'video' : 'chat';
    const list = state.models.filter((m) => m.kind === kind);
    const groups = [...new Set(list.map((m) => m.vendor))];
    const cur = activeModel();
    mn.innerHTML = groups.map((g) => `<div class="grp">${esc(g)}</div>` + list.filter((m) => m.vendor === g).map((m) => `<button data-id="${m.id}" class="${m.id === cur.id ? 'on' : ''}">${mark(vendorMark(m.vendor)).replace('<svg', '<svg width="16" height="16"')}<span>${esc(m.name)}</span><span class="id">${m.id}</span><span class="pr">${usd(m.prices.usd)}${m.prices.unit}</span><span class="lv ${m.live ? '' : 'demo'}" title="${m.live ? 'live' : m.kind === 'video' ? 'demo' : 'free tier'}"></span></button>`).join('')).join('');
    mn.querySelectorAll('button').forEach((b) => b.onclick = (e) => { e.stopPropagation(); const m = state.models.find((x) => x.id === b.dataset.id); if (kind === 'image') state.imgModel = m; else if (kind === 'video') state.vidModel = m; else state.model = m; renderComposer(); });
    mn.classList.add('open');
  }

  let estT = null;
  function estimate() {
    clearTimeout(estT);
    estT = setTimeout(async () => {
      const m = activeModel(); const text = ($('#prompt') || {}).value || '';
      const body = m.kind === 'chat' ? { model: m.id, text: text + (state.chat ? state.chat.messages.map((x) => x.content).join(' ') : '') } : { model: m.id, usage: m.kind === 'image' ? { images: 1 } : { seconds: state.seconds } };
      try { const { quote, tier } = await api('/api/quote', { method: 'POST', body }); const e = $('#est'); if (e) e.textContent = tier === 'live' ? `~${quote.credits < 10 ? quote.credits.toFixed(1) : Math.round(quote.credits)} cr` : tier === 'free' ? 'free' : ''; } catch { /* leave it */ }
    }, 250);
  }

  function renderAttachments() {
    const l = $('#attachList'); if (!l) return;
    l.innerHTML = state.attachments.map((f) => `<span class="chip">${esc(f.name)}<button data-id="${f.id}">✕</button></span>`).join('');
    l.querySelectorAll('button').forEach((b) => b.onclick = () => { state.attachments = state.attachments.filter((f) => f.id !== b.dataset.id); renderAttachments(); });
  }

  async function uploadFiles(files) {
    for (const f of files) {
      if (f.size > 15 * 1024 * 1024) { toast(`${f.name} is over 15 MB`, true); continue; }
      const data = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.readAsDataURL(f); });
      try { const { file } = await api('/api/files', { method: 'POST', body: { name: f.name, mime: f.type || 'application/octet-stream', data } }); state.attachments.push(file); toast(`Attached ${f.name}`); } catch (e) { toast(e.message, true); }
    }
    renderAttachments();
    if (currentView() === 'files') renderFiles();
  }

  /* ---------- sending ---------- */
  async function send() {
    if (state.streaming) return;
    if (!state.me) return openSignIn();
    const ta = $('#prompt'); const text = ta.value.trim();
    if (!text) return;
    if (state.mode === 'images') return generate('image', text);
    if (state.mode === 'video') { if (!activeModel().live) return toast('Video is not switched on yet: it needs a video provider connected on the server. Coming soon.', true); return generate('video', text); }
    ta.value = ''; ta.style.height = 'auto';
    if (!state.chat) state.chat = { id: null, title: text.slice(0, 60), messages: [], mode: state.mode, model: state.model.id, skill: state.mode === 'ask' ? state.skill : null };
    state.chat.messages.push({ role: 'user', content: text, at: new Date().toISOString() });
    const wasHome = !$('#thread').children.length;
    if (wasHome) renderHome();
    else renderThread();
    const aiMsg = { role: 'assistant', content: '', model: state.model.id, at: new Date().toISOString(), streaming: true };
    state.chat.messages.push(aiMsg);
    renderThread();
    state.streaming = true; $('#sendBtn').disabled = true;
    const attachments = state.attachments.map((f) => f.id); state.attachments = []; renderAttachments();
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + getKey() }, body: JSON.stringify({ chatId: state.chat.id, model: state.model.id, mode: state.mode, message: text, attachments, web: state.web, skill: state.mode === 'ask' ? state.skill : null }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw Object.assign(new Error(j.error || 'Request failed'), { code: j.code }); }
      const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = '';
      const body = () => $('#thread .msg:last-child .body');
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
          const ev = /^event: (.*)$/m.exec(chunk)?.[1]; const data = /^data: (.*)$/m.exec(chunk)?.[1];
          if (!ev || !data) continue;
          const d = JSON.parse(data);
          if (ev === 'meta') { state.chat.id = d.chatId; aiMsg.live = d.live; aiMsg.tier = d.tier; }
          if (ev === 'delta') { aiMsg.content += d.text; const b = body(); if (b) { b.textContent = aiMsg.content; b.classList.add('cursor'); b.parentElement.scrollIntoView({ block: 'end' }); } }
          if (ev === 'done') { aiMsg.tier = d.tier; aiMsg.servedBy = d.servedBy; aiMsg.live = d.live; aiMsg.credits = d.credits; aiMsg.usage = d.usage; aiMsg.saved = d.saved; state.me.balance = d.balance; state.chat.title = d.title || state.chat.title; }
          if (ev === 'error') throw new Error(d.message);
        }
      }
    } catch (e) {
      aiMsg.content = aiMsg.content || `⚠ ${e.message}`;
      if (e.code === 'insufficient') { toast('Not enough credits. Top up to keep asking.', true); setTimeout(() => { location.hash = '#account'; }, 900); } else toast(e.message, true);
    } finally {
      aiMsg.streaming = false; state.streaming = false;
      renderThread(); renderSignbox(); loadChats();
      const sb = $('#sendBtn'); if (sb) sb.disabled = false;
      if (state.chat.id) history.replaceState(null, '', '#chat/' + state.chat.id);
      const ta2 = $('#prompt'); if (ta2) ta2.focus();
    }
  }

  function renderThread() {
    const t = $('#thread'); if (!t) return;
    const msgs = (state.chat && state.chat.messages) || [];
    t.innerHTML = msgs.map((m, i) => m.role === 'user'
      ? `<div class="msg user"><span class="who">you</span><div class="body">${esc(m.content)}</div></div>`
      : `<div class="msg ai"><span class="who">${esc(m.model || 'wondr')}</span><div class="body ${m.streaming ? 'cursor' : ''}">${m.streaming ? esc(m.content) : md(m.content)}</div>${m.streaming ? '' : `<div class="meta"><span>${m.credits !== undefined ? costTag(m) : ''}</span>${m.usage ? `<span>${m.usage.inTokens}→${m.usage.outTokens} tok</span>` : ''}${m.saved ? `<span class="accent">saved ${cr(m.saved)} cr as a holder</span>` : ''}${tierTag(m)}<button class="copy" data-say="${i}">${ICONS.speaker.replace('<svg', '<svg width="12" height="12" style="display:inline;vertical-align:-2px"')} listen</button><button class="copy" data-copytext="${i}">copy</button></div>`}</div>`).join('');
    t.querySelectorAll('[data-copytext]').forEach((b) => b.onclick = () => { navigator.clipboard.writeText(msgs[b.dataset.copytext].content); toast('Copied'); });
    t.querySelectorAll('[data-copy]').forEach((b) => b.onclick = () => { const pre = b.closest('.preview').previousElementSibling; navigator.clipboard.writeText(pre.textContent); toast('Code copied'); });
    t.querySelectorAll('[data-say]').forEach((b) => b.onclick = () => speak(msgs[b.dataset.say].content));
    if (msgs.length) t.lastElementChild.scrollIntoView({ block: 'end' });
  }

  async function speak(text) {
    if (!state.me) return openSignIn();
    if (!state.ttsModel) return toast('No speech model available', true);
    toast('Generating speech…');
    try {
      const r = await api('/api/tts', { method: 'POST', body: { model: state.ttsModel.id, text: text.replace(/```[\s\S]*?```/g, ' (code) ').slice(0, 3000) } });
      new Audio(r.item.url).play(); state.me.balance = r.balance; renderSignbox(); loadLibrary();
      toast(`Spoken${r.tier === 'free' ? ' by a free voice' : r.tier === 'demo' ? ' (demo)' : ' by ' + state.ttsModel.name} · ${costTag(r)}`);
    } catch (e) { toast(e.message, true); }
  }

  async function generate(kind, prompt) {
    const m = activeModel();
    const ta = $('#prompt'); ta.value = ''; ta.style.height = 'auto';
    const t = $('#thread');
    t.insertAdjacentHTML('beforeend', `<div class="msg user"><span class="who">you</span><div class="body">${esc(prompt)}</div></div><div class="msg ai" id="genMsg"><span class="who">${esc(m.id)}</span><div class="body cursor">Rendering with ${esc(m.name)}…</div></div>`);
    t.lastElementChild.scrollIntoView({ block: 'end' });
    state.streaming = true; $('#sendBtn').disabled = true;
    try {
      const r = await api('/api/' + kind, { method: 'POST', body: { model: m.id, prompt, size: state.size, seconds: state.seconds } });
      const it = r.item;
      $('#genMsg .body').classList.remove('cursor');
      $('#genMsg .body').innerHTML = `${media(it)}<div class="meta"><span>${costTag(r)}</span>${tierTag(r)}<a class="copy" href="${it.url}" download>download</a><a class="copy" href="#library">library</a></div>`;
      state.me.balance = r.balance; renderSignbox(); loadLibrary();
    } catch (e) {
      $('#genMsg .body').classList.remove('cursor'); $('#genMsg .body').textContent = `⚠ ${e.message}`;
      if (e.code === 'insufficient') setTimeout(() => { location.hash = '#account'; }, 900);
    } finally { state.streaming = false; $('#sendBtn').disabled = false; }
  }

  const tierTag = (x) => x.tier === 'free' ? `<span class="demo">free${x.servedBy ? ' · ' + esc(x.servedBy.replace(' (free)', '')) : ''}</span>` : (x.tier === 'demo' || x.live === false) ? '<span class="demo">demo</span>' : '';
  const costTag = (x) => (x.credits ? `−${cr(x.credits)} cr` : x.tier === 'live' || x.live ? '' : 'no charge');
  const media = (it) => it.kind === 'image' || (it.mime && it.mime.startsWith('image/')) ? `<img src="${it.url}" alt="${esc(it.prompt)}" style="border-radius:10px;max-height:420px">` : it.kind === 'video' ? (it.mime === 'image/svg+xml' ? `<img src="${it.url}" alt="" style="border-radius:10px">` : `<video src="${it.url}" controls playsinline style="border-radius:10px"></video>`) : `<audio src="${it.url}" controls></audio>`;

  function renderLibBlock() {
    const b = $('#libBlock'); if (!b) return;
    const items = state.library.slice(0, 3);
    b.innerHTML = `<div class="block-h"><span>Library</span><a href="#library">View all</a></div><div class="thumbs">${[0, 1, 2].map((i) => items[i] ? `<a class="thumb" href="#library" title="${esc(items[i].prompt)}">${items[i].kind === 'audio' ? '♪ audio' : media(items[i])}</a>` : '<div class="thumb"></div>').join('')}</div><div class="foot-note">${state.me ? (items.length ? 'Everything you make lands here.' : 'Images, clips and audio you make land here.') : 'Sign in to keep what you make.'}</div>`;
  }

  /* ---------- voice input ---------- */
  let rec = null;
  /* without a transcription key, dictate with the browser's own speech recognition: free and real */
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  let dict = null;
  function dictate() {
    const btn = $('#micBtn');
    if (dict) { dict.stop(); return; }
    const t0 = $('#prompt');
    const base = t0 && t0.value ? t0.value.replace(/\s*$/, ' ') : '';
    let said = '';
    dict = new SpeechRec();
    dict.lang = navigator.language || 'en-US'; dict.interimResults = true; dict.continuous = true;
    dict.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) said += r[0].transcript; else interim += r[0].transcript; }
      const ta = $('#prompt'); if (ta) { ta.value = base + said + interim; ta.dispatchEvent(new Event('input')); }
    };
    dict.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast('Allow the microphone in your browser to dictate.', true);
      else if (e.error !== 'no-speech' && e.error !== 'aborted') toast('Dictation stopped (' + e.error + ').', true);
    };
    dict.onend = () => { const b = $('#micBtn'); if (b) b.classList.remove('rec'); dict = null; };
    try { dict.start(); } catch { dict = null; return toast('Microphone not available', true); }
    if (btn) btn.classList.add('rec');
    toast('Listening… speak, then click the mic to stop.');
  }

  async function record() {
    const sttLive = (state.models || []).some((m) => m.kind === 'stt' && m.live);
    if (!sttLive) return SpeechRec ? dictate() : toast('Voice input works in Chrome, Edge and Safari.', true);
    if (!state.me) return openSignIn();
    const btn = $('#micBtn');
    if (rec) { rec.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = []; const started = Date.now();
      rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        btn.classList.remove('rec'); const r0 = rec; rec = null;
        const blob = new Blob(chunks, { type: r0.mimeType || 'audio/webm' });
        const data = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result.split(',')[1]); fr.readAsDataURL(blob); });
        toast('Transcribing…');
        try { const r = await api('/api/stt', { method: 'POST', body: { audio: data, mime: blob.type.split(';')[0], seconds: (Date.now() - started) / 1000 } }); const ta = $('#prompt'); ta.value = (ta.value ? ta.value + ' ' : '') + r.text; ta.dispatchEvent(new Event('input')); state.me.balance = r.balance; renderSignbox(); } catch (e) { toast(e.message, true); }
      };
      rec.start(); btn.classList.add('rec'); toast('Listening… click the mic again to stop.');
    } catch { toast('Microphone not available', true); }
  }

  /* ---------- sign in ---------- */
  /* ---------- the sign-in panel: username, wallet, email code ---------- */
  function authPanel(host, done) {
    const cfg = state.cfg || {};
    const emailOn = cfg.auth && cfg.auth.email;
    host.innerHTML = `<div class="auth">
      <h2 class="auth-h">Log in or create<br>an account</h2>
      <p class="auth-sub">No email needed. Nothing is shared with anyone.</p>
      <div class="seg" role="tablist"><button data-tab="user" class="on" role="tab">Username</button><button data-tab="wallet" role="tab">Wallet</button><button data-tab="email" role="tab">Email code</button></div>
      <div class="auth-body" id="authBody"></div>
      <div class="auth-foot"><hr><p>Made your account with a username or a wallet? You can add an email later from your account page, for recovery and receipts. Never required.</p>
      <p>Cannot get in? <a href="#support" data-support="I can't sign in to my account">Ask support</a> and get an answer right away.</p>
      <p class="auth-key"><a href="#" id="useKey">I have an access key</a></p></div>
    </div>`;
    const body = host.querySelector('#authBody');
    const finish = (r, msg) => { setKey(r.key); state.me = r.account; toast(msg || (r.created ? 'Account created. Welcome to wondr.' : 'Welcome back.')); done(); };
    const busy = (btn, on) => { btn.disabled = on; btn.classList.toggle('loading', on); };
    const fail = (e, el) => { el.textContent = e.message; el.hidden = false; };

    const tabs = {
      user() {
        body.innerHTML = `<p class="auth-desc">A username and a password, nothing else. The only door where you make an account first.</p>
          <label class="auth-l">Username<input class="input" id="auUser" autocomplete="username" placeholder="3 to 32 letters, numbers, underscores" maxlength="32"></label>
          <label class="auth-l">Password<span class="pw"><input class="input" id="auPw" type="password" autocomplete="current-password" placeholder="At least 8 characters"><button type="button" class="pw-eye" id="auEye" aria-label="Show password">show</button></span></label>
          <p class="auth-err" id="auErr" hidden></p>
          <div class="auth-row"><button class="btn btn-primary" id="auLogin">Log in</button><button class="btn btn-ghost" id="auCreate">Create account</button></div>
          <p class="auth-desc">New here? Create account makes one with exactly what you typed. Write the password down: with no email on the account there is no reset until you add one.</p>`;
        const u = body.querySelector('#auUser'), pw = body.querySelector('#auPw'), er = body.querySelector('#auErr');
        body.querySelector('#auEye').onclick = (e) => { pw.type = pw.type === 'password' ? 'text' : 'password'; e.target.textContent = pw.type === 'password' ? 'show' : 'hide'; };
        const go = async (path, btn) => {
          er.hidden = true; busy(btn, true);
          try { finish(await api(path, { method: 'POST', body: { username: u.value, password: pw.value } })); } catch (e) { fail(e, er); } finally { busy(btn, false); }
        };
        body.querySelector('#auLogin').onclick = (e) => go('/api/auth/password', e.currentTarget);
        body.querySelector('#auCreate').onclick = (e) => go('/api/auth/register', e.currentTarget);
        pw.onkeydown = (e) => { if (e.key === 'Enter') body.querySelector('#auLogin').click(); };
        u.focus();
      },
      wallet() {
        const has = typeof window.ethereum !== 'undefined';
        body.innerHTML = `<p class="auth-desc">Sign a message with the wallet you already use. No transaction, no gas. Your first signature creates the account.</p>
          <p class="auth-err" id="auErr" hidden></p>
          <div class="auth-row"><button class="btn btn-primary" id="auWallet" ${has ? '' : 'disabled'}>${ICONS.wallet.replace('<svg', '<svg width="16" height="16"')} Connect wallet</button></div>
          <p class="auth-desc">${has ? 'Works with MetaMask, Rabby, Coinbase Wallet and any browser wallet.' : 'No wallet found in this browser. Install MetaMask or Rabby, or use a username.'}</p>`;
        const er = body.querySelector('#auErr');
        if (has) body.querySelector('#auWallet').onclick = async (e) => {
          const btn = e.currentTarget; er.hidden = true; busy(btn, true);
          try {
            const [address] = await window.ethereum.request({ method: 'eth_requestAccounts' });
            const { message } = await api('/api/auth/nonce?address=' + address);
            const signature = await window.ethereum.request({ method: 'personal_sign', params: [message, address] });
            finish(await api('/api/auth/wallet', { method: 'POST', body: { address, signature } }), null);
          } catch (err) { fail({ message: err.message || 'Signature cancelled' }, er); } finally { busy(btn, false); }
        };
      },
      email() {
        body.innerHTML = `<p class="auth-desc">We send a six-digit code to your email. Type it here and you are in. First use creates the account.</p>
          <label class="auth-l">Email<input class="input" id="auEmail" type="email" autocomplete="email" placeholder="you@example.com" ${emailOn ? '' : 'disabled'}></label>
          <div id="auCodeWrap" hidden><label class="auth-l">Code<input class="input code-in" id="auCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6 digits"></label></div>
          <p class="auth-err" id="auErr" hidden></p>
          <div class="auth-row"><button class="btn btn-primary" id="auSend" ${emailOn ? '' : 'disabled'}>Send code</button><button class="btn btn-ghost" id="auResend" hidden>Send again</button></div>
          <p class="auth-desc">${emailOn ? 'The code works once and expires in 10 minutes.' : 'Email codes are not switched on for this site yet. Use a username or a wallet for now.'}</p>`;
        if (!emailOn) return;
        const em = body.querySelector('#auEmail'), code = body.querySelector('#auCode'), er = body.querySelector('#auErr');
        const send = body.querySelector('#auSend'), again = body.querySelector('#auResend');
        let sent = false;
        const ask = async (btn) => {
          er.hidden = true; busy(btn, true);
          try { await api('/api/auth/email/start', { method: 'POST', body: { email: em.value } }); sent = true; body.querySelector('#auCodeWrap').hidden = false; send.textContent = 'Log in'; again.hidden = false; code.focus(); toast('Code sent. Check your inbox.'); } catch (e) { fail(e, er); } finally { busy(btn, false); }
        };
        send.onclick = async (e) => {
          if (!sent) return ask(e.currentTarget);
          er.hidden = true; busy(send, true);
          try { finish(await api('/api/auth/email/verify', { method: 'POST', body: { email: em.value, code: code.value } })); } catch (err) { fail(err, er); } finally { busy(send, false); }
        };
        again.onclick = (e) => ask(e.currentTarget);
        em.onkeydown = (e) => { if (e.key === 'Enter') send.click(); };
        code.onkeydown = (e) => { if (e.key === 'Enter') send.click(); };
        em.focus();
      }
    };
    host.querySelectorAll('.seg button').forEach((b) => b.onclick = () => { host.querySelectorAll('.seg button').forEach((x) => x.classList.toggle('on', x === b)); tabs[b.dataset.tab](); });
    host.querySelector('#useKey').onclick = (e) => {
      e.preventDefault();
      host.querySelectorAll('.seg button').forEach((x) => x.classList.remove('on'));
      body.innerHTML = `<p class="auth-desc">Paste the access key you saved (it starts with seek_).</p><label class="auth-l">Access key<input class="input" id="auKey" autocomplete="off" placeholder="seek_…"></label><p class="auth-err" id="auErr" hidden></p><div class="auth-row"><button class="btn btn-primary" id="auKeyGo">Log in</button></div>`;
      const k = body.querySelector('#auKey'), er = body.querySelector('#auErr');
      body.querySelector('#auKeyGo').onclick = async () => { er.hidden = true; try { const { account } = await api('/api/auth/login', { method: 'POST', body: { key: k.value.trim() } }); finish({ key: k.value.trim(), account }, 'Welcome back.'); } catch (err) { fail(err, er); } };
      k.onkeydown = (ev) => { if (ev.key === 'Enter') body.querySelector('#auKeyGo').click(); };
      k.focus();
    };
    tabs.user();
  }

  function openSignIn() {
    const bg = $('#signModal'); const m = $('#signModalBody');
    m.className = 'modal auth-modal';
    m.innerHTML = '<button class="icon-btn x" id="closeModal" aria-label="Close">✕</button><div id="authHost"></div>';
    bg.classList.add('open');
    const close = () => { bg.classList.remove('open'); m.innerHTML = ''; };
    $('#closeModal').onclick = close;
    bg.onclick = (e) => { if (e.target === bg) close(); };
    authPanel($('#authHost'), () => { close(); afterSignIn(); });
  }

  async function walletSignIn(linkOnly) {
    if (typeof window.ethereum === 'undefined') return toast('Install an EVM wallet (MetaMask, Rabby…) to sign in this way.', true);
    try {
      const [address] = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const { message } = await api('/api/auth/nonce?address=' + address);
      const signature = await window.ethereum.request({ method: 'personal_sign', params: [message, address] });
      if (linkOnly === true) { const { account } = await api('/api/me/wallet', { method: 'POST', body: { address, signature } }); state.me = account; toast('Wallet linked'); renderSignbox(); renderAccount(); return; }
      const r = await api('/api/auth/wallet', { method: 'POST', body: { address, signature } });
      setKey(r.key); state.me = r.account; $('#signModal').classList.remove('open');
      toast(r.created ? 'Welcome. Your wallet is your account now.' : 'Welcome back.');
      afterSignIn();
    } catch (e) { toast(e.message || 'Wallet sign-in cancelled', true); }
  }

  function afterSignIn() { renderSignbox(); loadChats(); loadLibrary(); route(); }
  function signOut() { setKey(''); state.me = null; state.chat = null; state.chats = []; state.library = []; renderSignbox(); renderRecent(); location.hash = '#home'; route(); toast('Signed out. Keep your key to come back.'); }

  /* ---------- views ---------- */
  function needSignIn() { $('#stage').innerHTML = '<div class="auth-inline" id="authInline"></div>'; authPanel($('#authInline'), afterSignIn); }

  async function renderLibrary() {
    if (!state.me) return needSignIn('Library');
    await loadLibrary();
    const s = $('#stage');
    s.innerHTML = `<div class="view"><h2>Library</h2><p class="sub">Everything you have generated: images, clips and audio.</p>${state.library.length ? `<div class="gallery">${state.library.map((it) => `<div class="gitem"><div class="media">${media(it)}</div><div class="cap"><span>${esc(it.prompt.slice(0, 120))}</span><span class="mono"><span>${it.model} · ${costTag(it)}${it.tier === 'free' ? ' · free' : it.live ? '' : ' · demo'}</span><span><a href="${it.url}" download>download</a> · <a href="#" data-del="${it.id}">delete</a></span></span></div></div>`).join('')}</div>` : '<div class="thumb" style="aspect-ratio:auto;padding:40px">Nothing yet. Switch to Images or Video on Home and make something.</div>'}</div>`;
    s.querySelectorAll('[data-del]').forEach((a) => a.onclick = async (e) => { e.preventDefault(); await api('/api/library/' + a.dataset.del, { method: 'DELETE' }); renderLibrary(); });
  }

  async function renderFiles() {
    if (!state.me) return needSignIn('Files');
    const { files } = await api('/api/files');
    const s = $('#stage');
    s.innerHTML = `<div class="view"><h2>Files</h2><p class="sub">Uploads you can attach to a chat. Text files are read in full; others are referenced by name.</p><button class="btn btn-primary btn-sm" id="up">Upload files</button><div class="list" style="margin-top:18px">${files.map((f) => `<div class="li"><div>${esc(f.name)}<div class="mono">${f.mime} · ${(f.bytes / 1024).toFixed(0)} KB · ${new Date(f.created).toLocaleString()}</div></div><div class="r"><a class="accent" href="${f.url}" target="_blank">open</a> · <a href="#" data-attach="${f.id}">attach</a> · <a href="#" data-del="${f.id}">delete</a></div></div>`).join('') || '<div class="li"><span class="note">No files yet.</span></div>'}</div></div>`;
    $('#up').onclick = () => $('#fileInput').click();
    s.querySelectorAll('[data-del]').forEach((a) => a.onclick = async (e) => { e.preventDefault(); await api('/api/files/' + a.dataset.del, { method: 'DELETE' }); renderFiles(); });
    s.querySelectorAll('[data-attach]').forEach((a) => a.onclick = (e) => { e.preventDefault(); const f = files.find((x) => x.id === a.dataset.attach); if (!state.attachments.find((x) => x.id === f.id)) state.attachments.push(f); state.mode = 'ask'; location.hash = '#home'; toast(`${f.name} will ride your next message`); });
  }

  async function renderHistory() {
    if (!state.me) return needSignIn('History');
    await loadChats();
    const s = $('#stage');
    s.innerHTML = `<div class="view"><h2>History</h2><p class="sub">Every chat, newest first.</p><div class="list">${state.chats.map((c) => `<div class="li"><div><a href="#chat/${c.id}"><b>${esc(c.title)}</b></a><div class="mono">${c.model} · ${c.mode} · ${c.count} messages · ${new Date(c.updated || c.created).toLocaleString()}</div></div><div class="r"><a href="#" data-rename="${c.id}">rename</a> · <a href="#" data-share="${c.id}">share</a> · <a href="#" data-del="${c.id}">delete</a></div></div>`).join('') || '<div class="li"><span class="note">No chats yet.</span></div>'}</div></div>`;
    s.querySelectorAll('[data-del]').forEach((a) => a.onclick = async (e) => { e.preventDefault(); await api('/api/chats/' + a.dataset.del, { method: 'DELETE' }); if (state.chat && state.chat.id === a.dataset.del) state.chat = null; renderHistory(); });
    s.querySelectorAll('[data-rename]').forEach((a) => a.onclick = async (e) => { e.preventDefault(); const t = prompt('New title'); if (t) { await api('/api/chats/' + a.dataset.rename + '/rename', { method: 'POST', body: { title: t } }); renderHistory(); } });
    s.querySelectorAll('[data-share]').forEach((a) => a.onclick = (e) => { e.preventDefault(); shareChat(a.dataset.share); });
  }

  async function shareChat(id) {
    try { const { url } = await api('/api/chats/' + id + '/share', { method: 'POST' }); await navigator.clipboard.writeText(url).catch(() => null); toast('Share link copied: ' + url); loadChats(); } catch (e) { toast(e.message, true); }
  }

  async function renderCollab() {
    if (!state.me) return needSignIn('Collab');
    await loadChats();
    const s = $('#stage');
    const shared = state.chats.filter((c) => c.share);
    s.innerHTML = `<div class="view"><h2>Collab</h2><p class="sub">Share a chat as a read-only link anyone can open, or open one that was shared with you.</p>
      <div class="panel"><h3>Open a shared link</h3><div class="inline"><input class="input" id="shareIn" placeholder="https://…/ask#share/s_…"><button class="btn btn-primary" id="shareGo">Open</button></div></div>
      <div class="panel"><h3>Your shared chats</h3><p class="sub">Stop sharing and the link dies.</p><div class="list">${shared.map((c) => `<div class="li"><div><a href="#chat/${c.id}"><b>${esc(c.title)}</b></a><div class="mono">${location.origin}/ask#share/${c.share}</div></div><div class="r"><a href="#" data-copy="${c.share}">copy</a> · <a href="#" data-unshare="${c.id}">stop</a></div></div>`).join('') || '<div class="li"><span class="note">Nothing shared yet. Share from a chat or from History.</span></div>'}</div></div>
      <div class="panel"><h3>Share a chat</h3><div class="list">${state.chats.filter((c) => !c.share).slice(0, 12).map((c) => `<div class="li"><div><b>${esc(c.title)}</b></div><div class="r"><a href="#" data-share="${c.id}">share</a></div></div>`).join('') || '<div class="li"><span class="note">Every chat is already shared, or there are none.</span></div>'}</div></div></div>`;
    $('#shareGo').onclick = () => { const m = /share\/(s_\w+)/.exec($('#shareIn').value); if (m) location.hash = '#share/' + m[1]; else toast('That does not look like a share link', true); };
    s.querySelectorAll('[data-copy]').forEach((a) => a.onclick = (e) => { e.preventDefault(); navigator.clipboard.writeText(`${location.origin}/ask#share/${a.dataset.copy}`); toast('Copied'); });
    s.querySelectorAll('[data-unshare]').forEach((a) => a.onclick = async (e) => { e.preventDefault(); await api('/api/chats/' + a.dataset.unshare + '/share', { method: 'DELETE' }); renderCollab(); });
    s.querySelectorAll('[data-share]').forEach((a) => a.onclick = async (e) => { e.preventDefault(); await shareChat(a.dataset.share); renderCollab(); });
  }

  async function renderShared(token) {
    const s = $('#stage');
    try {
      const { chat } = await api('/api/shared/' + token);
      s.innerHTML = `<div class="view"><div class="shared-h"><div><h2>${esc(chat.title)}</h2><p class="sub" style="margin:0">Shared chat · ${chat.model} · ${new Date(chat.created).toLocaleDateString()}</p></div><a class="btn btn-primary btn-sm" href="#home">Start your own</a></div><div class="thread">${chat.messages.map((m) => m.role === 'user' ? `<div class="msg user"><span class="who">them</span><div class="body">${esc(m.content)}</div></div>` : `<div class="msg ai"><span class="who">${esc(m.model || 'wondr')}</span><div class="body">${md(m.content)}</div></div>`).join('')}</div></div>`;
    } catch (e) { s.innerHTML = `<div class="view"><h2>That link is gone</h2><p class="sub">${esc(e.message)}</p></div>`; }
  }

  /* ---------- account ---------- */
  async function renderAccount() {
    if (!state.me) return needSignIn('Account');
    try { state.me = (await api('/api/me')).account; } catch { /* keep what we have */ }
    const a = state.me; const cfg = state.cfg; const dep = cfg.deposits; const al = a.allowance;
    const s = $('#stage');
    s.innerHTML = `<div class="view"><h2>Account</h2><p class="sub">${a.username ? '@' + esc(a.username) : a.email ? esc(a.email) : a.wallet ? a.wallet : 'Access-key account'} · since ${new Date(a.created).toLocaleDateString()}</p>
      <div class="stat"><div><span class="k">Balance</span><div class="v">${cr(a.balance)}<small>credits · ${usd(a.balance / cfg.creditsPerUsd)}</small></div></div><div><span class="k">Deposited</span><div class="v">${cr(a.deposited)}</div></div><div><span class="k">Spent</span><div class="v">${cr(a.spent)}</div></div></div>

      <div class="panel"><h3>Top up</h3><p class="sub">$1 = ${cfg.creditsPerUsd.toLocaleString()} credits. No wondr fee on the deposit: what you send is what you get.</p>
        ${dep.eth || dep.sol || dep.btc ? `<div class="field"><label>Send to the treasury, then paste the transaction id to credit it (${dep.minConfirmations} confirmation${dep.minConfirmations === 1 ? '' : 's'}).</label>
          ${dep.eth ? `<div class="addr"><span><b>ETH / USDT (Ethereum)</b><br>${dep.treasury.eth}</span><button class="copy" data-copyaddr="${dep.treasury.eth}">copy</button></div>` : ''}
          ${dep.sol ? `<div class="addr"><span><b>SOL</b><br>${dep.treasury.sol}</span><button class="copy" data-copyaddr="${dep.treasury.sol}">copy</button></div>` : ''}
          ${dep.btc ? `<div class="addr"><span><b>BTC</b><br>${dep.treasury.btc}</span><button class="copy" data-copyaddr="${dep.treasury.btc}">copy</button></div>` : ''}
          <div class="inline" style="margin-top:8px"><select class="input" id="depChain" style="max-width:160px">${dep.eth ? '<option value="ethereum">Ethereum</option>' : ''}${dep.sol ? '<option value="solana">Solana</option>' : ''}${dep.btc ? '<option value="bitcoin">Bitcoin</option>' : ''}</select><input class="input" id="depRef" placeholder="Transaction id / signature"><button class="btn btn-primary" id="depGo">Credit</button></div></div>` : `<p class="note">Crypto deposit addresses are not configured on this server yet.</p>`}
        ${cfg.demo ? `<div class="inline" style="margin-top:10px"><input class="input" id="demoUsd" type="number" min="1" max="100" value="10" style="max-width:120px"><button class="btn btn-ghost" id="demoGo">Simulate a $ deposit (demo)</button></div>` : ''}
      </div>

      <div class="panel"><h3>$WONDR holder tier</h3><p class="sub">Every model at 5% of its price on a daily allowance: 1,000 credits per 0.01% of supply held, up to 25,000. Resets 00:00 UTC.</p>
        <div class="row" style="display:flex;justify-content:space-between;font-size:14px"><span>Holding</span><b class="mono">${a.holdingsPct.toFixed(4)}%${a.holdingsSimulated ? ' (simulated)' : ''}</b></div>
        <div class="tierbar"><i style="width:${al.total ? Math.min(100, (al.used / al.total) * 100) : 0}%"></i></div>
        <div class="row" style="display:flex;justify-content:space-between;font-size:13px" class="note"><span>Allowance today</span><b class="mono">${cr(al.used)} / ${cr(al.total)} credits</b></div>
        <p class="note" style="margin:10px 0">${a.tier.discount ? '<span class="ok">✓</span> 5% pricing active' : '· 5% pricing needs ≥ 0.01%'} &nbsp; ${a.tier.earlyAccess ? '<span class="ok">✓</span> early access' : '· early access from 0.5%'} &nbsp; ${a.tier.priority ? '<span class="ok">✓</span> priority routing' : '· priority routing from 1%'}</p>
        <div class="cta-row">${a.wallet ? `<button class="btn btn-ghost btn-sm" id="refreshHold">${cfg.holdings ? 'Refresh holdings' : 'Holdings check not configured'}</button>` : `<button class="btn btn-ghost btn-sm" id="linkWallet">Link a wallet</button>`}${cfg.demo ? `<span class="inline"><input class="input" id="simPct" type="number" step="0.01" min="0" max="100" value="${a.holdingsPct}" style="width:110px;height:36px"><button class="btn btn-ghost btn-sm" id="simGo">Simulate %</button></span>` : ''}</div>
      </div>

      <div class="panel"><h3>Sign-in</h3><p class="sub">The ways into this account. Add more so you never get locked out.</p>
        <div class="field"><label>Username</label>${a.username
          ? `<div class="addr"><span>@${esc(a.username)}</span><span class="ok">set</span></div>
             <div class="inline" style="margin-top:8px"><input class="input" id="pwCur" type="password" placeholder="Current password" autocomplete="current-password"><input class="input" id="pwNew" type="password" placeholder="New password" autocomplete="new-password"><button class="btn btn-ghost btn-sm" id="pwGo">Change</button></div>`
          : `<div class="inline"><input class="input" id="unNew" placeholder="Pick a username" maxlength="32" autocomplete="username"><input class="input" id="unPw" type="password" placeholder="Password, 8+ characters" autocomplete="new-password"><button class="btn btn-ghost btn-sm" id="unGo">Set</button></div>`}</div>
        <div class="field"><label>Email ${a.email ? '' : '<span class="note">(optional, for recovery and receipts)</span>'}</label>${a.email
          ? `<div class="addr"><span>${esc(a.email)}</span><span class="ok">verified</span></div>`
          : cfg.auth && cfg.auth.email
            ? `<div class="inline"><input class="input" id="emNew" type="email" placeholder="you@example.com" autocomplete="email"><button class="btn btn-ghost btn-sm" id="emSend">Send code</button></div>
               <div class="inline" id="emCodeRow" style="margin-top:8px" hidden><input class="input" id="emCode" inputmode="numeric" maxlength="6" placeholder="6-digit code"><button class="btn btn-primary btn-sm" id="emVerify">Verify</button></div>`
            : '<p class="note">Email codes are not switched on for this site yet.</p>'}</div>
        <div class="field"><label>Wallet</label>${a.wallet ? `<div class="addr"><span>${a.wallet}</span><span class="ok">linked</span></div>` : '<p class="note">No wallet linked. Link one in the holder tier panel above.</p>'}</div>
      </div>

      <div class="panel"><h3>Access</h3><p class="sub">Your key is your account. Copy it to sign in on another device.</p><div class="cta-row"><button class="btn btn-ghost btn-sm" id="copyKey">Copy access key</button><button class="btn btn-ghost btn-sm" id="themeT">Theme: ${theme.get()}</button><button class="btn btn-ghost btn-sm" id="signOut">Sign out</button></div></div>

      <div class="panel"><h3>History</h3><div class="list" id="histList"><div class="li"><span class="note">Loading…</span></div></div></div></div>`;

    s.querySelectorAll('[data-copyaddr]').forEach((b) => b.onclick = () => { navigator.clipboard.writeText(b.dataset.copyaddr); toast('Address copied'); });
    if ($('#depGo')) $('#depGo').onclick = async () => { try { const r = await api('/api/deposit/verify', { method: 'POST', body: { chain: $('#depChain').value, ref: $('#depRef').value } }); toast(`Credited ${cr(r.deposit.credits)} credits (${r.deposit.amount} ${r.deposit.asset})`); state.me = r.account; renderSignbox(); renderAccount(); } catch (e) { toast(e.message, true); } };
    if ($('#demoGo')) $('#demoGo').onclick = async () => { try { const r = await api('/api/deposit/demo', { method: 'POST', body: { usd: Number($('#demoUsd').value) } }); toast(`Credited ${cr(r.deposit.credits)} credits (demo)`); state.me = r.account; renderSignbox(); renderAccount(); } catch (e) { toast(e.message, true); } };
    if ($('#refreshHold')) $('#refreshHold').onclick = async () => { try { const r = await api('/api/me/holdings', { method: 'POST', body: {} }); state.me = r.account; renderSignbox(); renderAccount(); toast('Holdings refreshed'); } catch (e) { toast(e.message, true); } };
    if ($('#linkWallet')) $('#linkWallet').onclick = () => walletSignIn(true);
    if ($('#simGo')) $('#simGo').onclick = async () => { try { const r = await api('/api/me/holdings', { method: 'POST', body: { simulatePct: Number($('#simPct').value) } }); state.me = r.account; renderSignbox(); renderAccount(); } catch (e) { toast(e.message, true); } };
    const reload = (r, msg) => { if (r && r.account) state.me = r.account; toast(msg); renderSignbox(); renderAccount(); };
    if ($('#pwGo')) $('#pwGo').onclick = async () => { try { await api('/api/me/password', { method: 'POST', body: { current: $('#pwCur').value, next: $('#pwNew').value } }); toast('Password changed'); $('#pwCur').value = ''; $('#pwNew').value = ''; } catch (e) { toast(e.message, true); } };
    if ($('#unGo')) $('#unGo').onclick = async () => { try { reload(await api('/api/me/username', { method: 'POST', body: { username: $('#unNew').value, password: $('#unPw').value } }), 'Username set. You can log in with it now.'); } catch (e) { toast(e.message, true); } };
    if ($('#emSend')) $('#emSend').onclick = async () => { try { await api('/api/me/email/start', { method: 'POST', body: { email: $('#emNew').value } }); $('#emCodeRow').hidden = false; $('#emCode').focus(); toast('Code sent. Check your inbox.'); } catch (e) { toast(e.message, true); } };
    if ($('#emVerify')) $('#emVerify').onclick = async () => { try { reload(await api('/api/me/email/verify', { method: 'POST', body: { email: $('#emNew').value, code: $('#emCode').value } }), 'Email added'); } catch (e) { toast(e.message, true); } };
    $('#copyKey').onclick = () => { navigator.clipboard.writeText(getKey()); toast('Access key copied. Keep it safe.'); };
    $('#themeT').onclick = () => { theme.toggle(); $('#themeT').textContent = 'Theme: ' + theme.get(); };
    $('#signOut').onclick = signOut;
    try {
      const { usage, deposits } = await api('/api/me/history');
      const rows = [...deposits.map((d) => ({ at: d.at, l: `Deposit · ${d.method}${d.asset ? ` · ${d.amount} ${d.asset}` : ''}`, r: `<span class="u">+${cr(d.credits)}</span>` })), ...usage.map((u) => ({ at: u.at, l: `${u.model} · ${u.kind}${u.tier === 'free' ? ' · free' : u.live === false ? ' · demo' : ''}${u.saved ? ` · saved ${cr(u.saved)}` : ''}`, r: u.credits ? `<span class="d">−${cr(u.credits)}</span>` : '<span>0</span>' }))].sort((x, y) => y.at.localeCompare(x.at)).slice(0, 60);
      $('#histList').innerHTML = rows.map((r) => `<div class="li"><div>${r.l}<div class="mono">${new Date(r.at).toLocaleString()}</div></div><div class="r">${r.r}</div></div>`).join('') || '<div class="li"><span class="note">Nothing yet.</span></div>';
    } catch { $('#histList').innerHTML = ''; }
  }

  boot().catch((e) => { console.error(e); toast('Could not load the app: ' + e.message, true); });
})();
