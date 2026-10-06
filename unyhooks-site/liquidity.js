/* UnyHooks — adding liquidity to a pool, from the page.

   UnyLiquidity.mount(container, { hook, pool, abi, onDone }) draws the form:
   current price, full or custom range, the two amounts (type one, the other
   follows the pool's price), then up to three kinds of signature:
     1. let Permit2 move each ERC-20 (once per token, ever)
     2. let Uniswap's PositionManager use it through Permit2 (30 days)
     3. mint the position: MINT_POSITION + SETTLE_PAIR (+ SWEEP to return
        unused ETH), checked with a dry run first.
   The position is an NFT from Uniswap's PositionManager, the same one the
   Uniswap app shows. Needs chain.js and pool-math.js. */

(() => {
  'use strict';

  const C = window.UnyChain;
  const M = window.UnyPoolMath;
  const { ethers } = window;
  if (!C || !M || !ethers) return;

  const { NET, esc } = C;
  const coder = ethers.AbiCoder.defaultAbiCoder();
  const MAX_UINT160 = (1n << 160n) - 1n;
  const ACTIONS = { MINT_POSITION: 0x02, SETTLE_PAIR: 0x0d, SWEEP: 0x14 };
  const GAS_RESERVE = 5n * 10n ** 14n; // 0.0005 ETH kept back when "Max" is ETH

  const fmt = (raw, t) => M.fromUnits(raw, t.decimals, 6);
  const num = (v) => (v >= 1e6 || (v > 0 && v < 1e-6) ? v.toPrecision(4) : String(Number(v.toPrecision(6))));

  const mount = (root, { hook, pool, abi, onDone = () => {} }) => {
    const key = pool.key;
    const A = pool.a;
    const B = pool.b;
    const aIs0 = BigInt(A.address) < BigInt(B.address);
    const t0 = aIs0 ? A : B;
    const t1 = aIs0 ? B : A;
    const uid = `lq-${pool.id.slice(2, 10)}`;

    root.innerHTML = `
      <form class="lq" id="${uid}" autocomplete="off">
        <div class="lq-head">
          <b>${esc(A.symbol)}/${esc(B.symbol)}</b>
          <span class="lq-price" data-el="price">Reading the pool…</span>
        </div>
        <div class="lq-range" role="radiogroup" aria-label="Price range">
          <label><input type="radio" name="${uid}-range" value="full" checked> Full range</label>
          <label><input type="radio" name="${uid}-range" value="custom"> Custom range</label>
        </div>
        <div class="lq-custom" data-el="custom" hidden>
          <div class="bd-field"><label for="${uid}-min">Lowest price</label><div class="bd-input"><input id="${uid}-min" inputmode="decimal" data-el="min"><span class="bd-unit">${esc(B.symbol)} per ${esc(A.symbol)}</span></div></div>
          <div class="bd-field"><label for="${uid}-max">Highest price</label><div class="bd-input"><input id="${uid}-max" inputmode="decimal" data-el="max"><span class="bd-unit">${esc(B.symbol)} per ${esc(A.symbol)}</span></div></div>
        </div>
        <div class="lq-amounts">
          <div class="bd-field" data-side="a">
            <label for="${uid}-a">${esc(A.symbol)}</label>
            <div class="bd-input"><input id="${uid}-a" inputmode="decimal" placeholder="0.0" data-el="amt-a"><button type="button" class="lq-max" data-max="a">Max</button></div>
            <small class="lq-bal" data-el="bal-a"></small>
          </div>
          <div class="bd-field" data-side="b">
            <label for="${uid}-b">${esc(B.symbol)}</label>
            <div class="bd-input"><input id="${uid}-b" inputmode="decimal" placeholder="0.0" data-el="amt-b"><button type="button" class="lq-max" data-max="b">Max</button></div>
            <small class="lq-bal" data-el="bal-b"></small>
          </div>
        </div>
        <p class="lq-note" data-el="note">Full range earns fees at every price and is the usual choice for a new pool.</p>
        <ol class="lq-steps" data-el="steps" hidden></ol>
        <button class="uh-btn uh-btn-pink uh-btn-sm" type="submit" data-el="go">Add liquidity</button>
        <p class="dp-msg" data-el="msg" role="status" aria-live="polite"></p>
      </form>`;

    const form = root.querySelector('form');
    const el = (name) => form.querySelector(`[data-el="${name}"]`);
    const say = (html, kind = '') => { const m = el('msg'); m.innerHTML = html; m.className = `dp-msg${kind ? ` is-${kind}` : ''}`; };

    let sqrtP = 0n;
    let balances = { a: null, b: null };
    let busy = false;

    /* ---------- range and amounts ---------- */

    const range = () => {
      const custom = form.querySelector(`input[name="${uid}-range"]:checked`).value === 'custom';
      if (!custom) return { lower: M.minUsableTick(key.tickSpacing), upper: M.maxUsableTick(key.tickSpacing), custom };
      const lo = Number(el('min').value.replace(',', '.'));
      const hi = Number(el('max').value.replace(',', '.'));
      if (!(lo > 0) || !(hi > 0) || lo >= hi) return null;
      let t1 = M.tickForPrice(lo, A, B, key.tickSpacing);
      let t2 = M.tickForPrice(hi, A, B, key.tickSpacing);
      if (t1 > t2) [t1, t2] = [t2, t1];
      if (t1 === t2) t2 += key.tickSpacing;
      return { lower: t1, upper: t2, custom };
    };

    // raw amounts per side (a/b) -> per currency (0/1) and back
    const toCur = (rawA, rawB) => (aIs0 ? [rawA, rawB] : [rawB, rawA]);
    const fromCur = (r0, r1) => (aIs0 ? { a: r0, b: r1 } : { a: r1, b: r0 });

    const HUGE = 1n << 200n;
    // Type one side: the other follows from the pool price and the range.
    const follow = (side) => {
      const r = range();
      if (!r || sqrtP === 0n) return;
      const sA = M.sqrtPriceAtTick(r.lower);
      const sB = M.sqrtPriceAtTick(r.upper);
      const t = side === 'a' ? A : B;
      const raw = M.toUnits(el(`amt-${side}`).value, t.decimals);
      if (raw === null) return;
      const [x0, x1] = side === 'a' ? toCur(raw, HUGE) : toCur(HUGE, raw);
      const L = M.liquidityForAmounts(sqrtP, sA, sB, x0, x1);
      const need = M.amountsForLiquidity(sqrtP, sA, sB, L);
      const other = side === 'a' ? 'b' : 'a';
      const otherToken = other === 'a' ? A : B;
      const amt = fromCur(need.amount0, need.amount1)[other];
      el(`amt-${other}`).value = L === 0n ? '' : fmt(amt, otherToken);
      const only = sqrtP <= sA ? t0 : sqrtP >= sB ? t1 : null;
      el('note').textContent = only
        ? `The current price is outside this range, so the position holds only ${only.symbol} until the price moves into it.`
        : r.custom ? 'Fees are earned while the price stays inside this range.' : 'Full range earns fees at every price and is the usual choice for a new pool.';
    };

    const refreshBalances = async () => {
      if (!C.session.address) return;
      const [ba, bb] = await Promise.all([C.balanceOf(A.address, C.session.address), C.balanceOf(B.address, C.session.address)]);
      balances = { a: ba, b: bb };
      el('bal-a').textContent = `Balance ${fmt(ba, A)} ${A.symbol}`;
      el('bal-b').textContent = `Balance ${fmt(bb, B)} ${B.symbol}`;
    };

    const refreshPrice = async () => {
      try {
        const s = await C.readPool(key);
        sqrtP = s.sqrtPriceX96;
        if (sqrtP === 0n) { el('price').textContent = 'This pool is not created yet.'; return; }
        const p = M.priceOf(sqrtP, A, B);
        el('price').textContent = `1 ${A.symbol} = ${num(p)} ${B.symbol}`;
        if (!el('min').value) { el('min').value = num(p / 2); el('max').value = num(p * 2); }
      } catch (err) {
        el('price').textContent = 'Could not read the pool right now.';
      }
    };

    form.addEventListener('change', (e) => {
      if (e.target.name === `${uid}-range`) {
        el('custom').hidden = e.target.value !== 'custom';
        follow('a');
      }
    });
    form.addEventListener('input', (e) => {
      const n = e.target.dataset.el;
      if (n === 'amt-a') follow('a');
      if (n === 'amt-b') follow('b');
      if (n === 'min' || n === 'max') follow(el('amt-a').value ? 'a' : 'b');
    });
    form.addEventListener('click', (e) => {
      const side = e.target.dataset && e.target.dataset.max;
      if (!side || balances[side] === null) return;
      const t = side === 'a' ? A : B;
      let raw = balances[side];
      if (BigInt(t.address) === 0n) raw = raw > GAS_RESERVE ? raw - GAS_RESERVE : 0n;
      el(`amt-${side}`).value = M.fromUnits(raw, t.decimals, t.decimals);
      follow(side);
    });

    /* ---------- signing ---------- */

    const steps = [];
    const showSteps = () => {
      const list = el('steps');
      list.hidden = !steps.length;
      list.innerHTML = steps.map((s) => `<li class="is-${s.state}"><span class="dm-dot"></span><span>${esc(s.label)}</span>${s.tx ? `<em>${C.link('tx', s.tx, 'tx')}</em>` : ''}</li>`).join('');
    };
    const runStep = async (label, fn) => {
      const s = { label, state: 'busy' };
      steps.push(s);
      showSteps();
      try {
        const tx = await fn();
        if (tx) { s.tx = tx.hash; showSteps(); const r = await tx.wait(); if (!r || r.status !== 1) throw new Error(`${label} failed on chain.`); }
        s.state = 'done';
      } catch (err) {
        s.state = 'error';
        throw err;
      } finally {
        showSteps();
      }
    };

    // ERC-20 -> Permit2 (unlimited, once) and Permit2 -> PositionManager (enough, 30 days).
    const approve = async (t, amount) => {
      if (BigInt(t.address) === 0n || amount === 0n) return;
      const owner = C.session.address;
      const erc20 = new ethers.Contract(t.address, C.ABI.ERC20, C.session.signer);
      if ((await erc20.allowance(owner, NET.permit2)) < amount) {
        await runStep(`Let Permit2 move your ${t.symbol}`, () => erc20.approve(NET.permit2, ethers.MaxUint256));
      }
      const p2 = new ethers.Contract(NET.permit2, C.ABI.PERMIT2, C.session.signer);
      const now = await C.chainNow();
      const al = await p2.allowance(owner, t.address, NET.positionManager);
      if (al.amount < amount || Number(al.expiration) < now + 600) {
        await runStep(`Let Uniswap use your ${t.symbol}`, () => p2.approve(t.address, NET.positionManager, MAX_UINT160, now + 30 * 86400));
      }
    };

    const submit = async (e) => {
      e.preventDefault();
      if (busy) return;
      say('');
      if (!C.session.signer) { say('Connect your wallet first.', 'error'); return; }
      const r = range();
      if (!r) { say('Enter a lowest and a highest price, lowest first.', 'error'); return; }
      const rawA = M.toUnits(el('amt-a').value || '0', A.decimals);
      const rawB = M.toUnits(el('amt-b').value || '0', B.decimals);
      if (rawA === null || rawB === null || (rawA === 0n && rawB === 0n)) { say('Enter how much to deposit.', 'error'); return; }
      await refreshPrice();
      if (sqrtP === 0n) { say('This pool is not created yet.', 'error'); return; }

      const sA = M.sqrtPriceAtTick(r.lower);
      const sB = M.sqrtPriceAtTick(r.upper);
      const [max0, max1] = toCur(rawA, rawB);
      // A hair under what the amounts allow, so rounding never asks for more than you entered.
      const L = (M.liquidityForAmounts(sqrtP, sA, sB, max0, max1) * 9990n) / 10000n;
      if (L === 0n) { say('That deposit is too small for this range. Enter a larger amount.', 'error'); return; }

      await refreshBalances();
      for (const [side, t, raw] of [['a', A, rawA], ['b', B, rawB]]) {
        if (balances[side] !== null && balances[side] < raw) { say(`Not enough ${esc(t.symbol)}: you have ${esc(fmt(balances[side], t))}.`, 'error'); return; }
      }

      busy = true;
      el('go').disabled = true;
      steps.length = 0;
      try {
        await approve(t0, max0);
        await approve(t1, max1);

        const owner = C.session.address;
        const native = BigInt(key.currency0) === 0n;
        const actions = [ACTIONS.MINT_POSITION, ACTIONS.SETTLE_PAIR, ...(native ? [ACTIONS.SWEEP] : [])];
        const params = [
          coder.encode(
            ['tuple(address,address,uint24,int24,address)', 'int24', 'int24', 'uint256', 'uint128', 'uint128', 'address', 'bytes'],
            [[key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks], r.lower, r.upper, L, max0, max1, owner, '0x']
          ),
          coder.encode(['address', 'address'], [key.currency0, key.currency1]),
          ...(native ? [coder.encode(['address', 'address'], [key.currency0, owner])] : [])
        ];
        const unlockData = coder.encode(['bytes', 'bytes[]'], [ethers.hexlify(new Uint8Array(actions)), params]);
        const deadline = (await C.chainNow()) + 20 * 60;
        const posm = new ethers.Contract(NET.positionManager, C.ABI.POSM, C.session.signer);
        const value = native ? max0 : 0n;

        try {
          await posm.modifyLiquidities.staticCall(unlockData, deadline, { value });
        } catch (err) {
          throw new Error(C.explain(err, [abi]));
        }
        let txHash = null;
        let receipt = null;
        await runStep('Add the liquidity', async () => {
          const tx = await posm.modifyLiquidities(unlockData, deadline, { value });
          txHash = tx.hash;
          return { hash: tx.hash, wait: async () => (receipt = await tx.wait()) };
        });

        const iface = new ethers.Interface(C.ABI.POSM);
        let tokenId = null;
        for (const log of receipt.logs) {
          if (log.address.toLowerCase() !== NET.positionManager.toLowerCase()) continue;
          try { const ev = iface.parseLog(log); if (ev && ev.name === 'Transfer' && BigInt(ev.args.from) === 0n) tokenId = ev.args.id.toString(); } catch (_) { /* other event */ }
        }
        const position = { tokenId, tx: txHash, lower: r.lower, upper: r.upper, at: new Date().toISOString() };
        if (hook) C.store.addPosition(hook, pool.id, position);
        say(`Liquidity added${tokenId ? ` as position #${esc(tokenId)}` : ''}. ${tokenId ? `<a href="${esc(C.uniswapPosition(tokenId))}" target="_blank" rel="noopener">View it on Uniswap</a> · ` : ''}${C.link('tx', txHash, 'transaction')}`, 'ok');
        el('amt-a').value = '';
        el('amt-b').value = '';
        refreshBalances();
        onDone(position);
      } catch (err) {
        say(C.isRejection(err) ? 'Cancelled in the wallet. Nothing more was sent.' : esc(C.explain(err, [abi])), C.isRejection(err) ? '' : 'error');
      } finally {
        busy = false;
        el('go').disabled = false;
      }
    };
    form.addEventListener('submit', submit);

    refreshPrice();
    refreshBalances();
    document.addEventListener('unyhooks:wallet', refreshBalances);
    return { refresh: () => { refreshPrice(); refreshBalances(); } };
  };

  window.UnyLiquidity = { mount };
})();
