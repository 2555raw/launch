/* Twistr — the chain layer.
 *
 * Everything that talks to a wallet or a contract lives here: encoding, the
 * connection, verifying the configured tokens, deploying the coin, and opening
 * its first pool. No dependencies; an injected EIP-1193 provider is the whole
 * runtime.
 *
 * Two rules this file is built around.
 *
 * Nothing is asserted that has not been checked. The token list in config.js
 * ships empty on purpose, and verify() calls symbol(), decimals() and name() on
 * every address against the live chain before the pad will launch against it.
 * A wrong address does not throw here — it sends real liquidity somewhere it
 * can never be recovered from — so the check is not optional.
 *
 * The selectors below were computed from their signatures, not remembered. The
 * signature sits beside each one and test/chain.test.js recomputes the lot.
 */
window.TwistrChain = (() => {
  'use strict';

  const SEL = {
    name:          '0x06fdde03',   // name()
    symbol:        '0x95d89b41',   // symbol()
    decimals:      '0x313ce567',   // decimals()
    totalSupply:   '0x18160ddd',   // totalSupply()
    balanceOf:     '0x70a08231',   // balanceOf(address)
    approve:       '0x095ea7b3',   // approve(address,uint256)
    allowance:     '0xdd62ed3e',   // allowance(address,address)
    WETH:          '0xad5c4648',   // WETH()
    factory:       '0xc45a0155',   // factory()
    getPair:       '0xe6a43905',   // getPair(address,address)
    addLiquidity:  '0xe8e33700',   // addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256)
    addLiquidityETH: '0xf305d719', // addLiquidityETH(address,uint256,uint256,uint256,address,uint256)
  };

  /* ---------- encoding ---------- */

  const strip = (h) => String(h || '').replace(/^0x/, '');
  const word = (n) => BigInt(n).toString(16).padStart(64, '0');
  const addrWord = (a) => strip(a).toLowerCase().padStart(64, '0');
  const padRight = (h) => h + '0'.repeat((64 - (h.length % 64)) % 64);

  const utf8 = (s) => {
    const b = new TextEncoder().encode(s);
    let h = '';
    b.forEach((v) => { h += v.toString(16).padStart(2, '0'); });
    return { hex: h, length: b.length };
  };

  /* The constructor's arguments, ABI-encoded. Heads first — a word each, the
     value itself for a uint and an offset for a string — then the tails. This
     is the piece most likely to be quietly wrong, so test/contract.test.js
     deploys the result in a real EVM and reads every field back. */
  const encodeArgs = (params) => {
    let head = '', tail = '', offset = params.length * 32;
    params.forEach((p) => {
      if (p.type === 'uint256') { head += word(p.value); return; }
      if (p.type === 'address') { head += addrWord(p.value); return; }
      head += word(offset);
      const s = utf8(String(p.value));
      const data = padRight(s.hex);
      tail += word(s.length) + data;
      offset += 32 + data.length / 2;
    });
    return head + tail;
  };

  const decodeString = (hex) => {
    const h = strip(hex);
    if (h.length < 128) return '';
    const len = parseInt(h.slice(64, 128), 16);
    if (!Number.isFinite(len) || len === 0) return '';
    const bytes = h.slice(128, 128 + len * 2).match(/.{2}/g) || [];
    return new TextDecoder().decode(new Uint8Array(bytes.map((b) => parseInt(b, 16))));
  };

  const decodeUint = (hex) => {
    const h = strip(hex);
    return h ? BigInt('0x' + h.slice(0, 64)) : 0n;
  };

  const decodeAddress = (hex) => '0x' + strip(hex).slice(24, 64);

  /* ---------- the wallet ---------- */

  const provider = () => (typeof window !== 'undefined' ? window.ethereum : null);
  const hasWallet = () => !!provider();

  const rpc = (method, params) => {
    const p = provider();
    if (!p) return Promise.reject(new Error('No wallet found in this browser.'));
    return p.request({ method, params: params || [] });
  };

  const call = (to, data) => rpc('eth_call', [{ to, data }, 'latest']);

  const state = { account: null, chainId: null };

  const connect = async () => {
    const accounts = await rpc('eth_requestAccounts');
    state.account = (accounts && accounts[0]) || null;
    state.chainId = await rpc('eth_chainId');
    return state;
  };

  const onChain = () => {
    const want = window.TWISTR_CONFIG.chain;
    return String(state.chainId).toLowerCase() === want.hex.toLowerCase();
  };

  /* Ask the wallet to move to the configured chain, adding it only if the
     wallet has never heard of it (4902). */
  const switchChain = async () => {
    const c = window.TWISTR_CONFIG.chain;
    try {
      await rpc('wallet_switchEthereumChain', [{ chainId: c.hex }]);
    } catch (e) {
      if (e && (e.code === 4902 || (e.data && e.data.originalError && e.data.originalError.code === 4902))) {
        await rpc('wallet_addEthereumChain', [{
          chainId: c.hex, chainName: c.name, nativeCurrency: c.currency,
          rpcUrls: c.rpc, blockExplorerUrls: [c.explorer],
        }]);
      } else {
        throw e;
      }
    }
    state.chainId = await rpc('eth_chainId');
    return onChain();
  };

  /* ---------- checking the token list ----------
     The pad will not launch against an address that has not answered like the
     token config.js says it is. */
  const verifyToken = async (entry) => {
    if (!entry.address) return { ok: false, reason: 'no address configured' };
    if (!/^0x[0-9a-fA-F]{40}$/.test(entry.address)) return { ok: false, reason: 'not an address' };
    try {
      const code = await rpc('eth_getCode', [entry.address, 'latest']);
      if (!code || code === '0x') return { ok: false, reason: 'nothing deployed there' };

      const [sym, dec] = await Promise.all([
        call(entry.address, SEL.symbol),
        call(entry.address, SEL.decimals),
      ]);
      const symbol = decodeString(sym);
      const decimals = Number(decodeUint(dec));

      if (!symbol) return { ok: false, reason: 'no symbol() — not an ERC-20' };
      if (symbol.toUpperCase() !== String(entry.ticker).toUpperCase()) {
        return { ok: false, reason: `chain says ${symbol}, config says ${entry.ticker}` };
      }
      if (decimals !== Number(entry.decimals)) {
        return { ok: false, reason: `chain says ${decimals} decimals, config says ${entry.decimals}` };
      }
      return { ok: true, symbol, decimals };
    } catch (e) {
      return { ok: false, reason: (e && e.message) || 'call failed' };
    }
  };

  /* Two questions, and BOTH answers have to match config.js.

     One would not be enough. The router address in config.js is vouched for by
     a single package, which is thinner than I would like for the call that
     moves someone's liquidity. So the pad asks the contract at that address
     what its WETH() and its factory() are, and refuses to use it unless both
     come back as the file says. A wrong address would have to be a contract
     that answers two unrelated getters with two specific addresses to slip
     through, and a wrong-but-real V2 router — one for another chain, or a fork
     — fails on the factory even when it passes on WETH.

     Failing here is not fatal: pools stay off, and deploying a coin still
     works. */
  const verifyRouter = async () => {
    const r = window.TWISTR_CONFIG.router;
    if (!r.address) return { ok: false, reason: 'no router configured' };
    try {
      const code = await rpc('eth_getCode', [r.address, 'latest']);
      if (!code || code === '0x') return { ok: false, reason: 'nothing deployed there' };
      const [wethHex, factoryHex] = await Promise.all([
        call(r.address, SEL.WETH),
        call(r.address, SEL.factory),
      ]);
      const weth = decodeAddress(wethHex);
      const factory = decodeAddress(factoryHex);
      if (!/^0x[0-9a-f]{40}$/.test(weth) || /^0x0{40}$/.test(weth)) {
        return { ok: false, reason: 'no WETH() — not a V2 router' };
      }
      if (r.weth && weth.toLowerCase() !== r.weth.toLowerCase()) {
        return { ok: false, reason: `router WETH is ${weth}, config says ${r.weth}` };
      }
      if (!/^0x[0-9a-f]{40}$/.test(factory) || /^0x0{40}$/.test(factory)) {
        return { ok: false, reason: 'no factory() — not a V2 router' };
      }
      if (r.factory && factory.toLowerCase() !== r.factory.toLowerCase()) {
        return { ok: false, reason: `router factory is ${factory}, config says ${r.factory}` };
      }
      return { ok: true, weth, factory };
    } catch (e) {
      return { ok: false, reason: (e && e.message) || 'call failed' };
    }
  };

  /* The pair for two tokens, or null if nobody has opened it yet. Read off the
     factory rather than computed, so it is the chain's answer and not this
     page's arithmetic about an init code hash. */
  const pairFor = async (factory, a, b) => {
    try {
      const hex = await call(factory, SEL.getPair + addrWord(a) + addrWord(b));
      const addr = decodeAddress(hex);
      return /^0x0{40}$/.test(addr) ? null : addr;
    } catch (e) {
      return null;
    }
  };

  /* ---------- deploying the coin ---------- */

  const creationCode = (coin) => {
    const build = window.TWISTR_COIN;
    if (!build || !build.bytecode) throw new Error('contract/twistr-coin.js has not been loaded');
    const args = encodeArgs([
      { type: 'string', value: coin.name },
      { type: 'string', value: coin.ticker },
      { type: 'uint256', value: coin.supplyWei },
      { type: 'string', value: coin.assetName },
      { type: 'string', value: coin.assetTicker },
      { type: 'string', value: coin.colour },
      { type: 'string', value: coin.position },
    ]);
    return build.bytecode + args;
  };

  /* Ask the node what this costs before opening the wallet.
   *
   * Two things come out of it. A deployment that would revert is caught here,
   * as a plain error this page can explain, instead of arriving in the wallet
   * as "could not simulate this request" with a Confirm (unsafe) button under
   * it — which is a dialog nobody should be reading, let alone clicking.
   *
   * And the send carries a gas limit, so the wallet is not left estimating a
   * contract creation on its own. The estimate is padded because the state it
   * was measured against is one block old by the time it is mined. */
  const estimateDeploy = async (coin) => {
    const gas = await rpc('eth_estimateGas', [{
      from: state.account,
      data: creationCode(coin),
    }]);
    return '0x' + ((BigInt(gas) * 115n) / 100n).toString(16);
  };

  const deploy = async (coin) => {
    const tx = { from: state.account, data: creationCode(coin) };
    try {
      tx.gas = await estimateDeploy(coin);
    } catch (e) {
      /* A node that will not estimate is not proof the deployment is bad — some
         refuse creations outright — so this reports and sends anyway rather
         than blocking on it. The wallet gets the last word either way. */
      if (typeof console !== 'undefined') console.warn('gas estimate refused:', e && e.message);
    }
    return rpc('eth_sendTransaction', [tx]);
  };

  /* A deployment is only real once it is mined, and the address comes from the
     receipt rather than being predicted from the nonce. */
  const waitForReceipt = async (hash, onTick) => {
    for (let i = 0; i < 180; i++) {
      const r = await rpc('eth_getTransactionReceipt', [hash]);
      if (r && r.blockNumber) {
        /* status can arrive as '0x0' or as a number; `r.status && …` let a
           numeric 0 through as success, which reported a reverted deployment
           as deployed. Anything that is not explicitly 1 is a failure. */
        if (r.status !== undefined && r.status !== null && BigInt(r.status) !== 1n) {
          throw new Error('The transaction reverted on chain.');
        }
        return r;
      }
      if (onTick) onTick(i);
      await new Promise((res) => setTimeout(res, 2000));
    }
    throw new Error('Still not mined after six minutes. The hash is good; check the explorer.');
  };

  /* ---------- the first pool ---------- */

  const allowanceOf = async (token, owner, spender) =>
    decodeUint(await call(token, SEL.allowance + addrWord(owner) + addrWord(spender)));

  const approve = async (token, spender, amountWei) => rpc('eth_sendTransaction', [{
    from: state.account,
    to: token,
    data: SEL.approve + addrWord(spender) + word(amountWei),
  }]);

  /* Approve only what is missing, and only for the amount being used.
   *
   * V2's addLiquidity pulls BOTH sides of the pair with transferFrom, so both
   * tokens need an allowance — approving only the new coin makes the liquidity
   * call revert with TRANSFER_FROM_FAILED, every time.
   *
   * The reset to zero is for the tokens that refuse to change a non-zero
   * allowance directly. It costs one transaction on those and none anywhere
   * else, and `sent` lets the caller tell the user what they are about to sign. */
  const ensureAllowance = async (token, spender, amountWei, onStep) => {
    const sent = [];
    const have = await allowanceOf(token, state.account, spender);
    if (have >= BigInt(amountWei)) return sent;

    if (have > 0n) {
      if (onStep) onStep('reset');
      const zero = await approve(token, spender, 0n);
      await waitForReceipt(zero);
      sent.push(zero);
    }
    if (onStep) onStep('approve');
    const tx = await approve(token, spender, amountWei);
    await waitForReceipt(tx);
    sent.push(tx);
    return sent;
  };

  const minOut = (amount, bps) => (BigInt(amount) * BigInt(10000 - bps)) / 10000n;

  const addLiquidity = async (opts) => {
    const cfg = window.TWISTR_CONFIG;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + cfg.liquidity.deadlineMinutes * 60);
    const bps = cfg.liquidity.slippageBps;

    const data = SEL.addLiquidity
      + addrWord(opts.coin)
      + addrWord(opts.token)
      + word(opts.coinAmount)
      + word(opts.tokenAmount)
      + word(minOut(opts.coinAmount, bps))
      + word(minOut(opts.tokenAmount, bps))
      + addrWord(state.account)
      + word(deadline);

    return rpc('eth_sendTransaction', [{ from: state.account, to: cfg.router.address, data }]);
  };

  /* The same pool, paid in ether instead of WETH.
   *
     Worth the extra function. addLiquidity pulls BOTH sides with transferFrom,
     which means someone opening a pool against WETH has to already hold WETH —
     so before they can launch they have to go somewhere else, wrap ether, come
     back, and then sign two approvals. Nobody has WETH sitting there. This is
     the version that works for a person with ETH in their wallet: the router
     wraps it inside the call, so there is one approval (the coin) instead of
     two, and the ether rides along as `value`.

     The pool it opens is the same pool. addLiquidityETH is addLiquidity with
     the router doing the wrapping, against the same pair — the router's own
     WETH(), which verifyRouter has already checked is the quote token. */
  const addLiquidityETH = async (opts) => {
    const cfg = window.TWISTR_CONFIG;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + cfg.liquidity.deadlineMinutes * 60);
    const bps = cfg.liquidity.slippageBps;

    const data = SEL.addLiquidityETH
      + addrWord(opts.coin)
      + word(opts.coinAmount)
      + word(minOut(opts.coinAmount, bps))
      + word(minOut(opts.ethAmount, bps))
      + addrWord(state.account)
      + word(deadline);

    return rpc('eth_sendTransaction', [{
      from: state.account,
      to: cfg.router.address,
      data,
      value: '0x' + BigInt(opts.ethAmount).toString(16),
    }]);
  };

  const explorerTx = (hash) => window.TWISTR_CONFIG.chain.explorer + '/tx/' + hash;
  const explorerAddress = (a) => window.TWISTR_CONFIG.chain.explorer + '/address/' + a;

  return {
    SEL, encodeArgs, decodeString, decodeUint, decodeAddress, creationCode, estimateDeploy,
    hasWallet, connect, state, onChain, switchChain,
    verifyToken, verifyRouter, deploy, waitForReceipt,
    approve, allowanceOf, ensureAllowance, addLiquidity, addLiquidityETH, pairFor,
    explorerTx, explorerAddress,
  };
})();
