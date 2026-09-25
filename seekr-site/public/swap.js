/* The swap page. Quotes and routes come from LI.FI through /api/swap/*;
 * every transaction is signed in the user's own wallet:
 *   EVM    — MetaMask, Coinbase Wallet, Phantom (EVM), Rabby… via EIP-6963
 *   Solana — Phantom (or Coinbase Wallet's Solana provider)
 * Nothing here ever sees a private key. */
(() => {
  const { api, esc, toast } = seekr;
  seekr.nav();
  const $ = (s, r = document) => r.querySelector(s);
  const SOL = 1151111081099710;
  const NATIVE_EVM = '0x0000000000000000000000000000000000000000';
  const NATIVE_SOL = '11111111111111111111111111111111';
  const PLACEHOLDER = { EVM: '0x000000000000000000000000000000000000dEaD', SVM: 'So11111111111111111111111111111111111111112' };
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const S = {
    chains: [], tokens: new Map(), rwa: [],
    from: null, to: null, amount: '', slippage: 0.005,
    evm: null,   // { provider, info, address }
    sol: null,   // { provider, name, address }
    quote: null, quoting: false, busy: false, bal: null, seq: 0
  };
  const chainOf = (id) => S.chains.find((c) => c.id === Number(id));
  const typeOf = (id) => (Number(id) === SOL ? 'SVM' : 'EVM');
  const addrFor = (chainId) => (typeOf(chainId) === 'SVM' ? S.sol && S.sol.address : S.evm && S.evm.address);

  /* ---------- units ---------- */
  function toRaw(v, dec) {
    v = String(v || '').replace(/[\s\u00a0'_]/g, '');
    v = v.includes(',') && v.includes('.') ? v.replace(/,/g, '') : v.replace(',', '.');
    if (!/^\d*\.?\d*$/.test(v) || v === '' || v === '.') return null;
    const [i, f = ''] = v.split('.');
    return (BigInt(i || '0') * 10n ** BigInt(dec) + BigInt((f + '0'.repeat(dec)).slice(0, dec) || '0')).toString();
  }
  function fromRaw(raw, dec, max = 6) {
    if (raw === null || raw === undefined) return '0';
    const n = BigInt(raw), base = 10n ** BigInt(dec);
    const i = n / base, f = (n % base).toString().padStart(dec, '0');
    let frac = f.slice(0, max).replace(/0+$/, '');
    if (i === 0n && !frac && n > 0n) frac = f.replace(/^0*/, (z) => z).slice(0, Math.min(dec, f.search(/[1-9]/) + 3)).replace(/0+$/, '');
    return i.toLocaleString('en-US') + (frac ? '.' + frac : '');
  }
  const usd = (n) => (n === null || n === undefined || isNaN(n) ? '' : '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: Number(n) < 1 ? 4 : 2 }));

  /* ---------- wallets ---------- */
  const evmWallets = [];
  window.addEventListener('eip6963:announceProvider', (e) => {
    const d = e.detail;
    if (!evmWallets.find((w) => w.info.uuid === d.info.uuid)) evmWallets.push(d);
  });
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  const KNOWN = [
    { id: 'metamask', name: 'MetaMask', rdns: 'io.metamask', logo: 'https://cdn.jsdelivr.net/gh/MetaMask/brand-resources@master/SVG/SVG_MetaMask_Icon_Color.svg', deep: () => `https://metamask.app.link/dapp/${location.host}${location.pathname}`, install: 'https://metamask.io/download/' },
    { id: 'coinbase', name: 'Coinbase Wallet', rdns: 'com.coinbase.wallet', deep: () => `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(location.href)}`, install: 'https://www.coinbase.com/wallet/downloads' },
    { id: 'phantom', name: 'Phantom', rdns: 'app.phantom', solana: true, deep: () => `https://phantom.app/ul/browse/${encodeURIComponent(location.href)}?ref=${encodeURIComponent(location.origin)}`, install: 'https://phantom.app/download' }
  ];
  const WALLET_ICON = { metamask: '/art/wallets/metamask.svg', coinbase: '/art/wallets/coinbase.svg', phantom: '/art/wallets/phantom.svg' };
  const GENERIC_WALLET = '<span class="wal-generic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M16 12.5h2M3 9h13a2 2 0 0 0 2-2V6"/></svg></span>';

  async function connectEvm(w) {
    const provider = w.provider;
    const [address] = await provider.request({ method: 'eth_requestAccounts' });
    S.evm = { provider, info: w.info, address };
    provider.on && provider.on('accountsChanged', (a) => { if (!a.length) S.evm = null; else S.evm.address = a[0]; renderWallet(); refresh(); });
    renderWallet(); refresh();
  }
  async function connectSol(provider, name) {
    const r = await provider.connect();
    const address = (r && r.publicKey ? r.publicKey : provider.publicKey).toString();
    S.sol = { provider, name, address };
    provider.on && provider.on('accountChanged', (pk) => { if (pk) S.sol.address = pk.toString(); else S.sol = null; renderWallet(); refresh(); });
    renderWallet(); refresh();
  }
  const short = (a) => (a ? a.slice(0, 5) + '…' + a.slice(-4) : '');
  function renderWallet() {
    const b = $('#walletBtn');
    const parts = [];
    if (S.evm) parts.push(short(S.evm.address));
    if (S.sol) parts.push('◎ ' + short(S.sol.address));
    b.textContent = parts.length ? parts.join(' · ') : 'Connect wallet';
  }

  function openWallets() {
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    const m = $('#walModalBody'), bg = $('#walModal');
    const rows = [];
    for (const k of KNOWN) {
      const evm = evmWallets.find((w) => w.info.rdns === k.rdns || (k.id === 'coinbase' && /coinbase/i.test(w.info.name)));
      const solProv = k.id === 'phantom' ? window.phantom && window.phantom.solana : k.id === 'coinbase' ? window.coinbaseSolana : null;
      const icon = evm && evm.info.icon ? `<img src="${esc(evm.info.icon)}" alt="">` : `<img src="${WALLET_ICON[k.id]}" alt="">`;
      const acts = [];
      if (evm) acts.push(`<button class="btn btn-ghost btn-sm" data-evm="${esc(evm.info.uuid)}">${k.id === 'phantom' ? 'Ethereum & EVM' : 'Connect'}</button>`);
      if (solProv) acts.push(`<button class="btn btn-ghost btn-sm" data-sol="${k.id}">Solana</button>`);
      if (!evm && !solProv) acts.push(isMobile ? `<a class="btn btn-ghost btn-sm" href="${k.deep()}">Open in app</a>` : `<a class="btn btn-ghost btn-sm" href="${k.install}" target="_blank" rel="noopener">Install</a>`);
      rows.push(`<div class="wal-row">${icon}<div><b>${k.name}</b><small>${evm || solProv ? 'Detected' : isMobile ? 'Opens this page inside the app' : 'Not installed'}</small></div><div class="wal-acts">${acts.join('')}</div></div>`);
    }
    for (const w of evmWallets.filter((w) => !KNOWN.some((k) => k.rdns === w.info.rdns || (k.id === 'coinbase' && /coinbase/i.test(w.info.name))))) {
      rows.push(`<div class="wal-row">${w.info.icon ? `<img src="${esc(w.info.icon)}" alt="">` : GENERIC_WALLET}<div><b>${esc(w.info.name)}</b><small>Detected</small></div><div class="wal-acts"><button class="btn btn-ghost btn-sm" data-evm="${esc(w.info.uuid)}">Connect</button></div></div>`);
    }
    if (!evmWallets.length && window.ethereum && !rows.some((r) => r.includes('data-evm'))) {
      evmWallets.push({ info: { uuid: 'injected', name: 'Browser wallet', icon: '', rdns: 'injected' }, provider: window.ethereum });
      rows.push(`<div class="wal-row">${GENERIC_WALLET}<div><b>Browser wallet</b><small>Detected</small></div><div class="wal-acts"><button class="btn btn-ghost btn-sm" data-evm="injected">Connect</button></div></div>`);
    }
    m.innerHTML = `<button class="icon-btn x" id="walClose">✕</button><h2>Connect a wallet</h2><p class="sub">EVM chains with MetaMask or Coinbase Wallet, Solana with Phantom. You can connect one of each for cross-chain swaps.</p>${rows.join('')}
      ${S.evm || S.sol ? '<button class="btn btn-ghost btn-sm" id="walOff" style="margin-top:10px">Disconnect</button>' : ''}`;
    bg.classList.add('open');
    const close = () => bg.classList.remove('open');
    $('#walClose').onclick = close; bg.onclick = (e) => { if (e.target === bg) close(); };
    m.querySelectorAll('[data-evm]').forEach((b) => b.onclick = async () => { try { await connectEvm(evmWallets.find((w) => w.info.uuid === b.dataset.evm)); close(); } catch (e) { toast(e.message || 'Connection cancelled', true); } });
    m.querySelectorAll('[data-sol]').forEach((b) => b.onclick = async () => { try { await connectSol(b.dataset.sol === 'phantom' ? window.phantom.solana : window.coinbaseSolana, b.dataset.sol === 'phantom' ? 'Phantom' : 'Coinbase Wallet'); close(); } catch (e) { toast(e.message || 'Connection cancelled', true); } });
    if ($('#walOff')) $('#walOff').onclick = () => { try { S.sol && S.sol.provider.disconnect && S.sol.provider.disconnect(); } catch { /* ignore */ } S.evm = null; S.sol = null; renderWallet(); refresh(); close(); };
  }

  /* ---------- tokens ---------- */
  async function tokensFor(chainId) {
    if (!S.tokens.has(chainId)) S.tokens.set(chainId, (await api('/api/swap/tokens?chain=' + chainId)).tokens);
    return S.tokens.get(chainId);
  }
  /* a real-world asset issued on several networks: take the one on the network you pay from */
  function sameChain(t) {
    if (!t || !t.kind || !S.from || t.chainId === S.from.chainId) return t;
    const alt = S.rwa.find((x) => x.symbol.toUpperCase() === t.symbol.toUpperCase() && x.chainId === S.from.chainId);
    if (alt) { const c = chainOf(alt.chainId); toast(`Using ${alt.symbol} on ${c ? c.name : 'the same network'}: no bridge, no second wallet.`); return alt; }
    return t;
  }
  const fallbackIcon = (sym) => `<span class="tok-fb">${esc(String(sym || '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 1).toUpperCase() || '?')}</span>`;
  const tokImg = (t) => (t.logo ? `<img src="${esc(t.logo)}" alt="" onerror="this.outerHTML=this.dataset.fb" data-fb='${fallbackIcon(t.symbol).replace(/'/g, '&#39;')}'>` : fallbackIcon(t.symbol));

  /* ---------- real-world asset shelf: one tile per asset, whatever the number of networks it lives on ---------- */
  const RWA_NAMES = { PAXG: 'Pax Gold', XAUT: 'Tether Gold', USDY: 'Ondo US Dollar Yield', OUSG: 'Ondo Short-Term Treasuries', BUIDL: 'BlackRock USD Fund', USTB: 'Superstate Treasuries', TBILL: 'OpenEden T-Bills', SPYX: 'S&P 500 ETF', QQQX: 'Nasdaq 100 ETF', GOOGLX: 'Alphabet', MSTRX: 'Strategy', AMZNX: 'Amazon', METAX: 'Meta', MSFTX: 'Microsoft', AMDX: 'AMD', CRCLX: 'Circle', COINX: 'Coinbase', HOODX: 'Robinhood', NVDAX: 'NVIDIA', AAPLX: 'Apple', TSLAX: 'Tesla', NFLXX: 'Netflix' };
  const HOME = { Gold: 1, Treasuries: 1, Stocks: SOL };
  const ORDER = ['PAXG', 'XAUT', 'USDY', 'OUSG', 'BUIDL', 'USTB', 'TBILL', 'TSLAX', 'NVDAX', 'AAPLX', 'SPYX', 'QQQX', 'HOODX', 'COINX', 'MSTRX', 'AMZNX', 'GOOGLX', 'METAX', 'MSFTX', 'NFLXX', 'CRCLX', 'AMDX'];
  const rank = (k) => { const i = ORDER.indexOf(k); return i < 0 ? 99 : i; };
  const px = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: n < 1 ? 4 : 2 });
  const median = (a) => { const v = a.filter((n) => n > 0).sort((x, y) => x - y); return v.length ? v[Math.floor((v.length - 1) / 2)] : null; };
  function shelfAssets() {
    const by = new Map();
    for (const t of S.rwa) {
      const k = t.symbol.toUpperCase();
      if (!by.has(k)) by.set(k, { key: k, kind: t.kind, list: [] });
      by.get(k).list.push(t);
    }
    return [...by.values()].map((a) => {
      const withLogo = a.list.find((t) => t.logo), first = a.list.find((t) => t.chainId === HOME[a.kind]) || withLogo || a.list[0];
      return { ...a, symbol: first.symbol, logo: withLogo ? withLogo.logo : '', name: RWA_NAMES[a.key] || first.name.replace(/\s*xStock$/i, ''), price: median(a.list.map((t) => t.priceUSD)), pick: first, chains: [...new Set(a.list.map((t) => t.chainId))] };
    }).sort((a, b) => ['Gold', 'Treasuries', 'Stocks'].indexOf(a.kind) - ['Gold', 'Treasuries', 'Stocks'].indexOf(b.kind) || rank(a.key) - rank(b.key));
  }
  function drawShelf(filter) {
    const el = $('#rwaList');
    if (!S.rwa.length) { el.innerHTML = '<span class="note">No real-world assets are on the swap routes right now.</span>'; return; }
    const all = shelfAssets(), kinds = ['Gold', 'Treasuries', 'Stocks'].filter((k) => all.some((a) => a.kind === k));
    const shown = all.filter((a) => filter === 'All' || a.kind === filter);
    const chainIcons = (ids) => ids.slice(0, 4).map((id) => { const c = chainOf(id); return c ? `<img src="${esc(c.logo)}" alt="" title="${esc(c.name)}">` : ''; }).join('') + (ids.length > 4 ? `<i>+${ids.length - 4}</i>` : '');
    el.innerHTML = `<div class="seg rwa-filter">${['All', ...kinds].map((k) => `<button data-k="${k}" class="${k === filter ? 'on' : ''}">${k}<small>${k === 'All' ? all.length : all.filter((a) => a.kind === k).length}</small></button>`).join('')}</div>
      <div class="rwa-grid">${shown.map((a) => `<button class="rwa-tile" data-k="${esc(a.key)}">
        <span class="rwa-ic">${tokImg({ logo: a.logo, symbol: a.symbol })}</span>
        <span class="rwa-nm"><span class="rwa-h"><b>${esc(a.symbol)}</b><span class="rwa-px">${a.price ? px(a.price) : ''}</span></span><small title="${esc(a.name)}">${esc(a.name)}</small></span>
        <span class="rwa-ft"><span class="rwa-kind k-${a.kind.toLowerCase()}">${a.kind === 'Stocks' ? 'Stock' : a.kind === 'Treasuries' ? 'Treasury' : 'Gold'}</span><span class="rwa-chains">${chainIcons(a.chains)}</span><span class="rwa-go">Swap</span></span>
      </button>`).join('')}</div>`;
    el.querySelectorAll('.rwa-filter button').forEach((b) => b.onclick = () => drawShelf(b.dataset.k));
    el.querySelectorAll('.rwa-tile').forEach((b) => b.onclick = () => { const a = all.find((x) => x.key === b.dataset.k); S.to = sameChain(a.pick); scrollTo({ top: 0, behavior: 'smooth' }); refresh(); $('#amt').focus(); });
  }

  function tokBtn(el, side) {
    const t = S[side];
    if (!t) { el.innerHTML = '<span class="tok-sel">Select token</span><span class="caret"></span>'; return; }
    const c = chainOf(t.chainId);
    el.innerHTML = `<span class="tok-ic">${tokImg(t)}${c ? `<img class="tok-chain" src="${esc(c.logo)}" alt="" title="${esc(c.name)}">` : ''}</span><span class="tok-sym">${esc(t.symbol)}${c ? `<small>${esc(c.name)}</small>` : ''}</span><span class="caret"></span>`;
    el.title = `${t.name} on ${c ? c.name : ''}`;
  }

  function openPicker(side) {
    const bg = $('#tokModal'), m = $('#tokModalBody');
    let chainId = (S[side] && S[side].chainId) || 1;
    let tab = 'all';
    const featured = S.chains.slice(0, 11);
    m.innerHTML = `<button class="icon-btn x" id="tokClose">✕</button><h2>Select a token</h2>
      <div class="seg tok-tabs"><button data-t="all" class="on">All tokens</button><button data-t="rwa">Real-world assets</button></div>
      <div class="tok-chains" id="tokChains"></div>
      <label class="tok-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="tokSearch" placeholder="Search a name or paste an address" autocomplete="off"></label>
      <div class="tok-pop" id="tokPop"></div>
      <div class="tok-lbl" id="tokLbl"></div>
      <div class="tok-list" id="tokList"><span class="note">Loading…</span></div>`;
    bg.classList.add('open');
    const close = () => bg.classList.remove('open');
    $('#tokClose').onclick = close; bg.onclick = (e) => { if (e.target === bg) close(); };
    const drawChains = () => {
      $('#tokChains').innerHTML = featured.map((c) => `<button class="tok-chip ${c.id === chainId ? 'on' : ''}" data-c="${c.id}" title="${esc(c.name)}"><img src="${esc(c.logo)}" alt="" onerror="this.style.display='none'">${esc(c.name.replace(' Chain', '').replace(' Mainnet', ''))}</button>`).join('')
        + `<label class="tok-chip tok-more-wrap"><select id="tokMore" aria-label="More networks"><option value="">More networks</option>${S.chains.filter((c) => !featured.includes(c)).map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>`;
      m.querySelectorAll('[data-c]').forEach((b) => b.onclick = () => { chainId = Number(b.dataset.c); drawChains(); draw(); });
      $('#tokMore').onchange = (e) => { if (e.target.value) { chainId = Number(e.target.value); if (!featured.find((c) => c.id === chainId)) featured.push(chainOf(chainId)); drawChains(); draw(); } };
    };
    m.querySelectorAll('.tok-tabs button').forEach((b) => b.onclick = () => { tab = b.dataset.t; m.querySelectorAll('.tok-tabs button').forEach((x) => x.classList.toggle('on', x === b)); $('#tokChains').style.display = tab === 'rwa' ? 'none' : ''; draw(); });
    const pick = (t) => { if (side === 'to') t = sameChain(t); S[side] = t; if (side === 'from' && S.to && S.to.kind) S.to = sameChain(S.to); if (S.from && S.to && S.from.address === S.to.address && S.from.chainId === S.to.chainId) S[side === 'from' ? 'to' : 'from'] = null; close(); tokBtn($('#fromTok'), 'from'); tokBtn($('#toTok'), 'to'); refresh(); };
    const row = (t) => { const c = chainOf(t.chainId); return `<button class="tok-row" data-a="${esc(t.address)}" data-ch="${t.chainId}"><span class="tok-ic">${tokImg(t)}${c ? `<img class="tok-chain" src="${esc(c.logo)}" alt="">` : ''}</span><span class="tok-nm"><b>${esc(t.symbol)}</b><small>${esc(t.name)}${tab === 'rwa' && c ? ' · ' + esc(c.name) : ''}</small></span>${t.kind ? `<span class="badge">${t.kind}</span>` : ''}<span class="tok-px">${t.priceUSD ? usd(t.priceUSD) : ''}</span></button>`; };
    let seq = 0;
    const draw = async () => {
      const my = ++seq;
      const list = $('#tokList');
      const q = $('#tokSearch').value.trim();
      let items;
      if (tab === 'rwa') items = [...S.rwa].sort((a, b) => (S.from && b.chainId === S.from.chainId ? 1 : 0) - (S.from && a.chainId === S.from.chainId ? 1 : 0));
      else { list.innerHTML = '<span class="note">Loading…</span>'; try { items = await tokensFor(chainId); } catch (e) { list.innerHTML = `<span class="note">${esc(e.message)}</span>`; return; } }
      if (my !== seq) return;
      const ql = q.toLowerCase();
      let shown = q ? items.filter((t) => t.symbol.toLowerCase().includes(ql) || t.name.toLowerCase().includes(ql) || t.address.toLowerCase() === ql) : items;
      shown = shown.slice(0, 120);
      if (!shown.length && q && tab === 'all' && (/^0x[0-9a-fA-F]{40}$/.test(q) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q))) {
        try { const { token } = await api(`/api/swap/token?chain=${chainId}&token=${encodeURIComponent(q)}`); shown = [token]; } catch { list.innerHTML = '<span class="note">No token at that address on this chain.</span>'; return; }
      }
      const cn = chainOf(chainId);
      $('#tokLbl').textContent = tab === 'rwa' ? 'Tokenized gold, treasuries and stocks' : q ? `Results on ${cn ? cn.name : 'this network'}` : `Tokens on ${cn ? cn.name : 'this network'}`;
      const pop = tab === 'all' && !q ? items.filter((t) => t.popular).slice(0, 6) : [];
      $('#tokPop').innerHTML = pop.map((t) => `<button class="tok-pchip" data-a="${esc(t.address)}" data-ch="${t.chainId}">${tokImg(t)}${esc(t.symbol)}</button>`).join('');
      $('#tokPop').querySelectorAll('button').forEach((b) => b.onclick = () => pick(items.find((t) => t.address === b.dataset.a)));
      list.innerHTML = shown.length ? shown.map(row).join('') : `<span class="note">${tab === 'rwa' ? 'No real-world assets available on the swap routes right now.' : 'No tokens match.'}</span>`;
      list.querySelectorAll('.tok-row').forEach((b) => b.onclick = () => { const src = tab === 'rwa' ? S.rwa : S.tokens.get(Number(b.dataset.ch)) || shown; pick(src.find((t) => t.address === b.dataset.a && t.chainId === Number(b.dataset.ch)) || shown.find((t) => t.address === b.dataset.a)); });
    };
    let deb; $('#tokSearch').oninput = () => { clearTimeout(deb); deb = setTimeout(draw, 180); };
    drawChains(); draw(); $('#tokSearch').focus();
  }

  /* ---------- balance, quote ---------- */
  async function loadBalance() {
    S.bal = null; $('#payBal').textContent = ''; $('#maxBtn').hidden = true;
    const t = S.from, a = t && addrFor(t.chainId);
    if (!t || !a) return;
    try {
      const { raw } = await api(`/api/swap/balance?chain=${t.chainId}&address=${a}&token=${encodeURIComponent(t.address)}`);
      if (S.from !== t) return;
      S.bal = raw; $('#payBal').textContent = 'Balance ' + fromRaw(raw, t.decimals); $('#maxBtn').hidden = false;
    } catch { /* balance is a nicety */ }
  }

  let qTimer = null;
  function refresh() {
    tokBtn($('#fromTok'), 'from'); tokBtn($('#toTok'), 'to');
    const crossVm = S.from && S.to && typeOf(S.from.chainId) !== typeOf(S.to.chainId);
    const toRow = $('#toAddrRow');
    toRow.hidden = !crossVm;
    if (crossVm) {
      const need = typeOf(S.to.chainId);
      $('#toAddrLbl').textContent = need === 'SVM' ? 'Receive at (Solana address)' : 'Receive at (EVM address)';
      const known = addrFor(S.to.chainId);
      if (known && !$('#toAddr').value) $('#toAddr').value = known;
      $('#toAddr').placeholder = need === 'SVM' ? 'Connect Phantom or paste a Solana address' : 'Connect MetaMask or paste 0x…';
    }
    loadBalance();
    clearTimeout(qTimer); qTimer = setTimeout(getQuote, 450);
    renderGo();
  }

  async function getQuote() {
    const my = ++S.seq;
    S.quote = null; $('#swErr').hidden = true; $('#details').hidden = true;
    $('#recvAmt').textContent = '0'; $('#recvUsd').textContent = ''; $('#payUsd').textContent = '';
    const f = S.from, t = S.to;
    if (!f || !t) return renderGo();
    const raw = toRaw($('#amt').value, f.decimals);
    if (f.priceUSD && raw) $('#payUsd').textContent = usd(Number(fromRaw(raw, f.decimals, 8).replace(/,/g, '')) * f.priceUSD);
    if (!raw || raw === '0') return renderGo();
    const fromAddress = addrFor(f.chainId) || PLACEHOLDER[typeOf(f.chainId)];
    const toAddress = typeOf(f.chainId) !== typeOf(t.chainId) ? ($('#toAddr').value.trim() || addrFor(t.chainId) || PLACEHOLDER[typeOf(t.chainId)]) : fromAddress;
    S.quoting = true; renderGo();
    try {
      const { quote } = await api(`/api/swap/quote?fromChain=${f.chainId}&toChain=${t.chainId}&fromToken=${encodeURIComponent(f.address)}&toToken=${encodeURIComponent(t.address)}&fromAmount=${raw}&fromAddress=${encodeURIComponent(fromAddress)}&toAddress=${encodeURIComponent(toAddress)}&slippage=${S.slippage}`);
      if (my !== S.seq) return;
      S.quote = { ...quote, forAddress: fromAddress, raw };
      $('#recvAmt').textContent = fromRaw(quote.toAmount, t.decimals);
      $('#recvUsd').textContent = quote.toAmountUSD ? usd(quote.toAmountUSD) : '';
      const rate = Number(fromRaw(quote.toAmount, t.decimals, 10).replace(/,/g, '')) / Number(fromRaw(raw, f.decimals, 10).replace(/,/g, ''));
      const impact = quote.fromAmountUSD && quote.toAmountUSD ? (1 - Number(quote.toAmountUSD) / Number(quote.fromAmountUSD)) * 100 : null;
      const d = $('#details');
      d.innerHTML = `<div><span>Rate</span><b>1 ${esc(f.symbol)} = ${rate.toLocaleString('en-US', { maximumSignificantDigits: 6 })} ${esc(t.symbol)}</b></div>
        <div><span>Minimum received</span><b>${fromRaw(quote.toAmountMin, t.decimals)} ${esc(t.symbol)}</b></div>
        <div><span>Route</span><b>${quote.toolLogo ? `<img src="${esc(quote.toolLogo)}" alt="">` : ''}${esc(quote.toolName || quote.tool)}${quote.steps.length > 1 ? ` · ${quote.steps.length} steps` : ''}</b></div>
        <div><span>Network cost</span><b>${usd(quote.gasUSD) || 'n/a'}</b></div>
        ${quote.feeUSD ? `<div><span>Protocol fees</span><b>${usd(quote.feeUSD)}</b></div>` : ''}
        ${impact !== null ? `<div><span>Value difference</span><b class="${impact > 3 ? 'bad' : ''}">${impact > 0 ? '−' : '+'}${Math.abs(impact).toFixed(2)}%</b></div>` : ''}
        <div><span>Estimated time</span><b>${quote.duration ? (quote.duration < 90 ? Math.round(quote.duration) + ' s' : Math.round(quote.duration / 60) + ' min') : 'n/a'}</b></div>`;
      d.hidden = false;
    } catch (e) {
      if (my !== S.seq) return;
      const worth = f.priceUSD ? Number(fromRaw(raw, f.decimals, 8).replace(/,/g, '')) * f.priceUSD : null;
      const cross = f.chainId !== t.chainId;
      const small = worth !== null && worth < (cross ? 15 : 3);
      $('#swErr').textContent = e.message + (small ? ` ${usd(worth)} is probably too small for this route${cross ? ': moving between networks costs a few dollars in fees, so try $15 or more, or pick the same asset on ' + (chainOf(f.chainId) || {}).name : '; try a little more'}.` : '');
      $('#swErr').hidden = false;
    } finally { if (my === S.seq) { S.quoting = false; renderGo(); } }
  }

  function renderGo() {
    const b = $('#goBtn');
    const f = S.from, t = S.to, raw = f && toRaw($('#amt').value, f.decimals);
    let label = 'Swap', dis = false;
    if (S.busy) { label = S.busy; dis = true; }
    else if (!f || !t) { label = 'Select tokens'; dis = true; }
    else if (!raw || raw === '0') { label = 'Enter an amount'; dis = true; }
    else if (!addrFor(f.chainId)) label = typeOf(f.chainId) === 'SVM' ? 'Connect Phantom' : 'Connect wallet';
    else if (S.quoting) { label = 'Finding the best route…'; dis = true; }
    else if (!S.quote) { label = 'No route'; dis = true; }
    else if (S.bal !== null && BigInt(S.bal) < BigInt(raw)) { label = `Not enough ${f.symbol}`; dis = true; }
    else if (typeOf(f.chainId) !== typeOf(t.chainId) && !$('#toAddr').value.trim()) { label = 'Add a receiving address'; dis = true; }
    else label = `Swap ${f.symbol} for ${t.symbol}`;
    b.textContent = label; b.disabled = dis;
  }

  /* ---------- execution ---------- */
  const hex = (v) => (v === undefined || v === null ? undefined : typeof v === 'string' && v.startsWith('0x') ? v : '0x' + BigInt(v).toString(16));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitReceipt(p, hash) {
    for (let i = 0; i < 180; i++) {
      const r = await p.request({ method: 'eth_getTransactionReceipt', params: [hash] }).catch(() => null);
      if (r) { if (r.status === '0x0') throw new Error('The transaction reverted'); return r; }
      await sleep(2500);
    }
    throw new Error('Timed out waiting for confirmation');
  }
  async function ensureChain(p, chain) {
    const want = '0x' + chain.id.toString(16);
    const cur = await p.request({ method: 'eth_chainId' });
    if (cur.toLowerCase() === want) return;
    try { await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: want }] }); }
    catch (e) {
      if ((e.code === 4902 || /unrecognized|not added/i.test(e.message || '')) && chain.metamask) await p.request({ method: 'wallet_addEthereumChain', params: [chain.metamask] });
      else throw e;
    }
  }
  const pad = (h) => h.replace(/^0x/, '').toLowerCase().padStart(64, '0');
  async function ensureAllowance(p, owner, token, spender, amount) {
    const data = '0xdd62ed3e' + pad(owner) + pad(spender);
    const cur = BigInt(await p.request({ method: 'eth_call', params: [{ to: token, data }, 'latest'] }));
    if (cur >= BigInt(amount)) return;
    step('Approve ' + S.from.symbol + ' in your wallet (exact amount)…');
    const hash = await p.request({ method: 'eth_sendTransaction', params: [{ from: owner, to: token, data: '0x095ea7b3' + pad(spender) + pad(BigInt(amount).toString(16)) }] });
    step('Waiting for the approval to confirm…', hash, S.from.chainId);
    await waitReceipt(p, hash);
  }

  function step(msg, hash, chainId, done) {
    const pr = $('#progress');
    pr.hidden = false;
    const c = chainId && chainOf(chainId);
    const link = hash ? (Number(chainId) === SOL ? `https://solscan.io/tx/${hash}` : c && c.explorer ? c.explorer.replace(/\/$/, '') + '/tx/' + hash : null) : null;
    pr.className = 'sw-progress' + (done === true ? ' ok' : done === false ? ' bad' : '');
    pr.innerHTML = `<span class="${done === undefined ? 'spin' : ''}"></span><div>${esc(msg)}${link ? `<br><a href="${link}" target="_blank" rel="noopener">View transaction ↗</a>` : ''}</div>`;
  }

  async function execute() {
    const f = S.from, t = S.to, raw = toRaw($('#amt').value, f.decimals);
    const fromAddress = addrFor(f.chainId);
    const toAddress = typeOf(f.chainId) !== typeOf(t.chainId) ? $('#toAddr').value.trim() : fromAddress;
    S.busy = 'Preparing…'; renderGo(); $('#swErr').hidden = true;
    try {
      /* a fresh quote for the real address, so the transaction is built for this wallet */
      const { quote: q } = await api(`/api/swap/quote?fromChain=${f.chainId}&toChain=${t.chainId}&fromToken=${encodeURIComponent(f.address)}&toToken=${encodeURIComponent(t.address)}&fromAmount=${raw}&fromAddress=${encodeURIComponent(fromAddress)}&toAddress=${encodeURIComponent(toAddress)}&slippage=${S.slippage}`);
      let hash;
      if (typeOf(f.chainId) === 'EVM') {
        const p = S.evm.provider;
        S.busy = 'Confirm in your wallet'; renderGo();
        await ensureChain(p, chainOf(f.chainId));
        const native = /^0x0{40}$/i.test(f.address) || /^0xeeee/i.test(f.address);
        if (!native && q.approvalAddress) await ensureAllowance(p, fromAddress, f.address, q.approvalAddress, raw);
        step('Confirm the swap in your wallet…');
        const tx = q.tx;
        hash = await p.request({ method: 'eth_sendTransaction', params: [{ from: fromAddress, to: tx.to, data: tx.data, value: hex(tx.value || '0x0'), gas: hex(tx.gasLimit) }] });
      } else {
        S.busy = 'Confirm in Phantom'; renderGo();
        if (!window.solanaWeb3) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = '/vendor/solana-web3.js'; s.onload = res; s.onerror = () => rej(new Error('Could not load the Solana signer')); document.head.appendChild(s); });
        const bytes = Uint8Array.from(atob(q.tx.data), (c) => c.charCodeAt(0));
        const vtx = window.solanaWeb3.VersionedTransaction.deserialize(bytes);
        step('Confirm the swap in Phantom…');
        const r = await S.sol.provider.signAndSendTransaction(vtx);
        hash = r.signature || r;
      }
      S.busy = 'Swapping…'; renderGo();
      step(q.fromChainId === q.toChainId ? 'Swap sent. Waiting for it to settle…' : 'Sent. Bridging to the destination chain, this can take a few minutes…', hash, f.chainId);
      for (let i = 0; i < 360; i++) {
        await sleep(5000);
        let st;
        try { st = await api(`/api/swap/status?txHash=${hash}&bridge=${encodeURIComponent(q.tool)}&fromChain=${q.fromChainId}&toChain=${q.toChainId}`); } catch { continue; }
        if (st.status === 'DONE') {
          const got = st.receiving && st.receiving.amount ? fromRaw(st.receiving.amount, (st.receiving.token && st.receiving.token.decimals) || t.decimals) + ' ' + (st.receiving.token ? st.receiving.token.symbol : t.symbol) : t.symbol;
          step(st.substatus === 'PARTIAL' ? `Done, partly: you received ${got}.` : st.substatus === 'REFUNDED' ? 'The route refunded your tokens.' : `Done. You received ${got}.`, (st.receiving && st.receiving.txHash) || hash, (st.receiving && st.receiving.chainId) || t.chainId, true);
          toast('Swap complete'); break;
        }
        if (st.status === 'FAILED') { step('The swap failed: ' + (st.substatusMessage || 'see the transaction'), hash, f.chainId, false); break; }
      }
    } catch (e) {
      const msg = e.code === 4001 || /reject|denied|cancel/i.test(e.message || '') ? 'You cancelled in the wallet.' : e.message || 'Something went wrong';
      $('#swErr').textContent = msg; $('#swErr').hidden = false;
      $('#progress').hidden = true;
    } finally { S.busy = false; renderGo(); loadBalance(); }
  }

  /* ---------- wiring ---------- */
  $('#walletBtn').onclick = openWallets;
  $('#fromTok').onclick = () => openPicker('from');
  $('#toTok').onclick = () => openPicker('to');
  $('#amt').oninput = () => { S.quote = null; clearTimeout(qTimer); qTimer = setTimeout(getQuote, 450); renderGo(); };
  $('#toAddr').oninput = () => { clearTimeout(qTimer); qTimer = setTimeout(getQuote, 450); renderGo(); };
  $('#flipBtn').onclick = () => { [S.from, S.to] = [S.to, S.from]; $('#amt').value = ''; refresh(); };
  $('#maxBtn').onclick = () => {
    if (!S.bal) return;
    let raw = BigInt(S.bal);
    const native = /^0x0{40}$/i.test(S.from.address) || S.from.address === NATIVE_SOL;
    if (native) raw = raw > 0n ? raw - raw / 50n : 0n; // leave ~2% for network fees
    $('#amt').value = fromRaw(raw.toString(), S.from.decimals, 8).replace(/,/g, '');
    $('#amt').dispatchEvent(new Event('input'));
  };
  $('#slipBtn').onclick = () => { $('#slipBox').hidden = !$('#slipBox').hidden; };
  document.querySelectorAll('.sw-slip-opts button').forEach((b) => b.onclick = () => { S.slippage = Number(b.dataset.s); document.querySelectorAll('.sw-slip-opts button').forEach((x) => x.classList.toggle('on', x === b)); $('#slipCustom').value = ''; refresh(); });
  $('#slipCustom').oninput = (e) => { const v = Number(e.target.value); if (v > 0 && v <= 20) { S.slippage = v / 100; document.querySelectorAll('.sw-slip-opts button').forEach((x) => x.classList.remove('on')); refresh(); } };
  $('#goBtn').onclick = () => {
    const f = S.from;
    if (f && !addrFor(f.chainId)) return openWallets();
    if (!$('#goBtn').disabled) execute();
  };

  (async () => {
    const rwaReq = api('/api/swap/rwa').catch(() => null);
    try {
      S.chains = (await api('/api/swap/chains')).chains;
      const eth = await tokensFor(1);
      S.from = eth.find((t) => /^0x0{40}$/i.test(t.address)) || eth[0];
      S.to = eth.find((t) => t.symbol === 'USDC') || eth[1];
      const q = new URLSearchParams(location.search);
      if (q.get('to') === 'rwa') setTimeout(() => openPicker('to'), 300);
      refresh();
    } catch (e) {
      $('#swErr').textContent = 'The swap service is not reachable right now: ' + e.message; $('#swErr').hidden = false;
    }
    try {
      const r = await rwaReq; if (!r) throw new Error('rwa');
      S.rwa = r.tokens;
      drawShelf('All');
    } catch { $('#rwaList').innerHTML = '<span class="note">Real-world assets could not be loaded.</span>'; }
  })();
})();
