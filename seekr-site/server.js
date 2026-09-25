/* seekr — the server.
 *
 * One process serves the site (public/), the generated assets and the API.
 * No framework: a route table, a JSON body parser, SSE for chat. Railway
 * passes PORT; 8080 is the fallback its generated domain points at. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const config = require('./lib/config');
const catalog = require('./lib/catalog');
const store = require('./lib/store');
const credits = require('./lib/credits');
const auth = require('./lib/auth');
const assets = require('./lib/assets');
const router = require('./lib/router');
const markets = require('./lib/markets');
const chain = require('./lib/chain');
const skills = require('./lib/skills');
const mailer = require('./lib/mailer');

const PUBLIC = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
/* clean URLs → files */
const PAGES = { '/': 'index.html', '/ask': 'ask.html', '/pricing': 'pricing.html', '/models': 'pricing.html', '/calculator': 'calculator.html', '/token': 'token.html', '/developers': 'developers.html', '/community': 'community.html' };

class HttpError extends Error { constructor(status, message, extra) { super(message); this.status = status; Object.assign(this, extra); } }

/* ---------- helpers ---------- */
function send(res, status, body, headers = {}) {
  const json = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(json);
}

function readBody(req, limit = 25 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new HttpError(413, 'Body too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const raw = await readBody(req);
  if (!raw.length) return {};
  try { return JSON.parse(raw.toString('utf8')); } catch { throw new HttpError(400, 'Body is not valid JSON'); }
}

function requireAccount(req) {
  const a = auth.fromRequest(req);
  if (!a) throw new HttpError(401, 'Sign in to start', { code: 'unauthenticated' });
  return a;
}

const ipOf = (req) => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

function accountView(a) {
  return { ...auth.publicAccount(a), tier: credits.tier(a), allowance: credits.allowance(a) };
}

function originOf(req) {
  if (config.publicUrl) return config.publicUrl.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'http';
  return `${proto}://${req.headers['x-forwarded-host'] || req.headers.host}`;
}

const SYSTEM = {
  ask: 'You are seekr, a concise and capable assistant. Answer directly, use markdown when it helps, and keep code in fenced blocks.',
  code: 'You are seekr in Code mode: a senior engineer. Give complete, runnable code in fenced blocks with the language tagged. When asked for a website or page, return a single self-contained HTML file. Explain only what is not obvious from the code.'
};

/* ---------- API ---------- */
const api = {
  'GET /api/health': async () => ({ ok: true, demo: config.demoAllowed(), time: new Date().toISOString() }),

  'GET /api/config': async () => ({
    demo: config.demoAllowed(),
    live: Object.fromEntries(Object.keys(config.keys).map((k) => [k, config.isLive(k)])),
    creditsPerUsd: config.creditsPerUsd,
    markup: config.markup,
    holder: config.holder,
    welcomeCredits: config.welcomeCredits,
    deposits: { ...chain.depositsConfigured(), treasury: config.chain.treasury, minConfirmations: config.chain.minConfirmations },
    holdings: chain.holdingsConfigured(),
    chain: { id: config.chain.rhChainId, token: config.chain.seekrToken, buyUrl: config.chain.buyUrl, chartUrl: config.chain.chartUrl },
    links: config.links,
    skills: skills.publicList(),
    auth: { email: mailer.configured(), wallet: true, username: true },
    free: { on: (process.env.FREE_TIER || 'on') !== 'off', status: router.free.status }
  }),

  'GET /api/models': async () => ({
    categories: catalog.CATEGORIES,
    models: catalog.MODELS.map((m) => ({ ...m, live: config.isLive(m.provider), prices: credits.unitPrices(m) })),
    default: catalog.defaultChat().id,
    count: catalog.MODELS.length
  }),

  'GET /api/markets': async () => markets.snapshot(),

  /* --- auth --- */
  'POST /api/auth/key': async () => { const { account, key } = auth.createAccount(); return { key, account: accountView(account) }; },
  'POST /api/auth/login': async (req) => {
    const { key } = await readJson(req);
    const a = auth.findByKey(String(key || '').trim());
    if (!a) throw new HttpError(401, 'That access key does not match an account');
    return { account: accountView(a) };
  },
  'POST /api/auth/register': async (req) => {
    const { username, password } = await readJson(req);
    const { account, key } = await auth.registerUsername(username, password);
    return { key, account: accountView(account), created: true };
  },
  'POST /api/auth/password': async (req) => {
    const { username, password } = await readJson(req);
    const { account, key } = await auth.loginUsername(username, password, ipOf(req));
    return { key, account: accountView(account) };
  },
  'POST /api/auth/email/start': async (req) => {
    const { email } = await readJson(req);
    const { email: e, code } = auth.newCode(email, 'login', null, ipOf(req));
    await mailer.sendCode(e, code, 'login');
    return { sent: true, email: e };
  },
  'POST /api/auth/email/verify': async (req) => {
    const { email, code } = await readJson(req);
    const r = auth.emailSignIn(email, code);
    return { key: r.key, created: r.created, account: accountView(r.account) };
  },
  'GET /api/auth/nonce': async (req, url) => auth.nonceFor(url.searchParams.get('address') || ''),
  'POST /api/auth/wallet': async (req) => {
    const { address, signature } = await readJson(req);
    const r = auth.walletSignIn(address, signature);
    await refreshHoldings(r.account).catch(() => null);
    return { key: r.key, created: r.created, account: accountView(r.account) };
  },

  /* --- me --- */
  'GET /api/me': async (req) => ({ account: accountView(requireAccount(req)) }),
  'POST /api/me/wallet': async (req) => {
    const a = requireAccount(req);
    const { address, signature } = await readJson(req);
    auth.linkWallet(a, address, signature);
    await refreshHoldings(a).catch(() => null);
    return { account: accountView(a) };
  },
  'POST /api/me/email/start': async (req) => {
    const a = requireAccount(req);
    const { email } = await readJson(req);
    const { email: e, code } = auth.newCode(email, 'link', a.id, ipOf(req));
    await mailer.sendCode(e, code, 'link');
    return { sent: true, email: e };
  },
  'POST /api/me/email/verify': async (req) => {
    const a = requireAccount(req);
    const { email, code } = await readJson(req);
    auth.linkEmail(a, email, code);
    return { account: accountView(a) };
  },
  'POST /api/me/username': async (req) => {
    const a = requireAccount(req);
    const { username, password } = await readJson(req);
    await auth.setUsername(a, username, password);
    return { account: accountView(a) };
  },
  'POST /api/me/password': async (req) => {
    const a = requireAccount(req);
    const { current, next } = await readJson(req);
    await auth.changePassword(a, current, next);
    return { ok: true };
  },
  'POST /api/me/holdings': async (req) => {
    const a = requireAccount(req);
    const body = await readJson(req);
    if (chain.holdingsConfigured() && a.wallet) await refreshHoldings(a);
    else if (config.demoAllowed() && typeof body.simulatePct === 'number') { a.holdingsPct = Math.max(0, Math.min(100, body.simulatePct)); a.holdingsCheckedAt = new Date().toISOString(); a.holdingsSimulated = true; store.put('accounts', a.id, a); }
    else throw new HttpError(a.wallet ? 503 : 400, a.wallet ? 'Holdings checks are not configured on this server' : 'Link a wallet first');
    return { account: accountView(a) };
  },
  'POST /api/me/prefs': async (req) => { const a = requireAccount(req); a.prefs = { ...(a.prefs || {}), ...(await readJson(req)) }; store.put('accounts', a.id, a); return { account: accountView(a) }; },
  'GET /api/me/history': async (req) => {
    const a = requireAccount(req);
    const usage = store.find('usage', (u) => u.account === a.id).sort((x, y) => y.at.localeCompare(x.at)).slice(0, 200);
    const deposits = store.find('deposits', (d) => d.account === a.id).sort((x, y) => y.at.localeCompare(x.at)).slice(0, 100);
    return { usage, deposits };
  },

  /* --- quote --- */
  'POST /api/quote': async (req) => {
    const a = auth.fromRequest(req);
    const b = await readJson(req);
    const model = catalog.get(b.model);
    if (!model) throw new HttpError(400, 'Unknown model');
    const usage = model.kind === 'chat' ? credits.estimateChat(model, b.text || '', b.expectedOut) : b.usage || {};
    const { tier } = router.resolve(model);
    return { quote: credits.quote(model, usage, a), usage, live: tier === 'live', tier };
  },

  /* --- chat (SSE) --- */
  'POST /api/chat': async (req, url, res) => {
    const a = requireAccount(req);
    const b = await readJson(req);
    const model = catalog.get(b.model) || catalog.defaultChat();
    if (model.kind !== 'chat') throw new HttpError(400, `${model.name} is not a chat model`);
    const mode = b.mode === 'code' ? 'code' : 'ask';
    const skill = mode === 'ask' ? skills.get(b.skill) : null;
    const text = String(b.message || '').trim();
    if (!text) throw new HttpError(400, 'Say something first');

    let chat = b.chatId ? store.get('chats', b.chatId) : null;
    if (chat && chat.account !== a.id) throw new HttpError(403, 'Not your chat');
    if (!chat) chat = { id: auth.newId('c_'), account: a.id, title: text.slice(0, 60), mode, model: model.id, messages: [], created: new Date().toISOString() };
    if (skill) chat.skill = skill.id;
    const chatSkill = skills.get(chat.skill);

    /* attachments: text files are inlined, others are named */
    let content = text;
    for (const fid of b.attachments || []) {
      const f = store.get('files', fid);
      if (!f || f.account !== a.id) continue;
      const r = assets.resolve(f.asset);
      if (r && /^(text\/|application\/json)/.test(f.mime) && f.bytes < 200000) content += `\n\n--- ${f.name} ---\n${fs.readFileSync(r.file, 'utf8')}`;
      else content += `\n\n[attached file: ${f.name} (${f.mime}, ${Math.round(f.bytes / 1024)} KB)]`;
    }

    const { impl, live, tier: planned } = router.resolve(model);
    if (planned === 'live' && !credits.canAfford(a, Math.min(credits.quote(model, credits.estimateChat(model, content, 300), a).credits, 1))) throw new HttpError(402, 'Not enough credits. Top up to keep asking.', { code: 'insufficient' });

    const history = chat.messages.slice(-40).map((m) => ({ role: m.role, content: m.content }));
    const messages = [...history, { role: 'user', content }];

    res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no' });
    const emit = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    emit('meta', { chatId: chat.id, model: model.id, live, tier: planned });

    const ac = new AbortController();
    req.on('close', () => ac.abort());
    chat.messages.push({ id: auth.newId('m_'), role: 'user', content: text, attachments: b.attachments || [], at: new Date().toISOString() });
    chat.model = model.id; chat.mode = mode; chat.updated = new Date().toISOString();
    store.put('chats', chat.id, chat);

    try {
      const out = await impl.streamChat({ model, messages, system: SYSTEM[mode] + (chatSkill ? `\n\nSkill: ${chatSkill.title}. ${chatSkill.prompt}` : ''), mode, web: Boolean(b.web || (chatSkill && chatSkill.web)), signal: ac.signal, onText: (t) => emit('delta', { text: t }) });
      const tier = out.tier || planned;
      let rec;
      try {
        rec = settle(a, model, out.usage, tier, { chat: chat.id, servedBy: out.servedBy });
      } catch (e) {
        if (e.code !== 'insufficient') throw e;
        /* the answer was already produced: take what is left rather than refuse it */
        const q = credits.quote(model, out.usage, a);
        rec = { credits: a.balance, listCredits: q.listCredits, saved: 0 };
        a.balance = 0; store.put('accounts', a.id, a);
      }
      const msg = { id: auth.newId('m_'), role: 'assistant', content: out.text, model: model.id, live: tier === 'live', tier, servedBy: out.servedBy || null, at: new Date().toISOString(), credits: rec.credits, usage: out.usage };
      chat.messages.push(msg); chat.updated = msg.at; store.put('chats', chat.id, chat);
      emit('done', { chatId: chat.id, messageId: msg.id, usage: out.usage, credits: rec.credits, listCredits: rec.listCredits, saved: rec.saved, balance: a.balance, live: tier === 'live', tier, servedBy: out.servedBy || null, title: chat.title });
    } catch (e) {
      if (!ac.signal.aborted) emit('error', { message: e.message || 'The model failed' });
    }
    res.end();
    return null;
  },

  /* --- media --- */
  'POST /api/image': async (req) => {
    const a = requireAccount(req);
    const b = await readJson(req);
    const model = catalog.get(b.model) || catalog.recommended('image')[0];
    if (model.kind !== 'image') throw new HttpError(400, `${model.name} does not make images`);
    const prompt = String(b.prompt || '').trim();
    if (!prompt) throw new HttpError(400, 'Describe the image first');
    const size = ['1024x1024', '1536x1024', '1024x1536'].includes(b.size) ? b.size : '1024x1024';
    const usage = { images: 1 };
    const { impl, tier: planned } = router.resolve(model);
    const q = credits.quote(model, usage, a);
    if (planned === 'live' && !credits.canAfford(a, q.credits)) throw new HttpError(402, `Not enough credits (${q.credits} needed)`, { code: 'insufficient' });
    const out = await impl.generateImage({ model, prompt, size });
    const tier = out.tier || planned;
    const live = tier === 'live';
    const rec = settle(a, model, usage, tier, { prompt, servedBy: out.servedBy });
    const item = { id: auth.newId('l_'), account: a.id, kind: 'image', model: model.id, prompt, url: out.url, mime: out.mime, asset: out.id, live, tier, servedBy: out.servedBy || null, credits: rec.credits, created: new Date().toISOString() };
    store.put('library', item.id, item);
    return { item, balance: a.balance, credits: rec.credits, live, tier, servedBy: out.servedBy || null };
  },

  'POST /api/video': async (req) => {
    const a = requireAccount(req);
    const b = await readJson(req);
    const model = catalog.get(b.model) || catalog.recommended('video')[0];
    if (model.kind !== 'video') throw new HttpError(400, `${model.name} does not make video`);
    const prompt = String(b.prompt || '').trim();
    if (!prompt) throw new HttpError(400, 'Describe the clip first');
    const seconds = Math.max(2, Math.min(15, Number(b.seconds) || 5));
    const usage = { seconds };
    const { impl, tier: planned } = router.resolve(model);
    const q = credits.quote(model, usage, a);
    if (planned === 'live' && !credits.canAfford(a, q.credits)) throw new HttpError(402, `Not enough credits (${q.credits} needed)`, { code: 'insufficient' });
    const out = await impl.generateVideo({ model, prompt, seconds, aspect: b.aspect });
    const tier = out.tier || planned;
    const live = tier === 'live';
    const rec = settle(a, model, usage, tier, { prompt, servedBy: out.servedBy });
    const item = { id: auth.newId('l_'), account: a.id, kind: 'video', model: model.id, prompt, url: out.url, mime: out.mime, asset: out.id, seconds, live, tier, servedBy: out.servedBy || null, credits: rec.credits, created: new Date().toISOString() };
    store.put('library', item.id, item);
    return { item, balance: a.balance, credits: rec.credits, live, tier, servedBy: out.servedBy || null };
  },

  'POST /api/tts': async (req) => {
    const a = requireAccount(req);
    const b = await readJson(req);
    const model = catalog.get(b.model) || catalog.recommended('audio')[0];
    if (model.kind !== 'tts') throw new HttpError(400, `${model.name} does not speak`);
    const text = String(b.text || '').trim().slice(0, 5000);
    if (!text) throw new HttpError(400, 'Write something to say first');
    const usage = { chars: text.length };
    const { impl, tier: planned } = router.resolve(model);
    const q = credits.quote(model, usage, a);
    if (planned === 'live' && !credits.canAfford(a, q.credits)) throw new HttpError(402, `Not enough credits (${q.credits} needed)`, { code: 'insufficient' });
    const out = await impl.speak({ model, text, voice: b.voice });
    const tier = out.tier || planned;
    const live = tier === 'live';
    const rec = settle(a, model, usage, tier, { prompt: text.slice(0, 200), servedBy: out.servedBy });
    const item = { id: auth.newId('l_'), account: a.id, kind: 'audio', model: model.id, prompt: text, url: out.url, mime: out.mime, asset: out.id, live, tier, servedBy: out.servedBy || null, credits: rec.credits, created: new Date().toISOString() };
    store.put('library', item.id, item);
    return { item, balance: a.balance, credits: rec.credits, live, tier, servedBy: out.servedBy || null };
  },

  'POST /api/stt': async (req) => {
    const a = requireAccount(req);
    const b = await readJson(req);
    const model = catalog.MODELS.find((m) => m.id === b.model && m.kind === 'stt') || catalog.MODELS.find((m) => m.kind === 'stt');
    const audio = Buffer.from(String(b.audio || ''), 'base64');
    if (!audio.length) throw new HttpError(400, 'No audio received');
    const minutes = Math.max(0.05, (Number(b.seconds) || audio.length / 16000) / 60);
    const usage = { minutes };
    const { impl, tier: planned } = router.resolve(model);
    if (planned === 'live' && !credits.canAfford(a, credits.quote(model, usage, a).credits)) throw new HttpError(402, 'Not enough credits', { code: 'insufficient' });
    const out = await impl.transcribe({ model, audio, mime: b.mime || 'audio/webm' });
    const tier = out.tier || planned;
    const rec = settle(a, model, usage, tier, {});
    return { text: out.text, credits: rec.credits, balance: a.balance, live: tier === 'live', tier };
  },

  /* --- chats --- */
  'GET /api/chats': async (req) => {
    const a = requireAccount(req);
    const chats = store.find('chats', (c) => c.account === a.id).sort((x, y) => (y.updated || y.created).localeCompare(x.updated || x.created));
    return { chats: chats.map(({ messages, ...c }) => ({ ...c, count: messages.length, last: messages[messages.length - 1]?.at })) };
  },
  'GET /api/chats/:id': async (req, url, res, p) => { const a = requireAccount(req); const c = store.get('chats', p.id); if (!c || c.account !== a.id) throw new HttpError(404, 'No such chat'); return { chat: c }; },
  'DELETE /api/chats/:id': async (req, url, res, p) => { const a = requireAccount(req); const c = store.get('chats', p.id); if (!c || c.account !== a.id) throw new HttpError(404, 'No such chat'); store.del('chats', c.id); return { ok: true }; },
  'POST /api/chats/:id/rename': async (req, url, res, p) => { const a = requireAccount(req); const c = store.get('chats', p.id); if (!c || c.account !== a.id) throw new HttpError(404, 'No such chat'); const { title } = await readJson(req); c.title = String(title || '').slice(0, 80) || c.title; store.put('chats', c.id, c); return { chat: c }; },
  'POST /api/chats/:id/share': async (req, url, res, p) => {
    const a = requireAccount(req); const c = store.get('chats', p.id);
    if (!c || c.account !== a.id) throw new HttpError(404, 'No such chat');
    if (!c.share) { c.share = auth.newId('s_'); store.put('chats', c.id, c); store.put('shares', c.share, { chat: c.id, at: new Date().toISOString() }); }
    return { url: `${originOf(req)}/ask#share/${c.share}`, token: c.share };
  },
  'DELETE /api/chats/:id/share': async (req, url, res, p) => { const a = requireAccount(req); const c = store.get('chats', p.id); if (!c || c.account !== a.id) throw new HttpError(404, 'No such chat'); if (c.share) { store.del('shares', c.share); delete c.share; store.put('chats', c.id, c); } return { ok: true }; },
  'GET /api/shared/:token': async (req, url, res, p) => {
    const s = store.get('shares', p.token); const c = s && store.get('chats', s.chat);
    if (!c) throw new HttpError(404, 'That link is gone');
    return { chat: { id: c.id, title: c.title, mode: c.mode, model: c.model, created: c.created, messages: c.messages.map(({ role, content, model, at }) => ({ role, content, model, at })) } };
  },

  /* --- library & files --- */
  'GET /api/library': async (req) => { const a = requireAccount(req); return { items: store.find('library', (i) => i.account === a.id).sort((x, y) => y.created.localeCompare(x.created)) }; },
  'DELETE /api/library/:id': async (req, url, res, p) => { const a = requireAccount(req); const i = store.get('library', p.id); if (!i || i.account !== a.id) throw new HttpError(404, 'No such item'); store.del('library', i.id); return { ok: true }; },
  'GET /api/files': async (req) => { const a = requireAccount(req); return { files: store.find('files', (f) => f.account === a.id).sort((x, y) => y.created.localeCompare(x.created)) }; },
  'POST /api/files': async (req) => {
    const a = requireAccount(req);
    const b = await readJson(req);
    const buf = Buffer.from(String(b.data || ''), 'base64');
    if (!buf.length) throw new HttpError(400, 'Empty file');
    if (buf.length > 15 * 1024 * 1024) throw new HttpError(413, 'Files are limited to 15 MB');
    const mime = String(b.mime || 'application/octet-stream').split(';')[0];
    const saved = assets.save(buf, mime);
    const f = { id: auth.newId('f_'), account: a.id, name: String(b.name || 'file').slice(0, 120), mime, bytes: buf.length, url: saved.url, asset: saved.id, created: new Date().toISOString() };
    store.put('files', f.id, f);
    return { file: f };
  },
  'DELETE /api/files/:id': async (req, url, res, p) => { const a = requireAccount(req); const f = store.get('files', p.id); if (!f || f.account !== a.id) throw new HttpError(404, 'No such file'); store.del('files', f.id); return { ok: true }; },

  /* --- deposits --- */
  'POST /api/deposit/verify': async (req) => {
    const a = requireAccount(req);
    const { chain: ch, ref } = await readJson(req);
    const key = `${ch}:${String(ref || '').trim()}`;
    if (!ref) throw new HttpError(400, 'Paste the transaction id');
    if (store.find('deposits', (d) => d.ref === key).length) throw new HttpError(409, 'That transaction was already credited');
    const v = await chain.verifyDeposit(ch, String(ref).trim());
    const rec = credits.credit(store, a, v.usd * config.creditsPerUsd, { ref: key, chain: v.chain, asset: v.asset, amount: v.amount, usd: credits.round(v.usd, 2), from: v.from, method: 'crypto' });
    return { deposit: rec, account: accountView(a) };
  },
  'POST /api/deposit/demo': async (req) => {
    const a = requireAccount(req);
    if (!config.demoAllowed()) throw new HttpError(403, 'Demo top-ups are off on this server');
    const { usd } = await readJson(req);
    const n = Math.max(1, Math.min(100, Number(usd) || 10));
    const rec = credits.credit(store, a, n * config.creditsPerUsd, { chain: 'demo', asset: 'USDT', amount: n, usd: n, method: 'demo' });
    return { deposit: rec, account: accountView(a) };
  },
  'POST /api/deposit/card': async (req) => {
    const a = requireAccount(req);
    const { usd } = await readJson(req);
    return chain.cardCheckout(a, Number(usd) || 10, originOf(req));
  },
  'POST /api/stripe/webhook': async (req) => {
    const raw = (await readBody(req)).toString('utf8');
    const ev = chain.stripeEvent(raw, req.headers['stripe-signature']);
    if (ev.type === 'checkout.session.completed' && ev.data.object.payment_status === 'paid') {
      const s = ev.data.object;
      const a = store.get('accounts', s.client_reference_id || s.metadata?.account);
      if (a && !store.find('deposits', (d) => d.ref === `stripe:${s.id}`).length) {
        const usd = (s.amount_total || 0) / 100;
        credits.credit(store, a, usd * config.creditsPerUsd, { ref: `stripe:${s.id}`, chain: 'card', asset: 'USD', amount: usd, usd, method: 'card' });
      }
    }
    return { received: true };
  }
};

/* Only live calls cost credits; free and demo answers are recorded at zero. */
function settle(a, model, usage, tier, meta = {}) {
  if (tier === 'live') return credits.debit(store, a, model, usage, { ...meta, live: true, tier });
  const rec = { id: 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), account: a.id, at: new Date().toISOString(), model: model.id, kind: model.kind, usage, credits: 0, listCredits: 0, saved: 0, live: false, tier, ...meta };
  store.put('usage', rec.id, rec);
  return rec;
}

