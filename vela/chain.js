/* AnyChain — wallets and chains.
   Everything that touches a wallet or a chain lives here, behind window.VelaChain.
   The user's wallet signs every transaction; nothing here ever sees a private key.
   The only key AnyChain makes is the throwaway mint keypair for a new pump.fun token,
   which co-signs its own creation and is then discarded. */

(() => {
  'use strict';

  /* Served from vendor/ (unmodified builds from npm), loaded only when first needed. */
  const LIBS = {
    solana: 'vendor/solana-web3-1.99.0.min.js',
    ethers: 'vendor/ethers-6.17.0.min.js'
  };
  const GLOBALS = { solana: 'solanaWeb3', ethers: 'ethers' };

  /* EVM chains AnyChain deploys to. Reads go to public RPCs, so balances on all three
     show without switching the wallet's network. */
  const EVM = {
    rh:   { id: 4663, hex: '0x1237', name: 'Robinhood Chain', unit: 'ETH', rpc: 'https://rpc.mainnet.chain.robinhood.com', explorer: 'https://robinhoodchain.blockscout.com' },
    base: { id: 8453, hex: '0x2105', name: 'Base',      unit: 'ETH', rpc: 'https://base-rpc.publicnode.com',     explorer: 'https://basescan.org' },
    bnb:  { id: 56,   hex: '0x38',   name: 'BNB Chain', unit: 'BNB', rpc: 'https://bsc-rpc.publicnode.com',      explorer: 'https://bscscan.com' }
  };

  const loading = {};
  const lib = (name) => {
    if (window[GLOBALS[name]]) return Promise.resolve(window[GLOBALS[name]]);
    if (!loading[name]) {
      loading[name] = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = LIBS[name];
        s.onload = () => resolve(window[GLOBALS[name]]);
        s.onerror = () => { delete loading[name]; reject(new Error(`Could not load ${name} library — check your connection`)); };
        document.head.appendChild(s);
      });
    }
    return loading[name];
  };

  /* ---------- server API ---------- */

  const api = async (path, opts = {}) => {
    let r;
    try { r = await fetch(path, opts); } catch (_) { throw new Error('AnyChain server unreachable'); }
    const type = r.headers.get('content-type') || '';
    if (!r.ok) {
      let msg = `${r.status} ${r.statusText}`;
      try { msg = (await r.json()).error || msg; } catch (_) { /* not json */ }
      throw new Error(msg);
    }
    return type.includes('json') ? r.json() : r.arrayBuffer();
  };
  const postJson = (path, body) => api(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

  const solRpc = async (method, params) => {
    const j = await postJson('/api/sol-rpc', { jsonrpc: '2.0', id: 1, method, params });
    if (j.error) {
      const text = `${j.error.message || ''} ${JSON.stringify(j.error.data?.err || '')} ${(j.error.data?.logs || []).join(' ')}`;
      if (/prior credit|insufficient (funds|lamports)|AccountNotFound/i.test(text)) throw new Error('Not enough SOL in the wallet for this transaction');
      if (/blockhash not found|block height exceeded/i.test(text)) throw new Error('The transaction expired before it was sent — try again and approve a bit faster');
      if (/slippage|TooMuchSolRequired|TooLittleSolReceived/i.test(text)) throw new Error('Price moved past your slippage — raise slippage and retry');
      throw new Error(j.error.message || 'Solana RPC error');
    }
    return j.result;
  };

  const evmRpc = async (chain, method, params) => {
    const r = await fetch(EVM[chain].rpc, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    const j = await r.json();
    if (j.error) throw new Error(j.error.message || `${EVM[chain].name} RPC error`);
    return j.result;
  };

  /* ---------- providers ---------- */

  const solProvider = () => window.phantom?.solana || window.solflare || window.backpack || window.solana || null;
  const solName = (p) => (p?.isPhantom ? 'Phantom' : p?.isSolflare ? 'Solflare' : p?.isBackpack ? 'Backpack' : 'Solana wallet');
  const evmProvider = () => window.ethereum || null;
  const evmName = (p) => (p?.isRabby ? 'Rabby' : p?.isCoinbaseWallet ? 'Coinbase Wallet' : p?.isBraveWallet ? 'Brave Wallet'
    : p?.isOkxWallet ? 'OKX Wallet' : p?.isMetaMask ? 'MetaMask' : 'EVM wallet');

  const connectSol = async (silent = false) => {
    const p = solProvider();
    if (!p) { if (silent) return null; throw new Error('No Solana wallet found. Install Phantom or Solflare and reload.'); }
    try {
      const res = await p.connect(silent ? { onlyIfTrusted: true } : undefined);
      const pk = (res?.publicKey || p.publicKey)?.toString();
      return pk ? { address: pk, name: solName(p) } : null;
    } catch (e) {
      if (silent) return null;
      throw new Error(e?.code === 4001 ? 'Connection rejected in the wallet' : (e?.message || 'Could not connect'));
    }
  };
  const disconnectSol = async () => { try { await solProvider()?.disconnect(); } catch (_) { /* already gone */ } };

  const connectEvm = async (silent = false) => {
    const p = evmProvider();
    if (!p) { if (silent) return null; throw new Error('No EVM wallet found. Install MetaMask or Rabby and reload.'); }
    try {
      const accts = await p.request({ method: silent ? 'eth_accounts' : 'eth_requestAccounts' });
      return accts?.[0] ? { address: accts[0], name: evmName(p) } : null;
    } catch (e) {
      if (silent) return null;
      throw new Error(e?.code === 4001 ? 'Connection rejected in the wallet' : (e?.message || 'Could not connect'));
    }
  };
  const disconnectEvm = async () => {
    try { await evmProvider()?.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] }); } catch (_) { /* not supported */ }
  };

  const onAccountsChanged = (fn) => {
    evmProvider()?.on?.('accountsChanged', (a) => fn('evm', a?.[0] || null));
    solProvider()?.on?.('accountChanged', (pk) => fn('sol', pk ? pk.toString() : null));
  };

  /* ---------- reads ---------- */

  const solBalance = async (address) => (await solRpc('getBalance', [address, { commitment: 'confirmed' }])).value / 1e9;

  const solTokenBalance = async (owner, mint) => {
    const res = await solRpc('getParsedTokenAccountsByOwner', [owner, { mint }, { encoding: 'jsonParsed', commitment: 'confirmed' }]);
    return (res?.value || []).reduce((a, acc) => a + (acc.account?.data?.parsed?.info?.tokenAmount?.uiAmount || 0), 0);
  };

  const evmBalance = async (chain, address) => Number(BigInt(await evmRpc(chain, 'eth_getBalance', [address, 'latest']))) / 1e18;

  const pad32 = (addr) => addr.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const evmTokenBalance = async (chain, token, owner) => {
    const [bal, dec] = await Promise.all([
      evmRpc(chain, 'eth_call', [{ to: token, data: '0x70a08231' + pad32(owner) }, 'latest']),
      evmRpc(chain, 'eth_call', [{ to: token, data: '0x313ce567' }, 'latest'])
    ]);
    const big = (h, d) => BigInt(h && h !== '0x' ? h : d);   // '0x' = no contract at that address
    return Number(big(bal, '0x0')) / 10 ** Number(big(dec, '0x12'));
  };

  const prices = () => api('/api/prices');
  const health = () => api('/api/health');

  const market = async (addresses) => {
    const out = {};
    const list = [...new Set(addresses)];
    for (let i = 0; i < list.length; i += 30) {
      Object.assign(out, await api(`/api/token/${encodeURIComponent(list.slice(i, i + 30).join(','))}`));
    }
    return out;
  };

  /* ---------- Solana transactions ---------- */

  const b64 = (bytes) => { let s = ''; bytes.forEach((b) => { s += String.fromCharCode(b); }); return btoa(s); };

  /* Phantom warns "This dApp could be malicious" when it can't simulate a transaction or the
     simulation fails. Every transaction is simulated here first (no signatures needed), so one
     that would fail — not enough SOL, slippage — never reaches the wallet. */
  const preflight = async (tx) => {
    const r = await solRpc('simulateTransaction', [b64(tx.serialize()), { encoding: 'base64', sigVerify: false, replaceRecentBlockhash: true, commitment: 'processed' }]);
    const v = r?.value;
    if (!v?.err) return;
    const text = `${JSON.stringify(v.err)} ${(v.logs || []).join(' ')}`;
    if (/insufficient (funds|lamports)|prior credit|AccountNotFound|"Custom":1\b/i.test(text)) throw new Error('Not enough SOL in the wallet for this transaction');
    if (/slippage|TooMuchSolRequired|TooLittleSolReceived|0x1771|0x1772/i.test(text)) throw new Error('Price moved past your slippage — raise slippage and retry');
    throw new Error(`This transaction would fail on-chain (${JSON.stringify(v.err).slice(0, 120)}), so it was not sent to your wallet`);
  };

  const confirm = async (sig, step) => {
    step('Waiting for confirmation');
    const until = Date.now() + 90000;
    while (Date.now() < until) {
      await new Promise((r) => setTimeout(r, 1500));
      const st = (await solRpc('getSignatureStatuses', [[sig]]))?.value?.[0];
      if (st?.err) throw Object.assign(new Error(`Transaction failed on-chain: ${JSON.stringify(st.err)}`), { signature: sig });
      if (st && (st.confirmationStatus === 'confirmed' || st.confirmationStatus === 'finalized')) return sig;
    }
    throw Object.assign(new Error('Not confirmed after 90 s — check the explorer before retrying'), { signature: sig });
  };

  const sendAndConfirm = async (tx, step) => {
    step('Sending transaction');
    /* 'processed': PumpPortal's blockhash is seconds old, and a 'confirmed' preflight
       rejects it as unknown (BlockhashNotFound) on most RPC nodes. */
    const sig = await solRpc('sendTransaction', [b64(tx.serialize()), { encoding: 'base64', preflightCommitment: 'processed', maxRetries: 5 }]);
    return confirm(sig, step);
  };

  /* A transaction only the wallet signs goes through signAndSendTransaction, as Phantom asks:
     the wallet simulates, signs and sends it itself. Wallets without it sign, and we send. */
  const walletSend = async (tx, step) => {
    const p = solProvider();
    if (typeof p?.signAndSendTransaction !== 'function') return sendAndConfirm(await walletSign(tx), step);
    let sig;
    try {
      ({ signature: sig } = await p.signAndSendTransaction(tx, { preflightCommitment: 'processed', maxRetries: 5 }));
    } catch (e) {
      throw new Error(e?.code === 4001 ? 'Rejected in the wallet' : (e?.message || 'Wallet could not send the transaction'));
    }
    return confirm(sig, step);
  };

  const walletSign = async (tx) => {
    const p = solProvider();
    try { return await p.signTransaction(tx); } catch (e) {
      throw new Error(e?.code === 4001 ? 'Rejected in the wallet' : (e?.message || 'Wallet could not sign'));
    }
  };

  /* AnyChain's fee: 1 % of the first buy, paid in the same transaction to AnyChain's wallet.
     EVM wallet still to come; until it is set, EVM launches carry no fee. */
  const FEE = { bps: 100, sol: '74XKGyh9X9f2nfXGjE2PGJSoajUUZWtx4T3FyYtdBEMF', evm: '' };
  const feeOf = (amount) => (Number(amount) > 0 ? Number(amount) * FEE.bps / 10000 : 0);

  /* Add the fee transfer to a versioned transaction built elsewhere (PumpPortal): decompile it
     with its lookup tables, append a SystemProgram transfer, recompile with the same blockhash. */
  const addSolFee = async (web3, tx, payer, amountSol) => {
    const lamports = Math.round(feeOf(amountSol) * 1e9);
    if (!FEE.sol || lamports <= 0) return tx;
    const luts = await Promise.all(tx.message.addressTableLookups.map(async (l) => {
      const info = await solRpc('getAccountInfo', [l.accountKey.toBase58(), { encoding: 'base64' }]);
      const data = Uint8Array.from(atob(info.value.data[0]), (ch) => ch.charCodeAt(0));
      return new web3.AddressLookupTableAccount({ key: l.accountKey, state: web3.AddressLookupTableAccount.deserialize(data) });
    }));
    const msg = web3.TransactionMessage.decompile(tx.message, { addressLookupTableAccounts: luts });
    msg.instructions.push(web3.SystemProgram.transfer({ fromPubkey: new web3.PublicKey(payer), toPubkey: new web3.PublicKey(FEE.sol), lamports }));
    return new web3.VersionedTransaction(msg.compileToV0Message(luts));
  };

  /* Create a pump.fun token: metadata to IPFS, unsigned tx from PumpPortal, the
     wallet signs as payer, the fresh mint keypair signs as the token account. */
  const launchPump = async (opts, step) => {
    const web3 = await lib('solana');
    const sol = await connectSol();
    step('Uploading image and metadata');
    const { uri, image } = await postJson('/api/ipfs', {
      name: opts.name, symbol: opts.symbol, description: opts.description, image: opts.image,
      twitter: opts.twitter, telegram: opts.telegram, website: opts.website
    });
    const mint = web3.Keypair.generate();
    step('Building the create transaction');
    const bytes = await postJson('/api/pump/create', {
      publicKey: sol.address, mint: mint.publicKey.toBase58(), pool: 'pump',
      name: opts.name, symbol: opts.symbol, uri, amount: opts.devBuy, slippage: opts.slippage, priorityFee: opts.priorityFee
    });
    const tx = await addSolFee(web3, web3.VersionedTransaction.deserialize(new Uint8Array(bytes)), sol.address, opts.devBuy);
    step('Checking the transaction');
    await preflight(tx);
    step('Approve the launch in your wallet');
    const signed = await walletSign(tx);
    signed.sign([mint]);   // after the wallet, as Phantom asks for multi-signer transactions
    const signature = await sendAndConfirm(signed, step);
    return { address: mint.publicKey.toBase58(), signature, owner: sol.address, image };
  };

  const sellPump = async (mintAddr, percent, step) => {
    const web3 = await lib('solana');
    const sol = await connectSol();
    step('Building the sell transaction');
    const bytes = await postJson('/api/pump/sell', { publicKey: sol.address, mint: mintAddr, percent });
    const tx = web3.VersionedTransaction.deserialize(new Uint8Array(bytes));
    await preflight(tx);
    step('Approve the sale in your wallet');
    return walletSend(tx, step);
  };

  /* ---------- EVM deploy ---------- */

  const switchChain = async (chain) => {
    const p = evmProvider();
    const c = EVM[chain];
    try {
      await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: c.hex }] });
    } catch (e) {
      const code = e?.code ?? e?.data?.originalError?.code;
      if (code !== 4902) throw new Error(code === 4001 ? 'Network switch rejected' : (e?.message || 'Could not switch network'));
      await p.request({
        method: 'wallet_addEthereumChain',
        params: [{ chainId: c.hex, chainName: c.name, nativeCurrency: { name: c.unit, symbol: c.unit, decimals: 18 }, rpcUrls: [c.rpc], blockExplorerUrls: [c.explorer] }]
      });
    }
  };

  /* Deploy VelaToken (contracts/VelaToken.sol): fixed supply, all minted to the
     deployer, no owner powers. */
  const launchEvm = async (chain, opts, step) => {
    const ethers = await lib('ethers');
    const acct = await connectEvm();
    step(`Switching wallet to ${EVM[chain].name}`);
    await switchChain(chain);
    const provider = new ethers.BrowserProvider(evmProvider());
    const signer = await provider.getSigner();
    const factory = new ethers.ContractFactory(window.VELA_ERC20.abi, window.VELA_ERC20.bytecode, signer);
    step('Approve the deployment in your wallet');
    let contract;
    try {
      contract = await factory.deploy(opts.name, opts.symbol, ethers.parseUnits(String(opts.supply), 18));
    } catch (e) {
      throw new Error(e?.code === 'ACTION_REJECTED' ? 'Rejected in the wallet' : (e?.shortMessage || e?.message || 'Deploy failed'));
    }
    const tx = contract.deploymentTransaction();
    step('Waiting for confirmation');
    const rcpt = await tx.wait(1);
    if (!rcpt || rcpt.status !== 1) throw Object.assign(new Error('Deployment reverted'), { signature: tx.hash });
    const gasNative = Number(rcpt.gasUsed * (rcpt.gasPrice ?? tx.gasPrice ?? 0n)) / 1e18;
    return { address: await contract.getAddress(), signature: tx.hash, owner: acct.address, gasNative };
  };

  /* ---------- Pons (Robinhood Chain) ----------
     Pons' own contracts, called from the user's wallet: the factory for a plain
     launch, the router to launch and make the first buy in one transaction.
     Signatures were matched against Pons' on-chain selectors and simulated on
     Robinhood Chain mainnet. */

  const PONS = {
    factory: '0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e',
    router: '0xe33e9e479df8802cb0866d5d05258bec4cf62948'
  };
  const PONS_PARAMS = '(string name,string symbol,string logo,string description,(string twitter,string telegram,string discord,string website,string farcaster) socials,address creatorFeeRecipient,uint16 creatorTaxBps,bool buybackEnabled,bytes32 expectedEconomics,bytes32 salt)';
  const PONS_ABI = [
    'function launchFee() view returns (uint256)',
    'function maxCreatorTaxBps() view returns (uint256)',
    `function launchToken(${PONS_PARAMS} params, uint256 launchConfigId, address pairToken) payable returns (address token, address curve)`,
    `function launchAndBuy(${PONS_PARAMS} params, uint256 launchConfigId, address pairToken, uint256 amountIn, uint256 minTokensOut, address recipient, address[] snipeTaxExemptions) payable returns (address token, address curve, uint256 tokensOut)`
  ];
  const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

  const launchPons = async (opts, step) => {
    const ethers = await lib('ethers');
    const acct = await connectEvm();
    let logo = '';
    if (opts.image) {
      step('Uploading the logo');
      const { image } = await postJson('/api/ipfs', { name: opts.name, symbol: opts.symbol, image: opts.image, imageOnly: true });
      logo = image.replace('https://ipfs.io/ipfs/', 'ipfs://');
    }
    step('Switching wallet to Robinhood Chain');
    await switchChain('rh');
    const provider = new ethers.BrowserProvider(evmProvider());
    const signer = await provider.getSigner();
    const factory = new ethers.Contract(PONS.factory, PONS_ABI, signer);
    const router = new ethers.Contract(PONS.router, PONS_ABI, signer);
    const [fee, maxTax] = await Promise.all([factory.launchFee(), factory.maxCreatorTaxBps()]);
    const taxBps = Math.min(Number(maxTax), Math.max(0, Math.round(opts.creatorTaxBps || 0)));
    const params = {
      name: opts.name, symbol: opts.symbol, logo, description: opts.description || '',
      socials: { twitter: opts.twitter || '', telegram: opts.telegram || '', discord: '', website: opts.website || '', farcaster: '' },
      creatorFeeRecipient: acct.address, creatorTaxBps: taxBps, buybackEnabled: false,
      expectedEconomics: ethers.ZeroHash, salt: ethers.hexlify(ethers.randomBytes(32))
    };
    const buy = ethers.parseEther(String(opts.devBuy || 0));
    let tx;
    let predicted;
    try {
      if (buy > 0n) {
        step('Quoting the first buy');
        const [token, , quoted] = await router.launchAndBuy.staticCall(params, 0, ethers.ZeroAddress, buy, 0, acct.address, [], { value: fee + buy });
        predicted = token;
        const minOut = quoted * BigInt(100 - Math.min(50, Math.max(1, Math.round(opts.slippage || 10)))) / 100n;
        step('Approve the launch in your wallet');
        tx = await router.launchAndBuy(params, 0, ethers.ZeroAddress, buy, minOut, acct.address, [], { value: fee + buy });
      } else {
        [predicted] = await factory.launchToken.staticCall(params, 0, ethers.ZeroAddress, { value: fee });
        step('Approve the launch in your wallet');
        tx = await factory.launchToken(params, 0, ethers.ZeroAddress, { value: fee });
      }
    } catch (e) {
      if (e?.code === 'ACTION_REJECTED') throw new Error('Rejected in the wallet');
      if (e?.code === 'INSUFFICIENT_FUNDS' || /insufficient funds/i.test(e?.message || '')) throw new Error('Not enough ETH on Robinhood Chain for this launch');
      throw new Error(e?.shortMessage || e?.message || 'Pons launch failed');
    }
    step('Waiting for confirmation');
    const rcpt = await tx.wait(1);
    if (!rcpt || rcpt.status !== 1) throw Object.assign(new Error('Launch reverted'), { signature: tx.hash });
    /* the token the simulation predicted, confirmed by its mint in the receipt;
       failing that, whichever contract minted from the zero address */
    const zero = ethers.zeroPadValue(ethers.ZeroAddress, 32);
    const mints = rcpt.logs.filter((l) => l.topics[0] === TRANSFER && l.topics[1] === zero);
    const mint = mints.find((l) => predicted && l.address.toLowerCase() === predicted.toLowerCase()) || mints[0];
    if (!mint) throw Object.assign(new Error('Launched, but the token address was not found in the receipt — check the transaction'), { signature: tx.hash });
    const gasNative = Number(rcpt.gasUsed * (rcpt.gasPrice ?? tx.gasPrice ?? 0n)) / 1e18;
    return { address: ethers.getAddress(mint.address), signature: tx.hash, owner: acct.address, gasNative, spentNative: Number(fee + buy) / 1e18, image: opts.image ? logo.replace('ipfs://', 'https://ipfs.io/ipfs/') : null };
  };
  /* Stores an image (IPFS through Pinata when the server has it, else on the server) and returns its URL. */
  const uploadImage = async (name, symbol, image) =>
    (await postJson('/api/ipfs', { name, symbol, image, imageOnly: true })).image;
  const ponsPage = (addr) => `https://www.ponsfamily.com/launchpad/${addr}`;

  /* ---------- trading ---------- */

  /* Any Solana token: Jupiter routes across every DEX; PumpPortal is the fallback. */
  const tradeSol = async (mintAddr, side, value, opts, step) => {
    const web3 = await lib('solana');
    const sol = await connectSol();
    step(side === 'buy' ? 'Finding the best route' : 'Building the sale');
    const body = {
      publicKey: sol.address, mint: mintAddr, action: side,
      ...(side === 'buy' ? { amount: value } : { percent: value }),
      slippage: opts.slippage, priorityFee: opts.priorityFee
    };
    /* Jupiter first (every DEX); PumpPortal for anything Jupiter can't route yet */
    let bytes;
    try {
      const { tx } = await postJson('/api/sol/swap', body);
      bytes = Uint8Array.from(atob(tx), (ch) => ch.charCodeAt(0));
    } catch (e) {
      if (/holds none/.test(e.message)) throw e;
      bytes = new Uint8Array(await postJson('/api/sol/trade', body));
    }
    const tx = web3.VersionedTransaction.deserialize(bytes);
    await preflight(tx);
    step('Approve in your wallet');
    return walletSend(tx, step);
  };

  const NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  const ERC20_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 value) returns (bool)'
  ];

  /* ---------- first liquidity for an ERC-20 on Base / BNB Chain ----------
     A token deployed on Base or BNB Chain has no pool until someone adds one: this creates the
     token/ETH (or token/BNB) pool on Uniswap V2 / PancakeSwap V2 from the creator's wallet. */
  const V2 = {
    base: { name: 'Uniswap', router: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24', factory: '0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6', weth: '0x4200000000000000000000000000000000000006',
      page: (t) => `https://app.uniswap.org/explore/tokens/base/${t}` },
    bnb: { name: 'PancakeSwap', router: '0x10ED43C718714eb63d5aA57B78B54704E256024E', factory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73', weth: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      page: (t) => `https://pancakeswap.finance/swap?outputCurrency=${t}` }
  };
  const DEAD = '0x000000000000000000000000000000000000dEaD';
  const POOL_ABI = ['function balanceOf(address) view returns (uint256)', 'function totalSupply() view returns (uint256)', 'function decimals() view returns (uint8)',
    'function allowance(address owner, address spender) view returns (uint256)', 'function approve(address spender, uint256 value) returns (bool)'];
  /* the owner's balance, the supply, and whether a pool with liquidity already exists */
  const poolInfo = async (chain, token, owner) => {
    const ethers = await lib('ethers');
    const p = new ethers.JsonRpcProvider(EVM[chain].rpc, EVM[chain].id, { staticNetwork: true });
    const erc = new ethers.Contract(token, POOL_ABI, p);
    const factory = new ethers.Contract(V2[chain].factory, ['function getPair(address,address) view returns (address)'], p);
    const [supply, decimals, balance, pair] = await Promise.all([erc.totalSupply(), erc.decimals(), owner ? erc.balanceOf(owner) : 0n, factory.getPair(token, V2[chain].weth)]);
    let liquid = false;
    if (pair !== ethers.ZeroAddress) {
      const [r0, r1] = await new ethers.Contract(pair, ['function getReserves() view returns (uint112,uint112,uint32)'], p).getReserves();
      liquid = r0 > 0n && r1 > 0n;
    }
    return { supply, decimals: Number(decimals), balance, pair, liquid, dex: V2[chain].name, page: V2[chain].page(token) };
  };
  const addLiquidity = async (chain, token, { pct, native, burn }, step) => {
    const ethers = await lib('ethers');
    const acct = await connectEvm();
    step(`Switching wallet to ${EVM[chain].name}`);
    await switchChain(chain);
    const signer = await new ethers.BrowserProvider(evmProvider()).getSigner();
    const v2 = V2[chain];
    const erc = new ethers.Contract(token, POOL_ABI, signer);
    const info = await poolInfo(chain, token, acct.address);
    if (info.liquid) throw new Error(`This token already has a ${v2.name} pool — add to it on ${v2.name}`);
    const amount = info.balance * BigInt(Math.round(pct * 100)) / 10000n;
    if (amount === 0n) throw new Error('This wallet holds none of this token');
    const value = ethers.parseEther(String(native));
    try {
      if ((await erc.allowance(acct.address, v2.router)) < amount) {
        step(`Approve the token for ${v2.name}`);
        await (await erc.approve(v2.router, amount)).wait(1);
      }
      step(`Add liquidity on ${v2.name} in your wallet`);
      const router = new ethers.Contract(v2.router, ['function addLiquidityETH(address token, uint256 amountTokenDesired, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) payable returns (uint256, uint256, uint256)'], signer);
      // a new pool takes the amounts as given, so the minimums are those amounts (1% margin)
      const tx = await router.addLiquidityETH(token, amount, amount * 99n / 100n, value * 99n / 100n, burn ? DEAD : acct.address, Math.floor(Date.now() / 1000) + 1200, { value });
      step('Waiting for confirmation');
      const rcpt = await tx.wait(1);
      if (!rcpt || rcpt.status !== 1) throw Object.assign(new Error('Adding liquidity reverted'), { signature: tx.hash });
      return { hash: tx.hash, page: info.page };
    } catch (e) {
      if (e?.signature) throw e;
      if (e?.code === 'ACTION_REJECTED') throw new Error('Rejected in the wallet');
      if (e?.code === 'INSUFFICIENT_FUNDS' || /insufficient funds/i.test(e?.message || '')) throw new Error(`Not enough ${EVM[chain].unit} for this amount and gas`);
      throw new Error(e?.shortMessage || e?.message || 'Adding liquidity failed');
    }
  };

  /* ---------- Pons bonding curve (Robinhood Chain) ----------
     Each Pons token trades on its own curve contract until it graduates. A token fresh off the
     launchpad isn't on the aggregator yet, so its trades go straight to the curve. */
  const PONS_CURVE_ABI = [
    'function token() view returns (address)', 'function graduated() view returns (bool)',
    'function buy(uint256 amountIn, uint256 minOut, address to) payable returns (uint256)',
    'function sell(uint256 amountIn, uint256 minOut, address to) returns (uint256)'
  ];
  const PONS_ADDRS = ['0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e', '0xe33e9e479df8802cb0866d5d05258bec4cf62948'];
  const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  const ZERO_TOPIC = '0x' + '0'.repeat(64);
  const ponsCurves = {};
  /* the curve shows up in the token's launch transaction: it is the log emitter whose token() is this token */
  const findPonsCurve = async (token, launchTx) => {
    const key = token.toLowerCase();
    if (ponsCurves[key]) return ponsCurves[key];
    let tx = launchTx;
    if (!tx) {   // not our launch: find the token's mint (Transfer from 0x0), newest blocks first
      const head = parseInt(await evmRpc('rh', 'eth_blockNumber', []), 16);
      for (let to = head, i = 0; !tx && i < 40 && to > 0; i++, to -= 50000) {
        const logs = await evmRpc('rh', 'eth_getLogs', [{ address: token, topics: [TRANSFER_TOPIC, ZERO_TOPIC], fromBlock: '0x' + Math.max(0, to - 50000).toString(16), toBlock: '0x' + to.toString(16) }]).catch(() => []);
        if (logs?.length) tx = logs[0].transactionHash;
      }
    }
    if (!tx) return null;
    const rc = await evmRpc('rh', 'eth_getTransactionReceipt', [tx]);
    const cands = [...new Set((rc?.logs || []).map((l) => l.address.toLowerCase()))].filter((a) => a !== key && !PONS_ADDRS.includes(a));
    for (const a of cands) {
      const r = await evmRpc('rh', 'eth_call', [{ to: a, data: '0xfc0c546a' }, 'latest']).catch(() => null);   // token()
      if (r && r.length >= 66 && '0x' + r.slice(-40) === key) return (ponsCurves[key] = a);
    }
    return null;
  };

  const tradePonsCurve = async (ethers, signer, acct, token, side, amountIn, opts, step) => {
    step('Trading on the Pons bonding curve');
    const curveAddr = await findPonsCurve(token, opts.launchTx);
    if (!curveAddr) throw new Error('No route for this token yet — try again in a few minutes');
    const curve = new ethers.Contract(curveAddr, PONS_CURVE_ABI, signer);
    if (await curve.graduated().catch(() => false)) throw new Error('This token has left the Pons curve; its pool can be traded once the aggregator lists it');
    if (side === 'sell') {
      const erc20 = new ethers.Contract(token, ERC20_ABI, signer);
      if ((await erc20.allowance(acct.address, curveAddr)) < amountIn) {
        step('Approve the token for the Pons curve');
        await (await erc20.approve(curveAddr, amountIn)).wait(1);
      }
    }
    // the curve returns what it would pay: that sets the slippage floor
    const quoted = side === 'buy'
      ? await curve.buy.staticCall(amountIn, 0n, acct.address, { value: amountIn })
      : await curve.sell.staticCall(amountIn, 0n, acct.address);
    const minOut = quoted * (10000n - BigInt(Math.round((opts.slippage || 10) * 100))) / 10000n;
    step(side === 'buy' ? 'Approve the buy in your wallet' : 'Approve the sale in your wallet');
    const tx = side === 'buy'
      ? await curve.buy(amountIn, minOut, acct.address, { value: amountIn })
      : await curve.sell(amountIn, minOut, acct.address);
    step('Waiting for confirmation');
    const rcpt = await tx.wait(1);
    if (!rcpt || rcpt.status !== 1) throw Object.assign(new Error('Trade reverted'), { signature: tx.hash });
    return tx.hash;
  };

  /* Robinhood Chain, Base, BNB: route from the aggregator, sent by the user's wallet.
     Buy: value = native amount (ETH/BNB). Sell: value = % of the wallet's tokens. */
  const tradeEvm = async (chain, token, side, value, opts, step) => {
    const ethers = await lib('ethers');
    const acct = await connectEvm();
    step(`Switching wallet to ${EVM[chain].name}`);
    await switchChain(chain);
    const provider = new ethers.BrowserProvider(evmProvider());
    const signer = await provider.getSigner();
    const erc20 = new ethers.Contract(token, ERC20_ABI, signer);
    let amountIn;
    if (side === 'buy') amountIn = ethers.parseEther(String(value));
    else {
      const bal = await erc20.balanceOf(acct.address);
      amountIn = bal * BigInt(Math.round(value)) / 100n;
      if (amountIn === 0n) throw new Error('This wallet holds none of this token');
    }
    step('Finding the best route');
    const qs = new URLSearchParams({ chain, tokenIn: side === 'buy' ? NATIVE : token.toLowerCase(), tokenOut: side === 'buy' ? token.toLowerCase() : NATIVE, amountIn: amountIn.toString() });
    let built = null;
    try {
      const quote = await api(`/api/evm/quote?${qs}`);
      built = await postJson('/api/evm/build', { chain, routeSummary: quote.routeSummary, sender: acct.address, slippageBps: Math.round((opts.slippage || 10) * 100) });
    } catch (e) {
      if (chain !== 'rh') throw e;   // on Robinhood Chain a fresh Pons token trades on its curve instead
    }
    try {
      if (!built) return await tradePonsCurve(ethers, signer, acct, token, side, amountIn, opts, step);
      if (side === 'sell') {
        const allowed = await erc20.allowance(acct.address, built.to);
        if (allowed < amountIn) {
          step('Approve the token for the swap router');
          const ap = await erc20.approve(built.to, amountIn);
          await ap.wait(1);
        }
      }
      step('Approve the swap in your wallet');
      const tx = await signer.sendTransaction({ to: built.to, data: built.data, value: side === 'buy' ? amountIn : 0n });
      step('Waiting for confirmation');
      const rcpt = await tx.wait(1);
      if (!rcpt || rcpt.status !== 1) throw Object.assign(new Error('Swap reverted'), { signature: tx.hash });
      return tx.hash;
    } catch (e) {
      if (e?.signature) throw e;
      if (e?.code === 'ACTION_REJECTED') throw new Error('Rejected in the wallet');
      if (e?.code === 'INSUFFICIENT_FUNDS' || /insufficient funds/i.test(e?.message || '')) throw new Error(`Not enough ${EVM[chain].unit} for this trade and gas`);
      throw new Error(e?.shortMessage || e?.message || 'Swap failed');
    }
  };

  /* ---------- sign in with a wallet ---------- */

  const authed = async (method, token, body) => {
    const r = await fetch('/api/account', {
      method, headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined
    }).catch(() => { throw new Error('AnyChain server unreachable'); });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || `HTTP ${r.status}`), { status: r.status });
    return j;
  };
  const getAccount = (token) => authed('GET', token);
  const putAccount = (token, data) => authed('PUT', token, data);

  const signIn = async (kind, address) => {
    const { message, nonce } = await postJson('/api/auth/nonce', { kind, address });
    let signature, signedMessage;
    try {
      if (kind === 'sol' && typeof solProvider()?.signIn === 'function') {
        /* Sign In With Solana: the wallet shows "Sign in to <this site>" and binds the message to our domain */
        const out = await solProvider().signIn({
          domain: location.host, address, uri: location.origin, version: '1', chainId: 'mainnet', nonce,
          issuedAt: new Date().toISOString(),
          statement: 'Sign in to AnyChain to sync your launches across devices. Free, and it does not move any funds.'
        });
        signedMessage = b64(new Uint8Array(out.signedMessage));
        signature = b64(new Uint8Array(out.signature));
      } else if (kind === 'sol') {
        const res = await solProvider().signMessage(new TextEncoder().encode(message), 'utf8');
        const bytes = res?.signature || res;
        signature = b64(new Uint8Array(bytes));
      } else {
        const hex = '0x' + [...new TextEncoder().encode(message)].map((x) => x.toString(16).padStart(2, '0')).join('');
        signature = await evmProvider().request({ method: 'personal_sign', params: [hex, address] });
      }
    } catch (e) {
      throw new Error(e?.code === 4001 ? 'Signature rejected in the wallet' : (e?.message || 'Wallet could not sign'));
    }
    return postJson('/api/auth/verify', { kind, address, signature, signedMessage });
  };

  /* ---------- links ---------- */

  const explorerTx = (chain, sig) => (chain === 'sol' ? `https://solscan.io/tx/${sig}` : `${EVM[chain].explorer}/tx/${sig}`);
  const explorerToken = (chain, addr) => (chain === 'sol' ? `https://solscan.io/token/${addr}` : `${EVM[chain].explorer}/token/${addr}`);
  const DEX_IDS = { sol: 'solana', rh: 'robinhood', base: 'base', bnb: 'bsc' };
  const dexEmbed = (chain, addr, light) =>
    `https://dexscreener.com/${DEX_IDS[chain]}/${addr}?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&chartLeftToolbar=0&chartDefaultOnMobile=1&chartTheme=${light ? 'light' : 'dark'}&theme=${light ? 'light' : 'dark'}&chartStyle=1&chartType=usd&interval=15`;
  const dexscreener = (chain, addr) => `https://dexscreener.com/${{ sol: 'solana', rh: 'robinhood', base: 'base', bnb: 'bsc' }[chain]}/${addr}`;

  /* the public list of tokens launched from AnyChain; the server verifies each one on-chain */
  /* resolves to 'listed', 'rejected' (the server read the chain and it isn't a launch) or 'retry' */
  const reportLaunch = (l) => postJson('/api/launches', l).then(() => 'listed',
    (e) => (/did not create|Bad address|Unknown launchpad/.test(e.message) ? 'rejected' : 'retry'));
  const publicLaunches = () => api('/api/launches');

  window.VelaChain = {
    EVM, health, prices, market,
    connectSol, disconnectSol, connectEvm, disconnectEvm, onAccountsChanged,
    hasSol: () => !!solProvider(), hasEvm: () => !!evmProvider(),
    solBalance, solTokenBalance, evmBalance, evmTokenBalance,
    launchPump, sellPump, launchEvm, launchPons, ponsPage, uploadImage,
    signIn, getAccount, putAccount, tradeSol, tradeEvm, FEE, feeOf, reportLaunch, publicLaunches, poolInfo, addLiquidity,
    explorerTx, explorerToken, dexscreener, dexEmbed
  };
})();
