// Nebari — the launch form. Picks an asset, computes the start price and sends the
// one transaction that creates the token, the pool and the locked liquidity.
(function () {
  'use strict';
  const C = window.NEBARI_CONFIG;
  const E = window.ethers;
  const $ = (id) => document.getElementById(id);

  let pair = null; // { address, symbol, name, decimals, native }
  let busy = false;

  function setStatus(msg, kind) {
    const el = $('status');
    el.className = 'status' + (kind ? ' ' + kind : '');
    el.innerHTML = msg;
  }

  function firstBuyValue() {
    const v = parseFloat(String($('firstbuy').value).replace(',', '.'));
    return isFinite(v) && v > 0 ? v : 0;
  }

  function priceValue() {
    const v = parseFloat(String($('price').value).replace(',', '.'));
    return isFinite(v) && v > 0 ? v : 0;
  }

  function updateSummary() {
    const name = $('name').value.trim(), sym = $('symbol').value.trim().toUpperCase();
    $('s-token').textContent = name || sym ? `${name || '–'} (${sym || '–'})` : '–';
    $('s-pair').textContent = pair ? `${pair.symbol} · ${pair.native ? 'native' : Nebari.fmt.addr(pair.address)}` : '–';
    $('price-label').textContent = pair ? pair.symbol : 'Pair units';
    const p = priceValue();
    $('s-price').textContent = pair && p ? `${Nebari.fmt.num(p)} ${pair.symbol}` : '–';
    $('s-cap').textContent = pair && p ? `${Nebari.fmt.num(p * 1e9)} ${pair.symbol}` : '–';
    const fb = firstBuyValue();
    $('fb-label').textContent = pair ? pair.symbol : 'the pair asset';
    $('s-fb').textContent = pair && fb ? `${Nebari.fmt.num(fb)} ${pair.symbol}` : 'None';
    $('s-net').textContent = `${C.network.name} (${C.network.chainId})`;
    $('preview-name').textContent = name || 'Your bonsai';
    preview.redraw();
  }

  const preview = Bonsai.mount($('preview'), (w, h) => ({ x: w * 0.68, y: h * 0.92, height: h * 0.8, seed: ($('name').value.trim() || 'nebari') + '|' + $('symbol').value.trim(), growth: 0.6, shadow: false }));

  function selectPick(p) {
    pair = { address: p.address, symbol: p.symbol, name: p.name, decimals: p.decimals, native: p.address === Nebari.ZERO };
    document.querySelectorAll('.pick').forEach((el) => el.classList.toggle('selected', el.dataset.address.toLowerCase() === p.address.toLowerCase()));
    $('pair').value = p.address === Nebari.ZERO ? '' : p.address;
    $('pair-hint').textContent = `${p.name} (${p.symbol}), ${p.decimals} decimals${p.address === Nebari.ZERO ? ', native ETH' : ''}.`;
    updateSummary();
  }

  async function resolveCustom() {
    const addr = $('pair').value.trim();
    if (!E.isAddress(addr)) { $('pair-hint').textContent = 'That is not a valid address.'; return; }
    $('pair-hint').textContent = 'Reading the token from the chain…';
    try {
      const a = await Nebari.resolveAsset(addr);
      selectPick({ address: a.address, symbol: a.symbol, name: a.name, decimals: a.decimals });
    } catch (e) {
      pair = null; updateSummary();
      $('pair-hint').textContent = 'No ERC20 found at that address on ' + C.network.name + '.';
    }
  }

  async function renderPicks() {
    const box = $('picks');
    const draw = (list) => {
      box.innerHTML = '';
      list.forEach((p) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'pick'; b.dataset.address = p.address;
        b.appendChild(Chrome.logoEl(p));
        b.insertAdjacentHTML('beforeend', `<span><b>${p.symbol}</b><small>${p.name}</small></span>`);
        b.onclick = () => selectPick(p);
        box.appendChild(b);
      });
    };
    draw(C.quickPicks);
    const params = new URLSearchParams(location.search);
    const want = (params.get('pair') || '').toLowerCase();
    const pre = C.quickPicks.find((p) => p.address.toLowerCase() === want);
    if (pre) selectPick(pre);
    else if (want && E.isAddress(want)) { $('pair').value = want; resolveCustom(); }
    else { const eth = C.quickPicks.find((p) => p.address === Nebari.ZERO); if (eth) selectPick(eth); }  // ETH by default: every terminal can price it
    try {
      const picks = await Nebari.quickPicks();
      const ok = picks.filter((p) => p.verified);
      if (ok.length !== picks.length) { draw(ok); if (pair) { const still = ok.find((p) => p.address.toLowerCase() === pair.address.toLowerCase()); if (still) selectPick(still); } }
    } catch (_) { /* keep the configured list */ }
  }

  // Buys `amount` of the new token with the pair asset, straight after the launch.
  async function firstBuy(signer, token, amount) {
    if (!C.router) throw new Error('Router not configured');
    const me = await signer.getAddress();
    const L = await Nebari.factory(signer).getLaunch(token);
    const key = [L.key.currency0, L.key.currency1, L.key.fee, L.key.tickSpacing, L.key.hooks];
    const tokenIsZero = L.key.currency0.toLowerCase() === token.toLowerCase();
    const amountIn = E.parseUnits(String(amount), pair.decimals);
    if (!pair.native) {
      const c = Nebari.erc20(pair.address, signer);
      if ((await c.allowance(me, C.router)) < amountIn) {
        setStatus(`Launched. Approve ${pair.symbol} for the first buy in your wallet…`);
        await (await c.approve(C.router, amountIn)).wait();
      }
    }
    const r = Nebari.router(signer);
    const out = await r.quoteExactIn.staticCall(key, !tokenIsZero, amountIn);
    setStatus('Launched. Confirm the first buy in your wallet…');
    const tx = await r.swapExactIn(key, !tokenIsZero, amountIn, (out * 95n) / 100n, me, { value: pair.native ? amountIn : 0n });
    setStatus('Launched. First buy sent, waiting for confirmation…');
    await tx.wait();
    return ` First buy done: ${Nebari.fmt.units(out, 18)} tokens for ${Nebari.fmt.num(amount)} ${pair.symbol} (<a href="${Nebari.fmt.txLink(tx.hash)}" target="_blank" rel="noopener">tx</a>).`;
  }

  async function launch(ev) {
    ev.preventDefault();
    if (busy) return;
    const name = $('name').value.trim(), symbol = $('symbol').value.trim().toUpperCase();
    if (!name || !symbol) return setStatus('Give the token a name and a symbol.', 'err');
    if (!pair) return setStatus('Pick the asset to root it to.', 'err');
    const p = priceValue();
    if (!p) return setStatus('Set a start price above zero.', 'err');
    if (!Nebari.configured()) return setStatus('The factory is not deployed yet.', 'err');
    if ($('firstbuy').value.trim() && !firstBuyValue()) return setStatus('The first buy must be a number above zero, or leave it empty.', 'err');

    let startPrice;
    try { startPrice = Nebari.startPriceRaw(p, pair.decimals); } catch (e) { return setStatus(e.message, 'err'); }
    const meta = {};
    if ($('image').value.trim()) meta.image = $('image').value.trim();
    if ($('description').value.trim()) meta.description = $('description').value.trim();
    const uri = Object.keys(meta).length ? 'data:,' + encodeURIComponent(JSON.stringify(meta)) : '';

    busy = true; $('launch').disabled = true;
    try {
      setStatus('Connecting your wallet…');
      const signer = await Nebari.signer();
      const factory = Nebari.factory(signer);
      setStatus('Checking the launch with the contract…');
      await factory.launch.staticCall(name, symbol, uri, pair.address, startPrice);
      setStatus('Confirm the transaction in your wallet…');
      const tx = await factory.launch(name, symbol, uri, pair.address, startPrice);
      setStatus(`Sent. Waiting for confirmation… <a href="${Nebari.fmt.txLink(tx.hash)}" target="_blank" rel="noopener">view on explorer</a>`);
      const rc = await tx.wait();
      const ev2 = rc.logs.map((l) => { try { return factory.interface.parseLog(l); } catch { return null; } }).find((e) => e && e.name === 'Launched');
      const token = ev2 ? ev2.args.token : null;
      let bought = '';
      const fb = firstBuyValue();
      if (token && fb > 0) {
        try { bought = await firstBuy(signer, token, fb); }
        catch (e) { console.error(e); bought = ` The first buy did not go through (${Nebari.explainError(e)}); you can buy from the token page.`; }
      }
      setStatus(`Launched.${bought} ${token ? `<a href="token.html?token=${token}">Open ${symbol}</a> · ` : ''}<a href="${Nebari.fmt.txLink(tx.hash)}" target="_blank" rel="noopener">transaction</a>`, 'ok');
      Chrome.toast(`${symbol} is live on ${C.network.name}`);
      if (token) setTimeout(() => { location.href = 'token.html?token=' + token; }, 1800);
    } catch (e) {
      console.error(e);
      setStatus(Nebari.explainError(e), 'err');
    } finally {
      busy = false; $('launch').disabled = false;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!Nebari.configured()) { $('not-configured').hidden = false; $('launch').disabled = true; }
    renderPicks();
    ['name', 'symbol', 'price', 'firstbuy'].forEach((id) => $(id).addEventListener('input', updateSummary));
    $('resolve').addEventListener('click', resolveCustom);
    $('pair').addEventListener('change', resolveCustom);
    $('form').addEventListener('submit', launch);
    updateSummary();
  });
})();
