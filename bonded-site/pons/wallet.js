/* Wallet discovery for LilyPad: MetaMask, Phantom, Rabby, Coinbase Wallet… anything that
   announces itself through EIP-6963, plus the legacy window.ethereum / window.phantom
   injections. With one wallet it is used directly; with several, a small chooser appears and
   the pick is remembered. Exposes window.bdWallet = { list, current, pick, provider, reset }. */
(function () {
  const KEY = 'bonded-wallet';
  const announced = new Map();
  window.addEventListener('eip6963:announceProvider', e => {
    const d = e.detail; if (!d || !d.provider) return;
    announced.set((d.info && (d.info.rdns || d.info.uuid)) || String(announced.size), d);
  });
  try { window.dispatchEvent(new Event('eip6963:requestProvider')); } catch (_) {}

  const nameOf = p => p.isPhantom ? 'Phantom' : p.isRabby ? 'Rabby' : p.isCoinbaseWallet ? 'Coinbase Wallet' : p.isBraveWallet ? 'Brave Wallet' : p.isMetaMask ? 'MetaMask' : 'Browser wallet';
  function list() {
    const out = []; const seen = new Set();
    const add = (provider, name, icon, rdns) => { if (!provider || !provider.request || seen.has(provider)) return; seen.add(provider); out.push({ provider, name, icon: icon || '', rdns: rdns || name.toLowerCase().replace(/\s+/g, '-') }); };
    for (const d of announced.values()) add(d.provider, (d.info && d.info.name) || nameOf(d.provider), d.info && d.info.icon, d.info && d.info.rdns);
    if (window.phantom && window.phantom.ethereum) add(window.phantom.ethereum, 'Phantom', '', 'app.phantom');
    const eth = window.ethereum;
    if (eth && Array.isArray(eth.providers)) eth.providers.forEach(p => add(p, nameOf(p)));
    if (eth) add(eth, nameOf(eth));
    return out;
  }

  let chosen = null;
  function current() {
    if (chosen && list().some(o => o.provider === chosen.provider)) return chosen;
    const l = list();
    try { const pref = localStorage.getItem(KEY); const m = l.find(o => o.rdns === pref); if (m) return (chosen = m); } catch (_) {}
    return l.length === 1 ? (chosen = l[0]) : null;
  }

  function pick() {
    return new Promise((resolve, reject) => {
      const l = list();
      if (!l.length) return reject(new Error('No wallet found. Install MetaMask, Phantom or Rabby and reload.'));
      const c = current(); if (c) return resolve(c);
      const wrap = document.createElement('div'); wrap.className = 'bd-wallets';
      wrap.innerHTML = `<div class="bd-wallets-card" role="dialog" aria-label="Choose a wallet"><h3>Choose a wallet</h3>` +
        l.map((o, i) => `<button type="button" data-i="${i}">${o.icon ? `<img src="${o.icon}" alt="">` : '<i></i>'}<span>${o.name.replace(/[<>&]/g, '')}</span></button>`).join('') +
        `<a class="bd-wallets-x">Cancel</a></div>`;
      document.body.appendChild(wrap);
      wrap.addEventListener('click', e => {
        const b = e.target.closest('[data-i]');
        if (b) { chosen = l[+b.dataset.i]; try { localStorage.setItem(KEY, chosen.rdns); } catch (_) {} wrap.remove(); resolve(chosen); }
        else if (e.target.closest('.bd-wallets-x') || e.target === wrap) { wrap.remove(); reject(new Error('No wallet chosen')); }
      });
    });
  }

  window.bdWallet = {
    list, current, pick,
    provider: () => { const c = current(); return c ? c.provider : null; },
    reset: () => { chosen = null; try { localStorage.removeItem(KEY); } catch (_) {} },
  };
})();
