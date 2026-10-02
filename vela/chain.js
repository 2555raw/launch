/* Vela — wallets and chains.
   Everything that touches a wallet or a chain lives here, behind window.VelaChain.
   The user's wallet signs every transaction; nothing here ever sees a private key.
   The only key Vela makes is the throwaway mint keypair for a new pump.fun token,
   which co-signs its own creation and is then discarded. */

(() => {
  'use strict';

  /* Served from vendor/ (unmodified builds from npm), loaded only when first needed. */
  const LIBS = {
    solana: 'vendor/solana-web3-1.99.0.min.js',
    ethers: 'vendor/ethers-6.17.0.min.js'
  };
  const GLOBALS = { solana: 'solanaWeb3', ethers: 'ethers' };

  /* EVM chains Vela deploys to. Reads go to public RPCs, so balances on all three
     show without switching the wallet's network. */
  const EVM = {
    eth:  { id: 1,    hex: '0x1',    name: 'Ethereum',  unit: 'ETH', rpc: 'https://ethereum-rpc.publicnode.com', explorer: 'https://etherscan.io' },
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
    try { r = await fetch(path, opts); } catch (_) { throw new Error('Vela server unreachable'); }
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

  const sendAndConfirm = async (tx, step) => {
    step('Sending transaction');
    /* 'processed': PumpPortal's blockhash is seconds old, and a 'confirmed' preflight
       rejects it as unknown (BlockhashNotFound) on most RPC nodes. */
    const sig = await solRpc('sendTransaction', [b64(tx.serialize()), { encoding: 'base64', preflightCommitment: 'processed', maxRetries: 5 }]);
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

  const walletSign = async (tx) => {
    const p = solProvider();
    try { return await p.signTransaction(tx); } catch (e) {
      throw new Error(e?.code === 4001 ? 'Rejected in the wallet' : (e?.message || 'Wallet could not sign'));
    }
  };

  /* Create a pump.fun token: metadata to IPFS, unsigned tx from PumpPortal, the
     wallet signs as payer, the fresh mint keypair signs as the token account. */
  const launchPump = async (opts, step) => {
    const web3 = await lib('solana');
    const sol = await connectSol();
    step('Uploading image and metadata to IPFS');
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
    const tx = web3.VersionedTransaction.deserialize(new Uint8Array(bytes));
    step('Approve the launch in your wallet');
    const signed = await walletSign(tx);
    signed.sign([mint]);   // after the wallet, so the mint signs exactly what will be sent
    const signature = await sendAndConfirm(signed, step);
    return { address: mint.publicKey.toBase58(), signature, owner: sol.address, image };
  };

  const sellPump = async (mintAddr, percent, step) => {
    const web3 = await lib('solana');
    const sol = await connectSol();
    step('Building the sell transaction');
    const bytes = await postJson('/api/pump/sell', { publicKey: sol.address, mint: mintAddr, percent });
    const tx = web3.VersionedTransaction.deserialize(new Uint8Array(bytes));
    step('Approve the sale in your wallet');
    const signed = await walletSign(tx);
    return sendAndConfirm(signed, step);
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

  /* ---------- links ---------- */

  const explorerTx = (chain, sig) => (chain === 'sol' ? `https://solscan.io/tx/${sig}` : `${EVM[chain].explorer}/tx/${sig}`);
  const explorerToken = (chain, addr) => (chain === 'sol' ? `https://solscan.io/token/${addr}` : `${EVM[chain].explorer}/token/${addr}`);
  const dexscreener = (chain, addr) => `https://dexscreener.com/${{ sol: 'solana', eth: 'ethereum', base: 'base', bnb: 'bsc' }[chain]}/${addr}`;

  window.VelaChain = {
    EVM, health, prices, market,
    connectSol, disconnectSol, connectEvm, disconnectEvm, onAccountsChanged,
    hasSol: () => !!solProvider(), hasEvm: () => !!evmProvider(),
    solBalance, solTokenBalance, evmBalance, evmTokenBalance,
    launchPump, sellPump, launchEvm,
    explorerTx, explorerToken, dexscreener
  };
})();
