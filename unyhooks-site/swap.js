/* UnyHooks — buy and sell a token from its public page.

   Swaps go through Uniswap's Universal Router on Robinhood Chain, in the
   token's own V4 pool (ETH paired with the token), so the pool's hook runs on
   every trade exactly as it would from any other app: a launch cap or a
   cooldown refuses the swap here too, and the reason is shown in plain words.

   The price is read first from Uniswap's Quoter. The trade then asks for at
   least that amount less the chosen slippage, and is dry-run before the wallet
   is asked to sign. Selling a token goes through Permit2, as Uniswap's own app
   does: one approval for Permit2, then a Permit2 allowance for the router.

   UnySwap.mount(element, { key, token }) draws the panel; key is the pool key
   (currency0 must be native ETH), token is { address, symbol, decimals }. */

(() => {
  'use strict';

  const C = window.UnyChain;
  const { NET, esc } = C;

  const ROUTER_ABI = [
    'function execute(bytes commands, bytes[] inputs, uint256 deadline) payable',
    'error ExecutionFailed(uint256 commandIndex, bytes message)',
    'error TransactionDeadlinePassed()',
    'error V4TooLittleReceived(uint256 minAmountOutReceived, uint256 amountReceived)',
    'error V4TooMuchRequested(uint256 maxAmountInRequested, uint256 amountRequested)'
  ];
  const QUOTER_ABI = [
    'function quoteExactInputSingle(tuple(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, bool zeroForOne, uint128 exactAmount, bytes hookData) params) returns (uint256 amountOut, uint256 gasEstimate)',
    'error UnexpectedRevertBytes(bytes revertData)',
    'error NotEnoughLiquidity(bytes32 poolId)'
  ];
  // The errors the UnyHooks hooks can raise, so a refusal can be explained.
  const HOOK_ABI = [
    'error WrappedError(address target, bytes4 selector, bytes reason, bytes details)',
    'error BuyTooLarge(uint256 amount, uint256 max)',
    'error CooldownActive(uint256 readyAt)',
    'error ExactOutputBuyDuringLaunch()',
    'error MarketClosed()'
  ];
  const IFACES = [ROUTER_ABI, QUOTER_ABI, HOOK_ABI].map((a) => new ethers.Interface(a));

  const V4_SWAP = '0x10';
  const SWAP_EXACT_IN_SINGLE = 0x06;
  const SETTLE_ALL = 0x0c;
  const TAKE_ALL = 0x0f;
  const MAX_UINT160 = (1n << 160n) - 1n;

  const fmt = (v, decimals, digits = 6) => {
    const n = Number(ethers.formatUnits(v, decimals));
    if (n === 0) return '0';
    return n >= 1 ? Number(n.toPrecision(digits)).toLocaleString('en-US', { maximumFractionDigits: 6 }) : C.price(n);
  };

  // Follow the revert data down through the router's and the PoolManager's
  // wrappers to the reason that matters, and put it in plain words.
  const reasonOf = (data, symbol) => {
    for (let depth = 0; depth < 5 && typeof data === 'string' && data.length >= 10; depth++) {
      let e = null;
      for (const i of IFACES) { try { e = i.parseError(data); } catch (_) { e = null; } if (e) break; }
      if (!e) return null;
      if (e.name === 'ExecutionFailed') { data = e.args.message; continue; }
      if (e.name === 'UnexpectedRevertBytes') { data = e.args.revertData; continue; }
      if (e.name === 'WrappedError') { data = e.args.reason; continue; }
      if (e.name === 'BuyTooLarge') return `During the launch window each buy is capped at ${fmt(e.args.max, 18)} ETH. Buy less, or wait for the window to end.`;
      if (e.name === 'CooldownActive') {
        const wait = Math.max(1, Math.ceil(Number(e.args.readyAt) - C.chainNowSync()));
        return `During the launch window each wallet waits between buys. Yours can buy again in about ${wait} s.`;
      }
      if (e.name === 'ExactOutputBuyDuringLaunch') return 'During the launch window, buys must name the ETH they spend.';
      if (e.name === 'MarketClosed') return 'This pool only trades during its hours.';
      if (e.name === 'V4TooLittleReceived') return `The price moved: you would get less ${symbol} than your slippage allows. Try again, or allow more slippage.`;
      if (e.name === 'TransactionDeadlinePassed') return 'The transaction waited too long in the wallet. Try again.';
      if (e.name === 'NotEnoughLiquidity') return 'The pool does not have enough liquidity for this amount.';
      return `Refused: ${e.name}.`;
    }
    return null;
  };
  const explain = (err, symbol) => {
    const data = err && (err.data || (err.info && err.info.error && err.info.error.data) || (err.error && err.error.data));
    return reasonOf(data, symbol) || C.explain(err);
  };

  const mount = (root, { key, token }) => {
    if (!root || BigInt(key.currency0) !== 0n || BigInt(key.currency1) !== BigInt(token.address)) return false;
    const sym = token.symbol;
    const coder = ethers.AbiCoder.defaultAbiCoder();
    const poolKey = [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks];
    let mode = 'buy';
    let slip = 1;
    let quote = null; // { amountIn, amountOut }
    let quoteSeq = 0;

    root.innerHTML = `
      <div class="sw-head">
        <h2>Trade $${esc(sym)}</h2>
        <div class="sw-tabs" role="tablist">
          <button type="button" role="tab" data-mode="buy" aria-selected="true">Buy</button>
          <button type="button" role="tab" data-mode="sell" aria-selected="false">Sell</button>
        </div>
      </div>
      <label class="sw-field">
        <span class="sw-label" data-el="pay-label">You pay</span>
        <span class="bd-input"><input data-el="amount" inputmode="decimal" autocomplete="off" placeholder="0.0"><span class="bd-unit" data-el="pay-unit">ETH</span></span>
      </label>
      <div class="sw-bal"><span data-el="bal"></span><button type="button" class="sw-max" data-el="max" hidden>Max</button></div>
      <div class="sw-out">
        <span class="sw-label">You get about</span>
        <b data-el="out">—</b>
        <small data-el="min"></small>
      </div>
      <div class="sw-slip">
        <span class="sw-label">Slippage</span>
        ${[0.5, 1, 3].map((v) => `<button type="button" data-slip="${v}" aria-pressed="${v === slip}">${v}%</button>`).join('')}
      </div>
      <div class="dp-wallets" data-el="wallets" hidden></div>
      <button type="button" class="uh-btn uh-btn-pink sw-go" data-el="go">Connect wallet</button>
      <p class="sw-msg" data-el="msg" aria-live="polite"></p>
      <p class="sw-fine">Trades go through Uniswap's router in this token's pool, so its hook applies to every trade. Nothing is signed until you confirm in your wallet.</p>`;
    const el = (n) => root.querySelector(`[data-el="${n}"]`);
    const say = (html, kind = '') => { el('msg').innerHTML = html; el('msg').className = `sw-msg${kind ? ` is-${kind}` : ''}`; };

    const decimalsIn = () => (mode === 'buy' ? 18 : token.decimals);
    const decimalsOut = () => (mode === 'buy' ? token.decimals : 18);
    const symIn = () => (mode === 'buy' ? 'ETH' : sym);
    const symOut = () => (mode === 'buy' ? sym : 'ETH');
    const parsedAmount = () => {
      const v = el('amount').value.trim().replace(',', '.');
      if (!/^\d*\.?\d+$/.test(v) && !/^\d+\.$/.test(v)) return null;
      try { const a = ethers.parseUnits(v.replace(/\.$/, ''), decimalsIn()); return a > 0n ? a : null; } catch (_) { return null; }
    };
    const minOut = (out) => (out * BigInt(Math.round((100 - slip) * 100))) / 10000n;

    const balanceIn = async () => {
      if (!C.session.address) return null;
      return mode === 'buy'
        ? C.reader().getBalance(C.session.address)
        : new ethers.Contract(token.address, C.ABI.ERC20, C.reader()).balanceOf(C.session.address);
    };
    const showBalance = async () => {
      const b = await balanceIn().catch(() => null);
      el('bal').textContent = b === null ? '' : `Balance: ${fmt(b, decimalsIn())} ${symIn()}`;
      el('max').hidden = b === null || b === 0n;
      el('max').dataset.v = b === null ? '' : b.toString();
    };
    const label = () => {
      el('go').textContent = !C.session.signer ? 'Connect wallet' : mode === 'buy' ? `Buy $${sym}` : `Sell $${sym}`;
    };

    const reQuote = async () => {
      const seq = ++quoteSeq;
      quote = null;
      el('min').textContent = '';
      const amount = parsedAmount();
      if (!amount) { el('out').textContent = '—'; return; }
      el('out').textContent = '…';
      try {
        const q = new ethers.Contract(NET.quoter, QUOTER_ABI, C.reader());
        const [out] = await q.quoteExactInputSingle.staticCall(
          { poolKey, zeroForOne: mode === 'buy', exactAmount: amount, hookData: '0x' },
          C.session.address ? { from: C.session.address } : {}
        );
        if (seq !== quoteSeq) return;
        quote = { amountIn: amount, amountOut: out };
        el('out').textContent = `${fmt(out, decimalsOut())} ${symOut()}`;
        el('min').textContent = `At least ${fmt(minOut(out), decimalsOut())} ${symOut()} with ${slip}% slippage`;
        say('');
      } catch (err) {
        if (seq !== quoteSeq) return;
        el('out').textContent = '—';
        say(esc(explain(err, sym)), 'error');
      }
    };
    let timer = 0;
    el('amount').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(reQuote, 300); });
    el('max').addEventListener('click', () => {
      let v = BigInt(el('max').dataset.v || '0');
      if (mode === 'buy') v = v > ethers.parseEther('0.002') ? v - ethers.parseEther('0.002') : 0n; // keep some ETH for gas
      el('amount').value = ethers.formatUnits(v, decimalsIn());
      reQuote();
    });
    root.querySelector('.sw-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-mode]');
      if (!b || b.dataset.mode === mode) return;
      mode = b.dataset.mode;
      root.querySelectorAll('.sw-tabs button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      el('pay-unit').textContent = symIn();
      el('amount').value = '';
      el('out').textContent = '—';
      el('min').textContent = '';
      say('');
      label();
      showBalance();
    });
    root.querySelector('.sw-slip').addEventListener('click', (e) => {
      const b = e.target.closest('[data-slip]');
      if (!b) return;
      slip = Number(b.dataset.slip);
      root.querySelectorAll('[data-slip]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      if (quote) el('min').textContent = `At least ${fmt(minOut(quote.amountOut), decimalsOut())} ${symOut()} with ${slip}% slippage`;
    });

    // Selling: let Permit2 move the token, then let the router use Permit2.
    const approveForSale = async (amount) => {
      const owner = C.session.address;
      const erc20 = new ethers.Contract(token.address, C.ABI.ERC20, C.session.signer);
      if ((await erc20.allowance(owner, NET.permit2)) < amount) {
        say(`Approve $${esc(sym)} for Uniswap's Permit2 in your wallet…`);
        await (await erc20.approve(NET.permit2, ethers.MaxUint256)).wait();
      }
      const p2 = new ethers.Contract(NET.permit2, C.ABI.PERMIT2, C.session.signer);
      const now = await C.chainNow();
      const al = await p2.allowance(owner, token.address, NET.universalRouter);
      if (al.amount < amount || Number(al.expiration) < now + 600) {
        say(`Let Uniswap's router use your $${esc(sym)} (Permit2, valid 30 days)…`);
        await (await p2.approve(token.address, NET.universalRouter, MAX_UINT160, now + 30 * 86400)).wait();
      }
    };

    let busy = false;
    el('go').addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      el('go').disabled = true;
      try {
        if (!C.session.signer) {
          await C.connectUI(el('wallets'), say);
          label();
          await showBalance();
          await reQuote();
          return;
        }
        const amount = parsedAmount();
        if (!amount) { say(`Enter how much ${symIn()} to ${mode === 'buy' ? 'spend' : 'sell'}.`, 'error'); return; }
        const bal = await balanceIn();
        if (bal !== null && bal < amount) { say(`You have ${fmt(bal, decimalsIn())} ${symIn()}, less than that.`, 'error'); return; }
        if (!quote || quote.amountIn !== amount) await reQuote();
        if (!quote) return;
        const out = quote.amountOut;
        const buying = mode === 'buy';
        const [cIn, cOut] = buying ? [key.currency0, key.currency1] : [key.currency1, key.currency0];
        const actions = ethers.hexlify(new Uint8Array([SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL]));
        const params = [
          coder.encode(['tuple(tuple(address,address,uint24,int24,address),bool,uint128,uint128,bytes)'], [[poolKey, buying, amount, minOut(out), '0x']]),
          coder.encode(['address', 'uint256'], [cIn, amount]),
          coder.encode(['address', 'uint256'], [cOut, minOut(out)])
        ];
        const input = coder.encode(['bytes', 'bytes[]'], [actions, params]);
        if (!buying) await approveForSale(amount);
        const router = new ethers.Contract(NET.universalRouter, ROUTER_ABI, C.session.signer);
        const deadline = (await C.chainNow()) + 20 * 60;
        const overrides = buying ? { value: amount } : {};
        say('Checking the trade…');
        await router.execute.staticCall(V4_SWAP, [input], deadline, overrides);
        say(`Confirm the ${buying ? 'buy' : 'sale'} in your wallet…`);
        const tx = await router.execute(V4_SWAP, [input], deadline, overrides);
        say(`Sent. Waiting for ${esc(NET.name)}… ${C.link('tx', tx.hash, 'view')}`);
        await tx.wait();
        say(`Done: ${buying ? 'bought' : 'sold'} about ${esc(fmt(buying ? out : amount, token.decimals))} $${esc(sym)}. ${C.link('tx', tx.hash, 'View the transaction')}`, 'ok');
        el('amount').value = '';
        el('out').textContent = '—';
        el('min').textContent = '';
        quote = null;
        await showBalance();
        document.dispatchEvent(new CustomEvent('unyhooks:traded'));
      } catch (err) {
        if (err && err.handled) return;
        if (C.isRejection(err)) { say('Cancelled in the wallet. Nothing was sent.'); return; }
        say(esc(explain(err, sym)), 'error');
      } finally {
        busy = false;
        el('go').disabled = false;
      }
    });

    document.addEventListener('unyhooks:wallet', () => { label(); showBalance(); });
    label();
    showBalance();
    return true;
  };

  window.UnySwap = { mount };
})();
