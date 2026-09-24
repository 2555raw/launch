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
    pairedAsset:   '0x39191d7b',   // pairedAsset()
    assetTicker:   '0xbcc49b0c',   // assetTicker()
    colour:        '0x3dbc0610',   // colour()
    position:      '0x09218e91',   // position()
    drawnAt:       '0x25c5e0a1',   // drawnAt()
    creator:       '0x02d05d3f',   // creator()
    addLiquidity:  '0xe8e33700',   // addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256)
    addLiquidityETH: '0xf305d719', // addLiquidityETH(address,uint256,uint256,uint256,address,uint256)
    launch:        '0x1daea893',   // launch(string,string,uint256,string,string,string,string)
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

  /* ---------- reading launches back off the chain ----------
   *
     Every coin emits Paired once, in its constructor, so the draw is in the
     logs as well as in storage. That one line is what makes a public board
     possible at all: a coin is deployed straight from the launcher's own wallet
     with a bare create, so there is no factory holding a list and nothing to
     enumerate — but there IS a log topic, and eth_getLogs over that topic finds
     every Twistr coin ever deployed, by anyone, without trusting this page.

     Computed from the signature, not remembered. The signature is written
     beside it so the test can recompute it. */
  const TOPIC = {
    paired: '0x97e37329ad6278899cda0351f48aa595e149ae986230bfbd2856809790d94390',
    // Paired(string,string,string,string,address)
    launched: '0xdb50a9e15b4eabbc5e97186ae158f84d5f78e14d0495e4cf35386b4bed4e5a7e',
    // Launched(address,address)
  };

  /* Four strings and an address, none indexed, so it is all in `data`.
     decodeString above assumes the one-value layout — an offset, a length, the
     bytes — and cannot be reused here, because four strings means four offsets
     pointing at four tails. Each string is read at the offset its head word
     gives, and anything malformed comes back empty rather than throwing: this
     is a log written by a contract nobody here controls. */
  const decodePaired = (data) => {
    const h = strip(data);
    const words = h.match(/.{64}/g) || [];
    if (words.length < 5) return null;

    const at = (i) => {
      const off = Number(BigInt('0x' + words[i]));
      if (!Number.isFinite(off) || off < 160 || off % 32 !== 0) return '';
      const w = off / 32;
      if (w >= words.length) return '';
      const len = Number(BigInt('0x' + words[w]));
      // a name is not a book; a length that says otherwise is a malformed log
      if (!Number.isFinite(len) || len === 0 || len > 512) return '';
      const bytes = h.slice((w + 1) * 64, (w + 1) * 64 + len * 2).match(/.{2}/g) || [];
      if (bytes.length !== len) return '';
      try { return new TextDecoder().decode(new Uint8Array(bytes.map((b) => parseInt(b, 16)))); }
      catch (e) { return ''; }
    };

    return {
      asset: at(0),
      assetTicker: at(1),
      colour: at(2),
      position: at(3),
      creator: '0x' + words[4].slice(24),
    };
  };

  const blockNumber = async () => Number(BigInt(await rpc('eth_blockNumber', [])));

  /* One window of blocks. No address filter — the point is to find coins this
     browser has never seen — so the topic is the whole filter and the range has
     to stay small enough that the node will answer it. */
  const pairedLogs = async (fromBlock, toBlock) => {
    const logs = await rpc('eth_getLogs', [{
      fromBlock: '0x' + Number(fromBlock).toString(16),
      toBlock: '0x' + Number(toBlock).toString(16),
      topics: [TOPIC.paired],
    }]);
    return (Array.isArray(logs) ? logs : [])
      .map((l) => {
        const d = decodePaired(l.data);
        if (!d) return null;
        return Object.assign({
          address: String(l.address || '').toLowerCase(),
          block: Number(BigInt(l.blockNumber || '0x0')),
          txHash: l.transactionHash || '',
        }, d);
      })
      .filter(Boolean);
  };

  /* When a block was mined, in milliseconds, so a coin found in a log can say
     how long ago it was launched like every other row. Cached: a scan usually
     finds several coins in the same block and the answer cannot change. */
  const blockTimes = new Map();
  const blockTime = async (n) => {
    if (blockTimes.has(n)) return blockTimes.get(n);
    try {
      const b = await rpc('eth_getBlockByNumber', ['0x' + Number(n).toString(16), false]);
      const ms = b && b.timestamp ? Number(BigInt(b.timestamp)) * 1000 : 0;
      blockTimes.set(n, ms);
      return ms;
    } catch (e) {
      blockTimes.set(n, 0);
      return 0;
    }
  };

  /* The draw, read straight off the contract rather than out of a log.
     This is the payoff of writing the pairing into the token at construction:
     anyone can point at an address and get the same answer, without this page
     and without having been here when it was launched. A contract that is not
     a Twistr coin simply has no such getters and comes back empty. */
  const readDraw = async (address) => {
    const [a, t, c, p] = await Promise.all([
      call(address, SEL.pairedAsset).catch(() => '0x'),
      call(address, SEL.assetTicker).catch(() => '0x'),
      call(address, SEL.colour).catch(() => '0x'),
      call(address, SEL.position).catch(() => '0x'),
    ]);
    return {
      asset: decodeString(a),
      assetTicker: decodeString(t),
      colour: decodeString(c),
      position: decodeString(p),
      creator: '',
    };
  };

  /* What the coin itself says, which is the authority. The log is how it was
     found; these three calls are what gets shown. */
  const readCoin = async (address) => {
    const [nm, sym, sup] = await Promise.all([
      call(address, SEL.name),
      call(address, SEL.symbol),
      call(address, SEL.totalSupply),
    ]);
    return {
      name: decodeString(nm),
      ticker: decodeString(sym),
      supply: decodeUint(sup).toString(),
    };
  };

  /* ---------- the wallet ---------- */

  const provider = () => (typeof window !== 'undefined' ? window.ethereum : null);
  const hasWallet = () => !!provider();

  /* Which wallet this is, and whether it can preview a contract creation.
   *
     This exists because of a specific, repeated complaint: Phantom shows a red
     "could not simulate this request" with a "Confirm (unsafe)" button under
     it, every single time, on a deployment that is completely fine. Explaining
     that after the fact does not help — the person is already staring at it
     and deciding whether to trust us.

     A deployment has no `to`, no transfer and no token. A wallet simulator is
     built to show BALANCE CHANGES, so on a create there is frequently nothing
     for it to describe and it reports failure. That is a property of the
     wallet, not of the transaction, and which wallet it is is knowable before
     anything is signed.

     `simulatesCreates: false` is not a claim that the wallet is broken or that
     the transaction will fail. It means: this one is known to show a scary box
     on a create, so say so first. */
  const WALLETS = [
    { flag: 'isPhantom',       name: 'Phantom',          simulatesCreates: false },
    { flag: 'isRabby',         name: 'Rabby',            simulatesCreates: true  },
    { flag: 'isCoinbaseWallet',name: 'Coinbase Wallet',  simulatesCreates: true  },
    { flag: 'isBraveWallet',   name: 'Brave Wallet',     simulatesCreates: true  },
    { flag: 'isTrust',         name: 'Trust Wallet',     simulatesCreates: true  },
    { flag: 'isMetaMask',      name: 'MetaMask',         simulatesCreates: true  },
  ];

  const walletInfo = () => {
    const p = provider();
    if (!p) return { name: '', simulatesCreates: true };
    /* Order matters: several wallets set isMetaMask as well as their own flag,
       to get through code that only checks for MetaMask. Their own flag is
       checked first, and MetaMask is last for exactly that reason. */
    const hit = WALLETS.find((w) => p[w.flag]);
    return hit ? { name: hit.name, simulatesCreates: hit.simulatesCreates }
               : { name: '', simulatesCreates: true };
  };

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

  /* The seven values of a launch, in the order both the constructor and the
     factory's launch() take them. One list, used by both paths, so the two
     cannot drift into encoding different coins. */
  const launchArgs = (coin) => [
    { type: 'string', value: coin.name },
    { type: 'string', value: coin.ticker },
    { type: 'uint256', value: coin.supplyWei },
    { type: 'string', value: coin.assetName },
    { type: 'string', value: coin.assetTicker },
    { type: 'string', value: coin.colour },
    { type: 'string', value: coin.position },
  ];

  const creationCode = (coin, creator) => {
    const build = window.TWISTR_COIN;
    if (!build || !build.bytecode) throw new Error('contract/twistr-coin.js has not been loaded');
    /* The constructor takes the creator explicitly now. On this path it is
       whoever is sending, which is the same thing msg.sender used to be. */
    const args = encodeArgs(launchArgs(coin).concat([
      { type: 'address', value: creator || state.account },
    ]));
    return build.bytecode + args;
  };

  const factoryCode = () => {
    const build = window.TWISTR_FACTORY;
    if (!build || !build.bytecode) throw new Error('contract/twistr-factory.js has not been loaded');
    return build.bytecode;   // no constructor arguments: it holds nothing
  };

  const launchData = (coin) => SEL.launch + encodeArgs(launchArgs(coin));

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
    /* Prices the transaction that will ACTUALLY be sent. Estimating the direct
       creation while sending a factory call would be an estimate of a different
       transaction, which is worse than no estimate at all. */
    const gas = await rpc('eth_estimateGas', [deployTx(coin)]);
    return '0x' + ((BigInt(gas) * 115n) / 100n).toString(16);
  };

  /* The estimate is the answer to "why does my wallet say it cannot simulate
     this?", and it used to go to console.warn where nobody would ever see it.
     It is handed back to the caller now.

     The distinction matters and it is not cosmetic. A wallet's simulation and
     the node's gas estimate are two different machines answering two different
     questions. eth_estimateGas actually executes the transaction against the
     current state and reports what it costs — if it returns a number, the
     deployment runs. A wallet simulator is trying to predict BALANCE CHANGES
     for a human-readable preview, and a bare contract creation has no `to`, no
     transfer and no token it recognises, so there is frequently nothing for it
     to describe and it reports a failure. Those are not the same event, and
     treating the second as evidence about the first is how people either panic
     over a fine transaction or confirm a broken one.

     So: still sends when the estimate is refused, because some nodes decline
     creations on principle and the wallet does get the last word — but the
     caller is told, and can say so before the wallet opens. */
  /* Two ways to make the same coin, and which one runs decides whether the
     person's wallet can show them a preview.
   *
     THROUGH THE FACTORY, when config.js has its address: an ordinary call with
     a `to`, and the coin's mint emits Transfer(0x0 -> you, supply) inside it.
     That is exactly what a wallet simulator reads, so the red "could not
     simulate this request" box does not appear.

     DIRECTLY, when it does not: a bare creation, with no recipient and nothing
     to transfer, which several wallets cannot preview at all. It still works
     and it is still the same contract — it just looks alarming in Phantom.

     Identical coins either way. creationCode and launchData are built from one
     shared argument list so they cannot drift apart. */
  /* WHERE THE LAUNCHER ADDRESS COMES FROM, and why it is safe to keep one
     this page was not shipped with.
   *
     The first version of this required editing config.js and redeploying the
     site, which meant the fix was built but switched off — and the wallet kept
     showing its red box. That is not a fix.

     So a launcher deployed from the wallet panel is remembered here. The
     objection to that is real and worth stating: a page that decides at
     runtime where its transactions go can be pointed anywhere. The answer is
     that this address is never trusted on its word. Before the pad will launch
     through it, eth_getCode is read and compared BYTE FOR BYTE against the
     runtime bytecode of the factory in this build. If it does not match
     exactly — a different contract, a different version, nothing at all — it
     is discarded and the pad falls back to a direct creation.

     So the stored value cannot redirect anything. It either holds this exact
     contract, which mints to msg.sender and can hold nothing, or it is not
     used. config.js still wins when it names one. */
  const REMEMBERED = 'twistr.factory.v1';

  const rememberFactory = (addr) => {
    try { localStorage.setItem(REMEMBERED, String(addr)); } catch (e) { /* storage blocked */ }
  };
  const forgetFactory = () => {
    try { localStorage.removeItem(REMEMBERED); } catch (e) { /* storage blocked */ }
  };
  const rememberedFactory = () => {
    try { return localStorage.getItem(REMEMBERED) || ''; } catch (e) { return ''; }
  };

  /* config.js first: a site that ships an address means it, and it should not
     be overridden by whatever a browser happens to remember. */
  const factoryAddress = () => {
    const f = window.TWISTR_CONFIG.factory;
    if (f && f.address) return f.address;
    return rememberedFactory();
  };

  /* Set by verifyFactory, and the only thing usesFactory trusts. Until the
     chain has confirmed the code, launches take the direct path — being
     unverified means being unused, never being assumed good. */
  let factoryOk = false;

  const verifyFactory = async () => {
    factoryOk = false;
    const addr = factoryAddress();
    const build = window.TWISTR_FACTORY;
    if (!addr || !build || !build.deployedBytecode) return { ok: false, reason: 'none configured' };
    if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) return { ok: false, reason: 'not an address' };
    try {
      const code = await rpc('eth_getCode', [addr, 'latest']);
      if (!code || code === '0x') return { ok: false, reason: 'nothing deployed there' };
      if (String(code).toLowerCase() !== String(build.deployedBytecode).toLowerCase()) {
        return { ok: false, reason: 'the code there is not this launcher' };
      }
      factoryOk = true;
      return { ok: true, address: addr };
    } catch (e) {
      return { ok: false, reason: (e && e.message) || 'call failed' };
    }
  };

  const usesFactory = () => factoryOk && !!factoryAddress() && !!window.TWISTR_FACTORY;

  const deployTx = (coin) => (usesFactory()
    ? { from: state.account, to: factoryAddress(),
        data: launchData(coin), value: '0x0' }
    /* value is explicitly zero rather than absent. A creation sends nothing
       either way, but some wallets treat a missing field as unknown rather
       than as zero when they build their preview. */
    : { from: state.account, data: creationCode(coin), value: '0x0' });

  const deploy = async (coin, onEstimate) => {
    const tx = deployTx(coin);
    try {
      const gas = await rpc('eth_estimateGas', [tx]);
      tx.gas = '0x' + ((BigInt(gas) * 115n) / 100n).toString(16);
      if (onEstimate) onEstimate({ ok: true, gas: BigInt(tx.gas).toString(), viaFactory: usesFactory() });
    } catch (e) {
      const reason = (e && (e.message || e.reason)) || 'the node gave no reason';
      if (onEstimate) onEstimate({ ok: false, reason, viaFactory: usesFactory() });
    }
    return rpc('eth_sendTransaction', [tx]);
  };

  /* Deploying the factory itself. Done once, by whoever runs the pad, and its
     address goes in config.js. This is still a bare creation and will still
     make Phantom complain — but once, rather than on every launch anybody
     ever does. */
  const deployFactory = async () => rpc('eth_sendTransaction', [{
    from: state.account, data: factoryCode(), value: '0x0',
  }]);

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
    SEL, TOPIC, encodeArgs, decodeString, decodeUint, decodeAddress, decodePaired,
    creationCode, factoryCode, launchData, launchArgs, deployTx, deployFactory,
    usesFactory, verifyFactory, factoryAddress, rememberFactory, forgetFactory,
    estimateDeploy, blockNumber, blockTime, pairedLogs, readCoin, readDraw,
    hasWallet, walletInfo, connect, state, onChain, switchChain,
    verifyToken, verifyRouter, deploy, waitForReceipt,
    approve, allowanceOf, ensureAllowance, addLiquidity, addLiquidityETH, pairFor,
    explorerTx, explorerAddress,
  };
})();
