/* Yuelong — wallet and chain helpers shared by every page (window.YL).
   Finds browser wallets through EIP-6963 (MetaMask, Rabby, Coinbase, OKX…) with window.ethereum
   as the fallback, connects, switches or adds the network, and hands out an ethers signer.
   ethers and the ABIs load only when a page needs them. Reads go to the chain's public RPC. */

(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- API and lazy libraries ---------- */

  const api = async (path, opts) => {
    const r = await fetch(path, opts);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
    return j;
  };
  let cfgP;
  const config = () => (cfgP ||= api('/api/config').catch(() => ({ live: false, networks: [], known: [] })));
  let ethersP;
  const ethers = () => (ethersP ||= new Promise((resolve, reject) => {
    if (window.ethers) return resolve(window.ethers);
    const s = document.createElement('script');
    s.src = 'assets/vendor/ethers-6.13.4.umd.min.js';
    s.onload = () => resolve(window.ethers);
    s.onerror = () => reject(new Error('Could not load ethers'));
    document.head.appendChild(s);
  }));
  let abiP;
  const abi = () => (abiP ||= api('assets/chain/abi.json'));
  const readers = {};
  const reader = async (net) => {
    const e = await ethers();
    return (readers[net.chainId] ||= new e.JsonRpcProvider(net.rpc, net.chainId, { staticNetwork: true }));
  };

  /* ---------- formatting ---------- */

  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  const toNum = (wei, dec = 18) => {
    const b = BigInt(wei || 0), neg = b < 0n, a = neg ? -b : b;
    const base = 10n ** BigInt(dec);
    const n = Number(a / base) + Number(a % base) / Number(base);
    return neg ? -n : n;
  };
  /* tiny prices the way traders read them: 0.0₆412 means 0.000000412 */
  const fmtPrice = (v) => {
    if (!v || !isFinite(v)) return '0';
    if (v >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (v >= 1) return v.toLocaleString('en-US', { maximumFractionDigits: 4 });
    const z = Math.floor(-Math.log10(v));
    if (z < 4) return v.toPrecision(3).replace(/0+$/, '');
    const digits = Math.round(v * 10 ** (z + 3)).toString().slice(0, 3).replace(/0+$/, '');
    return '0.0' + String(z).split('').map((d) => SUB[d]).join('') + digits;
  };
  const fmtAmt = (v, max = 4) => {
    if (!v || !isFinite(v)) return '0';
    const a = Math.abs(v);
    if (a >= 1e9) return (v / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return (v / 1e6).toFixed(2) + 'M';
    if (a >= 1e4) return (v / 1e3).toFixed(1) + 'K';
    if (a >= 1) return v.toLocaleString('en-US', { maximumFractionDigits: Math.min(max, 2) });
    return fmtPrice(v);
  };
  const fmtUsd = (v) => {
    if (v == null || !isFinite(v)) return '';
    if (v >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
    if (v >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'K';
    if (v >= 1) return '$' + v.toFixed(2);
    return '$' + fmtPrice(v);
  };
  const short = (a) => (a ? a.slice(0, 6) + '…' + a.slice(-4) : '');
  const ago = (t) => {
    const s = Math.max(0, Math.floor(Date.now() / 1000 - t));
    if (s < 60) return s + 's';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    if (s < 86400) return Math.floor(s / 3600) + 'h';
    return Math.floor(s / 86400) + 'd';
  };
  const explorer = (net, kind, v) => (net && net.explorer ? `${net.explorer.replace(/\/$/, '')}/${kind}/${v}` : '');
  const cleanError = (e) => {
    const m = e?.info?.error?.message || e?.shortMessage || e?.reason || e?.message || String(e);
    if (/user (rejected|denied)|ACTION_REJECTED|4001/i.test(m + (e?.code || ''))) return 'You cancelled it in your wallet.';
    if (/insufficient funds/i.test(m)) return 'Not enough balance to pay for this and its gas.';
    if (/Slippage/i.test(m)) return 'The price moved past your slippage limit. Try again or raise the slippage.';
    return m.replace(/\(action=.*$/s, '').slice(0, 180);
  };

  /* ---------- toasts ---------- */

  let toastBox;
  const toast = (html, kind = '', ms = 6000) => {
    if (!toastBox) { toastBox = document.createElement('div'); toastBox.className = 'yl-toasts'; toastBox.setAttribute('aria-live', 'polite'); document.body.appendChild(toastBox); }
    const t = document.createElement('div');
    t.className = 'yl-toast ' + kind;
    t.innerHTML = html;
    toastBox.appendChild(t);
    requestAnimationFrame(() => t.classList.add('is-in'));
    const close = () => { t.classList.remove('is-in'); setTimeout(() => t.remove(), 300); };
    if (ms) setTimeout(close, ms);
    return { el: t, close, set: (h, k) => { t.innerHTML = h; if (k !== undefined) t.className = 'yl-toast is-in ' + k; } };
  };

  /* ---------- wallets ---------- */

  const WALLET_KEY = 'yuelong-wallet';
  const found = [];
  window.addEventListener('eip6963:announceProvider', (e) => {
    const d = e.detail;
    if (d?.info?.uuid && d.provider && !found.some((p) => p.info.uuid === d.info.uuid)) found.push(d);
  });
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  const allWallets = () => {
    const list = [...found];
    if (!list.length && window.ethereum) list.push({ info: { uuid: 'injected', name: window.ethereum.isRabby ? 'Rabby' : window.ethereum.isMetaMask ? 'MetaMask' : 'Browser wallet', icon: '', rdns: 'injected' }, provider: window.ethereum });
    return list;
  };

  const state = { account: null, chainId: null, provider: null, info: null };
  const subs = new Set();
  const emit = () => { subs.forEach((fn) => { try { fn(state); } catch (_) { /* a page's handler */ } }); renderButtons(); };
  const onChange = (fn) => { subs.add(fn); return () => subs.delete(fn); };

  const attach = (w) => {
    if (state.provider === w.provider) return;
    state.provider = w.provider; state.info = w.info;
    w.provider.on?.('accountsChanged', (acc) => { state.account = acc && acc[0] ? acc[0] : null; if (!state.account) forget(); emit(); });
    w.provider.on?.('chainChanged', (id) => { state.chainId = Number(id); emit(); });
  };
  const forget = () => { try { localStorage.removeItem(WALLET_KEY); } catch (_) { /* storage blocked */ } };

  const connectWith = async (w) => {
    attach(w);
    const acc = await w.provider.request({ method: 'eth_requestAccounts' });
    state.account = acc[0] || null;
    state.chainId = Number(await w.provider.request({ method: 'eth_chainId' }));
    try { localStorage.setItem(WALLET_KEY, w.info.rdns || w.info.name); } catch (_) { /* storage blocked */ }
    emit();
    return state.account;
  };

  /* reconnect silently to the wallet used last time, if it still grants access */
  const restore = async () => {
    let want = null;
    try { want = localStorage.getItem(WALLET_KEY); } catch (_) { /* storage blocked */ }
    if (!want) return;
    await new Promise((r) => setTimeout(r, 250));
    const w = allWallets().find((x) => (x.info.rdns || x.info.name) === want) || allWallets()[0];
    if (!w) return;
    try {
      const acc = await w.provider.request({ method: 'eth_accounts' });
      if (!acc || !acc[0]) return;
      attach(w);
      state.account = acc[0];
      state.chainId = Number(await w.provider.request({ method: 'eth_chainId' }));
      emit();
    } catch (_) { /* wallet locked */ }
  };

  let picker;
  const closePicker = () => { if (picker) { picker.classList.remove('is-in'); const p = picker; picker = null; setTimeout(() => p.remove(), 250); } };
  /* one wallet connects straight away; several get a short list; none gets install links */
  const connect = () => new Promise((resolve, reject) => {
    const list = allWallets();
    if (list.length === 1) return connectWith(list[0]).then(resolve, reject);
    closePicker();
    picker = document.createElement('div');
    picker.className = 'yl-modal';
    picker.innerHTML = `<div class="yl-modal-card" role="dialog" aria-modal="true" aria-label="Connect a wallet">
      <button class="yl-x" type="button" aria-label="Close">×</button>
      <h3>Connect a wallet</h3>
      ${list.length ? `<div class="yl-wallets">${list.map((w, i) => `<button type="button" data-i="${i}">${w.info.icon ? `<img src="${esc(w.info.icon)}" alt="">` : '<span class="yl-wdot"></span>'}<b>${esc(w.info.name)}</b></button>`).join('')}</div>`
        : `<p>No browser wallet found. Install one, then reload this page:</p>
           <div class="yl-wallets"><a href="https://metamask.io/download/" target="_blank" rel="noopener"><img src="assets/logos/metamask.svg" alt=""><b>MetaMask</b></a><a href="https://rabby.io/" target="_blank" rel="noopener"><img src="assets/logos/rabby.svg" alt=""><b>Rabby</b></a></div>`}
      <p class="yl-fine">Yuelong never sees your keys. Every action is a transaction you approve in your wallet.</p>
    </div>`;
    document.body.appendChild(picker);
    requestAnimationFrame(() => picker?.classList.add('is-in'));
    picker.addEventListener('click', async (e) => {
      if (e.target === picker || e.target.closest('.yl-x')) { closePicker(); reject(new Error('closed')); return; }
      const b = e.target.closest('button[data-i]');
      if (!b) return;
      closePicker();
      connectWith(list[+b.dataset.i]).then(resolve, reject);
    });
  });

  const disconnect = () => {
    state.account = null;
    forget();
    state.provider?.request?.({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] }).catch(() => {});
    emit();
  };

  /* ask the wallet for the right network, adding it first if it has never seen it */
  const ensureChain = async (net) => {
    if (!state.provider) await connect();
    if (state.chainId === net.chainId) return;
    const hex = '0x' + net.chainId.toString(16);
    try {
      await state.provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
    } catch (e) {
      if (e.code !== 4902 && !/unrecognized|not added|unknown chain/i.test(e.message || '')) throw e;
      await state.provider.request({ method: 'wallet_addEthereumChain', params: [{
        chainId: hex, chainName: net.name, rpcUrls: [net.rpc],
        nativeCurrency: { name: net.native, symbol: net.native, decimals: 18 },
        ...(net.explorer ? { blockExplorerUrls: [net.explorer] } : {}),
      }] });
    }
    state.chainId = Number(await state.provider.request({ method: 'eth_chainId' }));
    emit();
    if (state.chainId !== net.chainId) throw new Error(`Switch your wallet to ${net.name} to continue.`);
  };

  const signer = async (net) => {
    if (!state.account) await connect();
    if (net) await ensureChain(net);
    const e = await ethers();
    return new e.BrowserProvider(state.provider, 'any').getSigner(state.account);
  };

  /* ---------- the nav button ---------- */

  let menu;
  const closeMenu = () => { menu?.remove(); menu = null; };
  function renderButtons() {
    $$('.dn-nav [data-wallet]').forEach((b) => {
      b.textContent = state.account ? short(state.account) : 'Connect wallet';
      b.classList.toggle('is-on', !!state.account);
    });
    document.body.classList.toggle('is-connected', !!state.account);
  }
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-wallet]');
    if (menu && !e.target.closest('.yl-menu')) closeMenu();
    if (!btn) return;
    e.preventDefault();
    if (!state.account) { connect().catch((err) => { if (err.message !== 'closed') toast(esc(cleanError(err)), 'is-bad'); }); return; }
    if (!btn.closest('.dn-nav')) return;
    menu = document.createElement('div');
    menu.className = 'yl-menu';
    menu.innerHTML = `<div class="yl-menu-addr">${state.info?.icon ? `<img src="${esc(state.info.icon)}" alt="">` : ''}<span>${esc(short(state.account))}</span></div>
      <a href="portfolio.html">Portfolio</a>
      <button type="button" data-copy>Copy address</button>
      <button type="button" data-out>Disconnect</button>`;
    const r = btn.getBoundingClientRect();
    menu.style.top = r.bottom + 8 + 'px';
    menu.style.right = Math.max(12, innerWidth - r.right) + 'px';
    document.body.appendChild(menu);
    menu.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-copy]')) { navigator.clipboard?.writeText(state.account); toast('Address copied'); }
      if (ev.target.closest('[data-out]')) disconnect();
      closeMenu();
    });
  });
  addEventListener('scroll', closeMenu, { passive: true });

  window.YL = {
    $, $$, esc, api, config, ethers, abi, reader,
    toNum, fmtPrice, fmtAmt, fmtUsd, short, ago, explorer, cleanError, toast,
    wallet: { state, connect, disconnect, ensureChain, signer, onChange },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { renderButtons(); restore(); });
  else { renderButtons(); restore(); }
})();
