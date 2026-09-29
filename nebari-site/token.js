// Nebari — one token: its bonsai, its numbers, trading through the router and the
// holder's claim.
(function () {
  'use strict';
  const C = window.NEBARI_CONFIG;
  const E = window.ethers;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const tokenAddr = new URLSearchParams(location.search).get('token');
  let L, S, side = 'buy', tree, quoteTimer, lastQuote = null;

  function status(id, msg, kind) { const el = $(id); el.className = 'status' + (kind ? ' ' + kind : ''); el.innerHTML = msg; }
  const pairSym = () => S.pair.symbol;
  const tokenSym = () => S.symbol;

  function notFound() {
    $('not-found').hidden = false;
    document.querySelectorAll('.token-hero, .two-col').forEach((el) => { el.hidden = true; });
    return false;
  }

  async function loadToken() {
    if (!tokenAddr || !E.isAddress(tokenAddr) || !Nebari.configured()) return notFound();
    try { L = await Nebari.factory().getLaunch(tokenAddr); } catch (e) { return notFound(); }
    S = await Nebari.tokenStats(L);
    document.title = `${S.name} (${S.symbol}) — Neberi`;
    $('t-name').textContent = S.name; $('t-symbol').textContent = S.symbol;
    $('t-desc').textContent = S.meta.description || '';
    const logo = $('t-logo');
    logo.innerHTML = '';
    if (S.meta.image) { const img = document.createElement('img'); img.src = S.meta.image; img.alt = ''; img.referrerPolicy = 'no-referrer'; img.onerror = () => { logo.innerHTML = `<span class="mono">${esc(S.symbol.slice(0, 4))}</span>`; }; logo.appendChild(img); }
    else { const mini = document.createElement('canvas'); mini.width = 96; mini.height = 96; mini.style.width = '100%'; mini.style.height = '100%'; const ctx = mini.getContext('2d'); ctx.scale(2, 2); Bonsai.draw(ctx, { x: 24, y: 42, height: 36, seed: tokenAddr.toLowerCase(), growth: S.growth, shadow: false }); logo.appendChild(mini); }
    const pick = C.quickPicks.find((p) => p.address.toLowerCase() === S.pair.address.toLowerCase());
    const pairEl = $('t-pair'); pairEl.innerHTML = '';
    const pl = Chrome.logoEl(pick || S.pair); pl.style.width = '22px'; pl.style.height = '22px';
    pairEl.appendChild(pl); pairEl.insertAdjacentText('beforeend', ` ${S.pair.name} (${S.pair.symbol})`);
    $('k-price').textContent = `${Nebari.fmt.num(S.price)} ${pairSym()}`;
    $('k-cap').textContent = `${Nebari.fmt.num(S.marketCap)} ${pairSym()}`;
    $('k-vol').textContent = `${Nebari.fmt.num(S.volume)} ${pairSym()}`;
    $('k-dist').textContent = `${Nebari.fmt.units(S.totalDistributed, S.pair.decimals)} ${pairSym()}`;
    $('k-floor').textContent = `${Nebari.fmt.num(S.startPrice)} ${pairSym()}`;
    $('k-supply').textContent = `${Nebari.fmt.num(S.supply)} ${S.symbol}`;
    $('k-creator').textContent = Nebari.fmt.addr(L.creator); $('k-creator').title = L.creator;
    $('k-token').textContent = Nebari.fmt.addr(L.token); $('k-token').title = L.token;
    $('l-explorer').href = Nebari.fmt.tokenLink(L.token);
    $('l-pool').href = Nebari.fmt.addrLink(C.poolManager);
    if (!tree) tree = Bonsai.mount($('tree'), (w, h) => ({ x: w * 0.5, y: h * 0.92, height: h * 0.8, seed: tokenAddr.toLowerCase(), growth: S.growth }));
    else tree.redraw();
    return true;
  }

  async function loadUser() {
    const w = Nebari.wallet;
    if (!w.account) { $('y-bal').textContent = $('y-claim').textContent = $('y-claimed').textContent = 'connect wallet'; $('balance-hint').textContent = ''; return; }
    const t = Nebari.token(L.token);
    const [bal, claimable, acc] = await Promise.all([t.balanceOf(w.account), t.claimable(w.account), t.accumulated(w.account)]);
    $('y-bal').textContent = `${Nebari.fmt.units(bal, 18)} ${tokenSym()}`;
    $('y-claim').textContent = `${Nebari.fmt.units(claimable, S.pair.decimals)} ${pairSym()}`;
    $('y-claimed').textContent = `${Nebari.fmt.units(acc - claimable, S.pair.decimals)} ${pairSym()}`;
    const pairBal = S.pair.native ? await Nebari.provider().getBalance(w.account) : await Nebari.erc20(S.pair.address).balanceOf(w.account);
    $('balance-hint').textContent = side === 'buy'
      ? `Balance: ${Nebari.fmt.units(pairBal, S.pair.decimals)} ${pairSym()}`
      : `Balance: ${Nebari.fmt.units(bal, 18)} ${tokenSym()}`;
    $('max').dataset.max = side === 'buy' ? E.formatUnits(S.pair.native ? (pairBal > E.parseEther('0.002') ? pairBal - E.parseEther('0.002') : 0n) : pairBal, S.pair.decimals) : E.formatUnits(bal, 18);
  }

  function key() { return [L.key.currency0, L.key.currency1, L.key.fee, L.key.tickSpacing, L.key.hooks]; }
  function inDecimals() { return side === 'buy' ? S.pair.decimals : 18; }
  function outDecimals() { return side === 'buy' ? 18 : S.pair.decimals; }
  function zeroForOne() { return side === 'buy' ? !S.tokenIsZero : S.tokenIsZero; }

  async function quote() {
    lastQuote = null;
    const v = parseFloat(String($('amount').value).replace(',', '.'));
    if (!(v > 0)) { $('quote').textContent = 'Enter an amount to see a quote.'; return; }
    if (!C.router) { $('quote').textContent = 'Router not configured.'; return; }
    let amountIn;
    try { amountIn = E.parseUnits(String(v), inDecimals()); } catch (_) { $('quote').textContent = 'Too many decimals.'; return; }
    $('quote').textContent = 'Quoting…';
    try {
      const out = await Nebari.router().quoteExactIn.staticCall(key(), zeroForOne(), amountIn);
      lastQuote = { amountIn, out };
      const outSym = side === 'buy' ? tokenSym() : pairSym();
      const unit = side === 'buy' ? v / Number(E.formatUnits(out, 18)) : Number(E.formatUnits(out, S.pair.decimals)) / v;
      $('quote').textContent = `You receive about ${Nebari.fmt.units(out, outDecimals())} ${outSym} (${Nebari.fmt.num(unit)} ${pairSym()} per ${tokenSym()}).`;
    } catch (e) { $('quote').textContent = 'No quote: ' + Nebari.explainError(e); }
  }

  async function swap() {
    if (!lastQuote) return status('trade-status', 'Get a quote first.', 'err');
    const slip = Math.max(0, Math.min(50, parseFloat($('slippage').value) || 0));
    const minOut = lastQuote.out - (lastQuote.out * BigInt(Math.round(slip * 100))) / 10000n;
    $('swap').disabled = true;
    try {
      status('trade-status', 'Connecting your wallet…');
      const signer = await Nebari.signer();
      const me = await signer.getAddress();
      const inputAddr = side === 'buy' ? S.pair.address : L.token;
      const native = side === 'buy' && S.pair.native;
      if (!native) {
        const c = Nebari.erc20(inputAddr, signer);
        const allowance = await c.allowance(me, C.router);
        if (allowance < lastQuote.amountIn) {
          status('trade-status', `Approve the router to spend your ${side === 'buy' ? pairSym() : tokenSym()}…`);
          const atx = await c.approve(C.router, lastQuote.amountIn);
          await atx.wait();
        }
      }
      status('trade-status', 'Confirm the swap in your wallet…');
      const r = Nebari.router(signer);
      const tx = await r.swapExactIn(key(), zeroForOne(), lastQuote.amountIn, minOut, me, { value: native ? lastQuote.amountIn : 0n });
      status('trade-status', `Sent. <a href="${Nebari.fmt.txLink(tx.hash)}" target="_blank" rel="noopener">View on explorer</a>…`);
      await tx.wait();
      $('amount').value = ''; lastQuote = null; $('quote').textContent = 'Enter an amount to see a quote.';
      await loadToken(); await loadUser();
      status('trade-status', `Done. <a href="${Nebari.fmt.txLink(tx.hash)}" target="_blank" rel="noopener">Transaction</a>`, 'ok');
      Chrome.toast('Swap confirmed');
    } catch (e) { console.error(e); status('trade-status', Nebari.explainError(e), 'err'); }
    finally { $('swap').disabled = false; }
  }

  async function claim() {
    $('claim').disabled = true;
    try {
      status('claim-status', 'Connecting your wallet…');
      const signer = await Nebari.signer();
      const t = Nebari.token(L.token, signer);
      status('claim-status', 'Confirm in your wallet…');
      const tx = await t.claim();
      status('claim-status', `Sent. <a href="${Nebari.fmt.txLink(tx.hash)}" target="_blank" rel="noopener">View on explorer</a>…`);
      await tx.wait();
      await loadUser();
      status('claim-status', `Claimed. <a href="${Nebari.fmt.txLink(tx.hash)}" target="_blank" rel="noopener">Transaction</a>`, 'ok');
      Chrome.toast('Fees claimed');
    } catch (e) { status('claim-status', Nebari.explainError(e), 'err'); }
    finally { $('claim').disabled = false; }
  }

  async function collect() {
    $('collect').disabled = true;
    try {
      status('claim-status', 'Connecting your wallet…');
      const signer = await Nebari.signer();
      const f = Nebari.factory(signer);
      status('claim-status', 'Confirm in your wallet…');
      const tx = await f.collectFees(L.token);
      status('claim-status', `Sent. <a href="${Nebari.fmt.txLink(tx.hash)}" target="_blank" rel="noopener">View on explorer</a>…`);
      const rc = await tx.wait();
      const ev = rc.logs.map((l) => { try { return f.interface.parseLog(l); } catch { return null; } }).find((e) => e && e.name === 'FeesCollected');
      const got = ev ? Nebari.fmt.units(ev.args.pairAmount, S.pair.decimals) : '?';
      await loadToken(); await loadUser();
      status('claim-status', `Collected ${got} ${pairSym()} of fees. Half is now claimable by holders. <a href="${Nebari.fmt.txLink(tx.hash)}" target="_blank" rel="noopener">Transaction</a>`, 'ok');
    } catch (e) { status('claim-status', Nebari.explainError(e), 'err'); }
    finally { $('collect').disabled = false; }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (!(await loadToken())) return;
    Nebari.onWallet(() => loadUser().catch(console.warn));
    loadUser().catch(console.warn);
    document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => {
      side = b.dataset.side;
      document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === b));
      $('amount-label').textContent = side === 'buy' ? `You pay (${pairSym()})` : `You sell (${tokenSym()})`;
      $('swap').textContent = side === 'buy' ? 'Buy' : 'Sell';
      $('amount').value = ''; lastQuote = null; $('quote').textContent = 'Enter an amount to see a quote.';
      loadUser().catch(console.warn);
    }));
    $('amount-label').textContent = `You pay (${pairSym()})`;
    $('amount').addEventListener('input', () => { clearTimeout(quoteTimer); quoteTimer = setTimeout(quote, 350); });
    $('max').addEventListener('click', () => { if ($('max').dataset.max) { $('amount').value = $('max').dataset.max; quote(); } });
    $('swap').addEventListener('click', swap);
    $('claim').addEventListener('click', claim);
    $('collect').addEventListener('click', collect);
    if (!C.router) status('trade-status', 'The router is not configured yet, trading is off.', 'warn');
  });
})();
