/* The /ask app. One file, hash-routed views, everything through /api. */
(() => {
  const { api, getKey, setKey, usd, cr, pct, esc, mark, vendorMark, theme, toast } = seekr;
  const $ = (s, r = document) => r.querySelector(s);
  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

  const state = {
    me: null, cfg: null, models: [], cats: [], model: null, imgModel: null, vidModel: null, ttsModel: null,
    mode: 'ask', chat: null, chats: [], library: [], attachments: [], web: false, streaming: false, size: '1024x1024', seconds: 5
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
    b.innerHTML = `<span class="mono">BALANCE</span><b>${cr(a.balance)} credits</b><small>${a.wallet ? a.wallet.slice(0, 6) + '…' + a.wallet.slice(-4) : 'access key'}${a.tier.holder ? ` · ${a.holdingsPct.toFixed(3)}% $SEEKR` : ''}</small>`;
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
    $('#newChat').onclick = () => { state.chat = null; state.mode = 'ask'; location.hash = '#home'; route(); };
    $('#searchBox').oninput = (e) => renderRecent(e.target.value);
    $('#themeBtn').onclick = () => theme.toggle();
    $('#sideClose').onclick = () => $('#side').classList.remove('open');
    $('#sideOpen').onclick = () => $('#side').classList.add('open');
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
    if (v === 'chat' && arg) { if (!state.me) return openSignIn(); try { state.chat = (await api('/api/chats/' + arg)).chat; state.mode = state.chat.mode === 'code' ? 'code' : 'ask'; const m = state.models.find((x) => x.id === state.chat.model); if (m) state.model = m; } catch { state.chat = null; } renderRecent(); return renderHome(); }
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
      ${inChat ? `<div class="shared-h"><div><div class="stage-logo" style="font-size:22px;margin:0"><b style="font-size:26px">&gt;</b>seekr</div><div class="note mono">${esc(state.chat.title)}</div></div><div class="cta-row"><button class="btn btn-ghost btn-sm" id="shareBtn">Share</button><button class="btn btn-ghost btn-sm" id="newBtn">New chat</button></div></div>` :
        `<div class="stage-logo"><b>&gt;</b>seekr</div><h1>What are we <span class="accent" id="modeWord">experimenting?</span></h1>`}
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
    const modes = [['ask', 'Ask'], ['code', 'Code'], ['images', 'Images'], ['video', 'Video'], ['collab', 'Collab']];
    const m = $('#modes');
    m.innerHTML = modes.map(([id, label]) => `<button class="mode ${state.mode === id ? 'on' : ''}" data-mode="${id}">${ICONS[id]}${label}</button>`).join('');
    m.querySelectorAll('.mode').forEach((b) => b.onclick = () => { if (b.dataset.mode === 'collab') { location.hash = '#collab'; return; } state.mode = b.dataset.mode; renderModes(); renderComposer(); const w = $('#modeWord'); if (w) w.textContent = { ask: 'experimenting?', code: 'building?', images: 'picturing?', video: 'filming?' }[state.mode]; });
  }

  function activeModel() { return state.mode === 'images' ? state.imgModel : state.mode === 'video' ? state.vidModel : state.model; }

  function renderComposer() {
    const c = $('#composer');
    const m = activeModel();
    const hints = { ask: `${m.name} answers as it thinks. Long questions can take a moment.`, code: `${m.name} thinks before it writes. A big build brief can take several minutes.`, images: `${m.name} renders one image per request at ${state.size}.`, video: `${m.name} renders ${state.seconds}s of video. Clips take a few minutes.` };
    const ph = { ask: 'Ask anything…', code: 'Describe what to build…', images: 'Describe the image…', video: 'Describe the clip…' };
    c.innerHTML = `
      <div class="hint">${esc(hints[state.mode])}</div>
      <div class="row"><span class="plus">+</span><textarea id="prompt" rows="1" placeholder="${ph[state.mode]}"></textarea></div>
      <div class="attach-list" id="attachList"></div>
      <div class="bar">
        <span class="pill-sm mode-pill"><span class="dot"></span>${{ ask: 'Ask', code: 'Code', images: 'Image', video: 'Video' }[state.mode]}</span>
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
    mn.innerHTML = groups.map((g) => `<div class="grp">${esc(g)}</div>` + list.filter((m) => m.vendor === g).map((m) => `<button data-id="${m.id}" class="${m.id === cur.id ? 'on' : ''}">${mark(vendorMark(m.vendor)).replace('<svg', '<svg width="16" height="16"')}<span>${esc(m.name)}</span><span class="id">${m.id}</span><span class="pr">${usd(m.prices.usd)}${m.prices.unit}</span><span class="lv ${m.live ? '' : 'demo'}" title="${m.live ? 'live' : 'demo'}"></span></button>`).join('')).join('');
    mn.querySelectorAll('button').forEach((b) => b.onclick = (e) => { e.stopPropagation(); const m = state.models.find((x) => x.id === b.dataset.id); if (kind === 'image') state.imgModel = m; else if (kind === 'video') state.vidModel = m; else state.model = m; renderComposer(); });
    mn.classList.add('open');
  }

  let estT = null;
  function estimate() {
    clearTimeout(estT);
    estT = setTimeout(async () => {
      const m = activeModel(); const text = ($('#prompt') || {}).value || '';
      const body = m.kind === 'chat' ? { model: m.id, text: text + (state.chat ? state.chat.messages.map((x) => x.content).join(' ') : '') } : { model: m.id, usage: m.kind === 'image' ? { images: 1 } : { seconds: state.seconds } };
      try { const { quote } = await api('/api/quote', { method: 'POST', body }); const e = $('#est'); if (e) e.textContent = `~${quote.credits < 10 ? quote.credits.toFixed(1) : Math.round(quote.credits)} cr`; } catch { /* leave it */ }
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
    if (state.mode === 'video') return generate('video', text);
    ta.value = ''; ta.style.height = 'auto';
    if (!state.chat) state.chat = { id: null, title: text.slice(0, 60), messages: [], mode: state.mode, model: state.model.id };
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
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + getKey() }, body: JSON.stringify({ chatId: state.chat.id, model: state.model.id, mode: state.mode, message: text, attachments, web: state.web }) });
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
          if (ev === 'meta') { state.chat.id = d.chatId; aiMsg.live = d.live; }
          if (ev === 'delta') { aiMsg.content += d.text; const b = body(); if (b) { b.textContent = aiMsg.content; b.classList.add('cursor'); b.parentElement.scrollIntoView({ block: 'end' }); } }
          if (ev === 'done') { aiMsg.credits = d.credits; aiMsg.usage = d.usage; aiMsg.saved = d.saved; state.me.balance = d.balance; state.chat.title = d.title || state.chat.title; }
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
      : `<div class="msg ai"><span class="who">${esc(m.model || 'seekr')}</span><div class="body ${m.streaming ? 'cursor' : ''}">${m.streaming ? esc(m.content) : md(m.content)}</div>${m.streaming ? '' : `<div class="meta"><span>${m.credits !== undefined ? `−${cr(m.credits)} cr` : ''}</span>${m.usage ? `<span>${m.usage.inTokens}→${m.usage.outTokens} tok</span>` : ''}${m.saved ? `<span class="accent">saved ${cr(m.saved)} cr as a holder</span>` : ''}${m.live === false ? '<span class="demo">demo</span>' : ''}<button class="copy" data-say="${i}">${ICONS.speaker.replace('<svg', '<svg width="12" height="12" style="display:inline;vertical-align:-2px"')} listen</button><button class="copy" data-copytext="${i}">copy</button></div>`}</div>`).join('');
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
      toast(`Spoken by ${state.ttsModel.name}${r.live ? '' : ' (demo)'} · −${cr(r.credits)} cr`);
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
      $('#genMsg .body').innerHTML = `${media(it)}<div class="meta"><span>−${cr(r.credits)} cr</span>${r.live ? '' : '<span class="demo">demo render</span>'}<a class="copy" href="${it.url}" download>download</a><a class="copy" href="#library">library</a></div>`;
      state.me.balance = r.balance; renderSignbox(); loadLibrary();
    } catch (e) {
      $('#genMsg .body').classList.remove('cursor'); $('#genMsg .body').textContent = `⚠ ${e.message}`;
      if (e.code === 'insufficient') setTimeout(() => { location.hash = '#account'; }, 900);
    } finally { state.streaming = false; $('#sendBtn').disabled = false; }
  }

  const media = (it) => it.kind === 'image' || (it.mime && it.mime.startsWith('image/')) ? `<img src="${it.url}" alt="${esc(it.prompt)}" style="border-radius:10px;max-height:420px">` : it.kind === 'video' ? (it.mime === 'image/svg+xml' ? `<img src="${it.url}" alt="" style="border-radius:10px">` : `<video src="${it.url}" controls playsinline style="border-radius:10px"></video>`) : `<audio src="${it.url}" controls></audio>`;

  function renderLibBlock() {
    const b = $('#libBlock'); if (!b) return;
    const items = state.library.slice(0, 3);
    b.innerHTML = `<div class="block-h"><span>Library</span><a href="#library">View all</a></div><div class="thumbs">${[0, 1, 2].map((i) => items[i] ? `<a class="thumb" href="#library" title="${esc(items[i].prompt)}">${items[i].kind === 'audio' ? '♪ audio' : media(items[i])}</a>` : '<div class="thumb"></div>').join('')}</div><div class="foot-note">${state.me ? (items.length ? 'Everything you make lands here.' : 'Images, clips and audio you make land here.') : 'Sign in to keep what you make.'}</div>`;
  }

  /* ---------- voice input ---------- */
  let rec = null;
  async function record() {
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
  function openSignIn() {
    const bg = $('#signModal'); const b = $('#signModalBody');
    const hasWallet = typeof window.ethereum !== 'undefined';
    b.innerHTML = `<button class="icon-btn x" id="closeModal">✕</button><h2>Sign in to start</h2><p class="sub">No email, no password. An account is a wallet signature or an access key.</p>
      <button class="opt" id="optWallet">${ICONS.wallet}<span><b>Continue with wallet</b><small>${hasWallet ? 'Sign a message with your EVM wallet. No transaction.' : 'No wallet extension found in this browser.'}</small></span></button>
      <button class="opt" id="optNew">${ICONS.key}<span><b>Create an access key</b><small>A key is your account. Save it and you can sign in anywhere.</small></span></button>
      <button class="opt" id="optKey">${ICONS.key}<span><b>I have a key</b><small>Paste an access key from before.</small></span></button>
      <div id="signExtra"></div>`;
    bg.classList.add('open');
    $('#closeModal').onclick = () => bg.classList.remove('open');
    bg.onclick = (e) => { if (e.target === bg) bg.classList.remove('open'); };
    $('#optWallet').onclick = walletSignIn;
    $('#optNew').onclick = async () => {
      try {
        const { key, account } = await api('/api/auth/key', { method: 'POST' });
        setKey(key); state.me = account;
        $('#signExtra').innerHTML = `<p class="sub" style="margin-top:14px">This is your access key. It is shown once. Keep it somewhere safe.</p><div class="keybox">${key}</div><div class="cta-row"><button class="btn btn-primary btn-sm" id="copyKey">Copy key</button><button class="btn btn-ghost btn-sm" id="doneKey">Done</button></div>`;
        $('#copyKey').onclick = () => { navigator.clipboard.writeText(key); toast('Key copied'); };
        $('#doneKey').onclick = () => { bg.classList.remove('open'); afterSignIn(); };
      } catch (e) { toast(e.message, true); }
    };
    $('#optKey').onclick = () => {
      $('#signExtra').innerHTML = `<div class="inline" style="display:flex;gap:8px;margin-top:12px"><input class="input" id="keyIn" placeholder="seek_…" autocomplete="off"><button class="btn btn-primary" id="keyGo">Sign in</button></div>`;
      $('#keyIn').focus();
      $('#keyGo').onclick = async () => { const k = $('#keyIn').value.trim(); try { const { account } = await api('/api/auth/login', { method: 'POST', body: { key: k } }); setKey(k); state.me = account; bg.classList.remove('open'); afterSignIn(); } catch (e) { toast(e.message, true); } };
      $('#keyIn').onkeydown = (e) => { if (e.key === 'Enter') $('#keyGo').click(); };
    };
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
  function needSignIn(title) { $('#stage').innerHTML = `<div class="view"><h2>${title}</h2><p class="sub">Sign in to see this.</p><button class="btn btn-primary" id="si">Sign in</button></div>`; $('#si').onclick = openSignIn; }

  async function renderLibrary() {
    if (!state.me) return needSignIn('Library');
    await loadLibrary();
    const s = $('#stage');
    s.innerHTML = `<div class="view"><h2>Library</h2><p class="sub">Everything you have generated: images, clips and audio.</p>${state.library.length ? `<div class="gallery">${state.library.map((it) => `<div class="gitem"><div class="media">${media(it)}</div><div class="cap"><span>${esc(it.prompt.slice(0, 120))}</span><span class="mono"><span>${it.model} · −${cr(it.credits)} cr${it.live ? '' : ' · demo'}</span><span><a href="${it.url}" download>download</a> · <a href="#" data-del="${it.id}">delete</a></span></span></div></div>`).join('')}</div>` : '<div class="thumb" style="aspect-ratio:auto;padding:40px">Nothing yet. Switch to Images or Video on Home and make something.</div>'}</div>`;
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
      s.innerHTML = `<div class="view"><div class="shared-h"><div><h2>${esc(chat.title)}</h2><p class="sub" style="margin:0">Shared chat · ${chat.model} · ${new Date(chat.created).toLocaleDateString()}</p></div><a class="btn btn-primary btn-sm" href="#home">Start your own</a></div><div class="thread">${chat.messages.map((m) => m.role === 'user' ? `<div class="msg user"><span class="who">them</span><div class="body">${esc(m.content)}</div></div>` : `<div class="msg ai"><span class="who">${esc(m.model || 'seekr')}</span><div class="body">${md(m.content)}</div></div>`).join('')}</div></div>`;
    } catch (e) { s.innerHTML = `<div class="view"><h2>That link is gone</h2><p class="sub">${esc(e.message)}</p></div>`; }
  }

  /* ---------- account ---------- */
  async function renderAccount() {
    if (!state.me) return needSignIn('Account');
    try { state.me = (await api('/api/me')).account; } catch { /* keep what we have */ }
    const a = state.me; const cfg = state.cfg; const dep = cfg.deposits; const al = a.allowance;
    const s = $('#stage');
    const paid = /paid=1/.test(location.hash); if (paid) toast('Thanks. Card payments land as soon as Stripe confirms them.');
    s.innerHTML = `<div class="view"><h2>Account</h2><p class="sub">${a.wallet ? a.wallet : 'Access-key account'} · since ${new Date(a.created).toLocaleDateString()}</p>
      <div class="stat"><div><span class="k">Balance</span><div class="v">${cr(a.balance)}<small>credits · ${usd(a.balance / cfg.creditsPerUsd)}</small></div></div><div><span class="k">Deposited</span><div class="v">${cr(a.deposited)}</div></div><div><span class="k">Spent</span><div class="v">${cr(a.spent)}</div></div></div>

      <div class="panel"><h3>Top up</h3><p class="sub">$1 = ${cfg.creditsPerUsd.toLocaleString()} credits. No seekr fee on the deposit: what you send is what you get.</p>
        ${dep.eth || dep.sol || dep.btc ? `<div class="field"><label>Send to the treasury, then paste the transaction id to credit it (${dep.minConfirmations} confirmation${dep.minConfirmations === 1 ? '' : 's'}).</label>
          ${dep.eth ? `<div class="addr"><span><b>ETH / USDT (Ethereum)</b><br>${dep.treasury.eth}</span><button class="copy" data-copyaddr="${dep.treasury.eth}">copy</button></div>` : ''}
          ${dep.sol ? `<div class="addr"><span><b>SOL</b><br>${dep.treasury.sol}</span><button class="copy" data-copyaddr="${dep.treasury.sol}">copy</button></div>` : ''}
          ${dep.btc ? `<div class="addr"><span><b>BTC</b><br>${dep.treasury.btc}</span><button class="copy" data-copyaddr="${dep.treasury.btc}">copy</button></div>` : ''}
          <div class="inline" style="margin-top:8px"><select class="input" id="depChain" style="max-width:160px">${dep.eth ? '<option value="ethereum">Ethereum</option>' : ''}${dep.sol ? '<option value="solana">Solana</option>' : ''}${dep.btc ? '<option value="bitcoin">Bitcoin</option>' : ''}</select><input class="input" id="depRef" placeholder="Transaction id / signature"><button class="btn btn-primary" id="depGo">Credit</button></div></div>` : `<p class="note">Crypto deposit addresses are not configured on this server yet.</p>`}
        ${dep.card ? `<div class="inline" style="margin-top:10px"><input class="input" id="cardUsd" type="number" min="5" value="20" style="max-width:120px"><button class="btn btn-ghost" id="cardGo">Pay by card (Stripe)</button></div>` : ''}
        ${cfg.demo ? `<div class="inline" style="margin-top:10px"><input class="input" id="demoUsd" type="number" min="1" max="100" value="10" style="max-width:120px"><button class="btn btn-ghost" id="demoGo">Simulate a $ deposit (demo)</button></div>` : ''}
      </div>

      <div class="panel"><h3>$SEEKR holder tier</h3><p class="sub">Every model at 5% of its price on a daily allowance: 1,000 credits per 0.01% of supply held, up to 25,000. Resets 00:00 UTC.</p>
        <div class="row" style="display:flex;justify-content:space-between;font-size:14px"><span>Holding</span><b class="mono">${a.holdingsPct.toFixed(4)}%${a.holdingsSimulated ? ' (simulated)' : ''}</b></div>
        <div class="tierbar"><i style="width:${al.total ? Math.min(100, (al.used / al.total) * 100) : 0}%"></i></div>
        <div class="row" style="display:flex;justify-content:space-between;font-size:13px" class="note"><span>Allowance today</span><b class="mono">${cr(al.used)} / ${cr(al.total)} credits</b></div>
        <p class="note" style="margin:10px 0">${a.tier.discount ? '<span class="ok">✓</span> 5% pricing active' : '· 5% pricing needs ≥ 0.01%'} &nbsp; ${a.tier.earlyAccess ? '<span class="ok">✓</span> early access' : '· early access from 0.5%'} &nbsp; ${a.tier.priority ? '<span class="ok">✓</span> priority routing' : '· priority routing from 1%'}</p>
        <div class="cta-row">${a.wallet ? `<button class="btn btn-ghost btn-sm" id="refreshHold">${cfg.holdings ? 'Refresh holdings' : 'Holdings check not configured'}</button>` : `<button class="btn btn-ghost btn-sm" id="linkWallet">Link a wallet</button>`}${cfg.demo ? `<span class="inline"><input class="input" id="simPct" type="number" step="0.01" min="0" max="100" value="${a.holdingsPct}" style="width:110px;height:36px"><button class="btn btn-ghost btn-sm" id="simGo">Simulate %</button></span>` : ''}</div>
      </div>

      <div class="panel"><h3>Access</h3><p class="sub">Your key is your account. Copy it to sign in on another device.</p><div class="cta-row"><button class="btn btn-ghost btn-sm" id="copyKey">Copy access key</button><button class="btn btn-ghost btn-sm" id="themeT">Theme: ${theme.get()}</button><button class="btn btn-ghost btn-sm" id="signOut">Sign out</button></div></div>

      <div class="panel"><h3>History</h3><div class="list" id="histList"><div class="li"><span class="note">Loading…</span></div></div></div></div>`;

    s.querySelectorAll('[data-copyaddr]').forEach((b) => b.onclick = () => { navigator.clipboard.writeText(b.dataset.copyaddr); toast('Address copied'); });
    if ($('#depGo')) $('#depGo').onclick = async () => { try { const r = await api('/api/deposit/verify', { method: 'POST', body: { chain: $('#depChain').value, ref: $('#depRef').value } }); toast(`Credited ${cr(r.deposit.credits)} credits (${r.deposit.amount} ${r.deposit.asset})`); state.me = r.account; renderSignbox(); renderAccount(); } catch (e) { toast(e.message, true); } };
    if ($('#cardGo')) $('#cardGo').onclick = async () => { try { const { url } = await api('/api/deposit/card', { method: 'POST', body: { usd: Number($('#cardUsd').value) } }); location.href = url; } catch (e) { toast(e.message, true); } };
    if ($('#demoGo')) $('#demoGo').onclick = async () => { try { const r = await api('/api/deposit/demo', { method: 'POST', body: { usd: Number($('#demoUsd').value) } }); toast(`Credited ${cr(r.deposit.credits)} credits (demo)`); state.me = r.account; renderSignbox(); renderAccount(); } catch (e) { toast(e.message, true); } };
    if ($('#refreshHold')) $('#refreshHold').onclick = async () => { try { const r = await api('/api/me/holdings', { method: 'POST', body: {} }); state.me = r.account; renderSignbox(); renderAccount(); toast('Holdings refreshed'); } catch (e) { toast(e.message, true); } };
    if ($('#linkWallet')) $('#linkWallet').onclick = () => walletSignIn(true);
    if ($('#simGo')) $('#simGo').onclick = async () => { try { const r = await api('/api/me/holdings', { method: 'POST', body: { simulatePct: Number($('#simPct').value) } }); state.me = r.account; renderSignbox(); renderAccount(); } catch (e) { toast(e.message, true); } };
    $('#copyKey').onclick = () => { navigator.clipboard.writeText(getKey()); toast('Access key copied. Keep it safe.'); };
    $('#themeT').onclick = () => { theme.toggle(); $('#themeT').textContent = 'Theme: ' + theme.get(); };
    $('#signOut').onclick = signOut;
    try {
      const { usage, deposits } = await api('/api/me/history');
      const rows = [...deposits.map((d) => ({ at: d.at, l: `Deposit · ${d.method}${d.asset ? ` · ${d.amount} ${d.asset}` : ''}`, r: `<span class="u">+${cr(d.credits)}</span>` })), ...usage.map((u) => ({ at: u.at, l: `${u.model} · ${u.kind}${u.live === false ? ' · demo' : ''}${u.saved ? ` · saved ${cr(u.saved)}` : ''}`, r: `<span class="d">−${cr(u.credits)}</span>` }))].sort((x, y) => y.at.localeCompare(x.at)).slice(0, 60);
      $('#histList').innerHTML = rows.map((r) => `<div class="li"><div>${r.l}<div class="mono">${new Date(r.at).toLocaleString()}</div></div><div class="r">${r.r}</div></div>`).join('') || '<div class="li"><span class="note">Nothing yet.</span></div>';
    } catch { $('#histList').innerHTML = ''; }
  }

  boot().catch((e) => { console.error(e); toast('Could not load the app: ' + e.message, true); });
})();