async function refreshHoldings(a) {
  if (!a.wallet || !chain.holdingsConfigured()) return;
  const h = await chain.holdingsPct(a.wallet);
  a.holdingsPct = h.pct; a.holdingsHeld = h.held; a.holdingsCheckedAt = new Date().toISOString(); a.holdingsSimulated = false;
  store.put('accounts', a.id, a);
}

/* route matching with :params */
const routes = Object.entries(api).map(([k, h]) => {
  const [method, pattern] = k.split(' ');
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, n) => { keys.push(n); return '([^/]+)'; }) + '$');
  return { method, re, keys, h };
});

function match(method, pathname) {
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = pathname.match(r.re);
    if (m) return { h: r.h, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}

/* ---------- static ---------- */
function serveFile(res, file, cache) {
  fs.readFile(file, (err, body) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); res.end('404 — nothing here'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': cache });
    res.end(body);
  });
}

function serveStatic(req, res, pathname) {
  if (pathname.startsWith('/assets/')) {
    const r = assets.resolve(pathname.slice('/assets/'.length));
    if (!r) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, { 'content-type': r.mime, 'cache-control': 'private, max-age=31536000, immutable' });
    fs.createReadStream(r.file).pipe(res);
    return;
  }
  let rel = PAGES[pathname] || pathname;
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(PUBLIC, path.normalize(rel));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); res.end('Forbidden'); return; }
  serveFile(res, file, path.extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600');
}

/* ---------- server ---------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const pathname = decodeURIComponent(url.pathname);
  if (!pathname.startsWith('/api/')) return serveStatic(req, res, pathname);

  const m = match(req.method, pathname);
  if (!m) return send(res, 404, { error: 'No such endpoint' });
  try {
    const out = await m.h(req, url, res, m.params);
    if (out !== null && !res.headersSent) send(res, 200, out);
  } catch (e) {
    const status = e.status || 500;
    if (status >= 500) console.error(`${req.method} ${pathname}:`, e);
    if (!res.headersSent) send(res, status, { error: e.message || 'Something broke', code: e.code, needed: e.needed });
    else res.end();
  }
});

server.listen(config.port, () => {
  const live = Object.keys(config.keys).filter((k) => config.isLive(k));
  console.log(`seekr on :${config.port} — ${live.length ? 'live: ' + live.join(', ') : 'no provider keys'} — the rest: free tier, then demo`);
  if ((process.env.FREE_TIER || 'on') !== 'off' && process.env.FREE_PROBE !== 'off') router.free.probe().then((r) => console.log('free tier check: ' + r)).catch((e) => console.log('free tier check failed: ' + e.message));
});
