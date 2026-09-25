/* Swaps through LI.FI: any token to any token, on one chain or across chains
 * (EVM chains and Solana). The server only relays read-only calls — chains,
 * token lists, quotes, status, balances. Transactions are built by LI.FI and
 * signed in the user's own wallet; seekr never holds funds or keys.
 *   LIFI_API_KEY  optional, raises LI.FI rate limits
 *   SWAP_FEE      optional integrator fee, e.g. 0.0025 (needs a LI.FI integrator set up) */
const { JsonRpcProvider, Contract, formatUnits } = require('ethers');
const config = require('./config');

const BASE = process.env.LIFI_BASE || 'https://li.quest/v1';
const KEY = process.env.LIFI_API_KEY || '';
const FEE = Number(process.env.SWAP_FEE || 0);
const INTEGRATOR = process.env.SWAP_INTEGRATOR || 'seekr';
const SOLANA_ID = 1151111081099710;

const cache = new Map();
async function cached(key, ttl, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.v;
  const v = await fn();
  cache.set(key, { at: Date.now(), v });
  return v;
}

async function lifi(path, params) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params || {})) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  const r = await fetch(url, { headers: { accept: 'application/json', ...(KEY ? { 'x-lifi-api-key': KEY } : {}) }, signal: AbortSignal.timeout(25000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = j.message || `Swap service answered ${r.status}`;
    throw Object.assign(new Error(/no available quotes|no routes/i.test(msg) ? 'No route for this pair right now. Try another amount or token.' : msg), { status: r.status === 404 ? 404 : r.status === 429 ? 429 : 502 });
  }
  return j;
}

/* chains people actually use first, then everything else LI.FI offers */
const FEATURED = [1, 8453, 42161, 10, 137, 56, 43114, SOLANA_ID, 324, 59144, 534352, 100];
async function chains() {
  return cached('chains', 60 * 60 * 1000, async () => {
    const j = await lifi('/chains', { chainTypes: 'EVM,SVM' });
    const list = (j.chains || []).filter((c) => c.mainnet !== false).map((c) => ({
      id: c.id, key: c.key, name: c.name, type: c.chainType, logo: c.logoURI, native: c.nativeToken,
      explorer: (c.metamask && c.metamask.blockExplorerUrls && c.metamask.blockExplorerUrls[0]) || null,
      metamask: c.chainType === 'EVM' ? c.metamask : null
    }));
    list.sort((a, b) => (FEATURED.indexOf(a.id) + 1 || 999) - (FEATURED.indexOf(b.id) + 1 || 999) || a.name.localeCompare(b.name));
    return list;
  });
}

const MAJORS = ['ETH', 'SOL', 'BNB', 'POL', 'MATIC', 'AVAX', 'USDC', 'USDT', 'WETH', 'WBTC', 'CBBTC', 'DAI', 'WSOL', 'JUP', 'USDC.E', 'LINK', 'UNI', 'AAVE', 'ARB', 'OP', 'PAXG', 'XAUT', 'BONK', 'JITOSOL', 'MSOL', 'PEPE', 'SHIB', 'LDO', 'MKR', 'CRV', 'SNX', 'COMP', 'GRT', 'RNDR', 'FET', 'ENA', 'USDE', 'PYUSD', 'FDUSD', 'EURC'];
async function tokens(chainId) {
  return cached('tokens:' + chainId, 15 * 60 * 1000, async () => {
    const j = await lifi('/tokens', { chains: chainId, chainTypes: 'EVM,SVM' });
    const list = (j.tokens && (j.tokens[chainId] || Object.values(j.tokens)[0])) || [];
    /* LI.FI lists everything, junk included: drop tokens whose price cannot be real,
       then order like a wallet would: the native coin, stablecoins, majors, then
       known coins with a logo, then the rest */
    const rank = (t) => {
      const i = MAJORS.indexOf(t.symbol.toUpperCase());
      if (i >= 0) return i;
      if (t.coinKey && t.logo) return 100;
      if (t.logo) return 200;
      return 300;
    };
    return list.map((t) => ({ address: t.address, chainId: t.chainId, symbol: t.symbol, name: t.name, decimals: t.decimals, logo: t.logoURI, priceUSD: t.priceUSD ? Number(t.priceUSD) : null, coinKey: t.coinKey || null }))
      .filter((t) => !(t.priceUSD > 250000) || /BTC/i.test(t.symbol))
      .map((t) => ({ ...t, popular: MAJORS.slice(0, 14).includes(t.symbol.toUpperCase()) }))
      .sort((a, b) => rank(a) - rank(b) || (b.priceUSD ? 1 : 0) - (a.priceUSD ? 1 : 0));
  });
}

/* real-world assets: tokenized gold, treasuries and stocks, from LI.FI's own lists */
const RWA = {
  gold: ['PAXG', 'XAUT', 'XAUt'],
  treasuries: ['USDY', 'OUSG', 'BUIDL', 'USTB', 'TBILL'],
  stocks: ['TSLAx', 'AAPLx', 'NVDAx', 'SPYx', 'QQQx', 'GOOGLx', 'METAx', 'MSFTx', 'AMZNx', 'MSTRx', 'COINx', 'HOODx', 'CRCLx', 'NFLXx', 'AMDx']
};
async function rwa() {
  return cached('rwa', 30 * 60 * 1000, async () => {
    const ids = [1, 42161, 8453, 137, 56, SOLANA_ID];
    const out = [];
    for (const id of ids) {
      let list = [];
      try { list = await tokens(id); } catch { continue; }
      for (const t of list) {
        const kind = RWA.gold.includes(t.symbol) ? 'Gold' : RWA.treasuries.includes(t.symbol) ? 'Treasuries' : RWA.stocks.includes(t.symbol) && /xstock/i.test(t.name) ? 'Stocks' : null;
        if (kind) out.push({ ...t, kind });
      }
    }
    return out;
  });
}

async function token(chain, addr) {
  const t = await lifi('/token', { chain, token: addr });
  return { address: t.address, chainId: t.chainId, symbol: t.symbol, name: t.name, decimals: t.decimals, logo: t.logoURI, priceUSD: t.priceUSD ? Number(t.priceUSD) : null };
}

async function quote(q) {
  const params = {
    fromChain: q.fromChain, toChain: q.toChain, fromToken: q.fromToken, toToken: q.toToken,
    fromAmount: q.fromAmount, fromAddress: q.fromAddress, toAddress: q.toAddress || q.fromAddress,
    slippage: Math.min(0.2, Math.max(0.0005, Number(q.slippage) || 0.005)),
    integrator: INTEGRATOR, order: 'CHEAPEST'
  };
  if (FEE > 0) params.fee = FEE;
  if (!/^\d+$/.test(String(params.fromAmount || ''))) throw Object.assign(new Error('Enter an amount'), { status: 400 });
  const j = await lifi('/quote', params);
  const e = j.estimate || {};
  const sum = (arr) => (arr || []).reduce((n, c) => n + Number(c.amountUSD || 0), 0);
  return {
    id: j.id, tool: j.tool, toolName: j.toolDetails && j.toolDetails.name, toolLogo: j.toolDetails && j.toolDetails.logoURI,
    fromToken: j.action.fromToken, toToken: j.action.toToken, fromChainId: j.action.fromChainId, toChainId: j.action.toChainId,
    fromAmount: e.fromAmount, toAmount: e.toAmount, toAmountMin: e.toAmountMin, approvalAddress: e.approvalAddress,
    fromAmountUSD: e.fromAmountUSD, toAmountUSD: e.toAmountUSD, gasUSD: sum(e.gasCosts), feeUSD: sum(e.feeCosts),
    duration: e.executionDuration, steps: (j.includedSteps || []).map((s) => ({ type: s.type, tool: s.toolDetails && s.toolDetails.name })),
    tx: j.transactionRequest
  };
}

async function status(q) {
  return lifi('/status', { txHash: q.txHash, bridge: q.bridge, fromChain: q.fromChain, toChain: q.toChain });
}

/* balances: EVM through the chain's public RPC, Solana through its RPC */
const ERC20 = ['function balanceOf(address) view returns (uint256)'];
const providers = new Map();
async function balance({ chain, address, token }) {
  const id = Number(chain);
  if (id === SOLANA_ID) return solBalance(address, token);
  const c = (await chains()).find((x) => x.id === id);
  const rpc = c && c.metamask && c.metamask.rpcUrls && c.metamask.rpcUrls[0];
  if (!rpc) throw Object.assign(new Error('Unknown chain'), { status: 400 });
  if (!providers.has(id)) providers.set(id, new JsonRpcProvider(rpc, id, { staticNetwork: true }));
  const p = providers.get(id);
  const raw = /^0x0{40}$/i.test(token) || /^0xeeee/i.test(token) ? await p.getBalance(address) : await new Contract(token, ERC20, p).balanceOf(address);
  return { raw: raw.toString() };
}
async function solRpc(method, params) {
  const r = await fetch(config.chain.solRpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(12000) });
  const j = await r.json();
  if (j.error) throw Object.assign(new Error(j.error.message || 'Solana RPC error'), { status: 502 });
  return j.result;
}
async function solBalance(address, token) {
  if (!token || token === '11111111111111111111111111111111') return { raw: String((await solRpc('getBalance', [address])).value) };
  const res = await solRpc('getTokenAccountsByOwner', [address, { mint: token }, { encoding: 'jsonParsed' }]);
  const total = (res.value || []).reduce((n, a) => n + BigInt(a.account.data.parsed.info.tokenAmount.amount), 0n);
  return { raw: total.toString() };
}

async function probe() {
  try { const c = await chains(); return `ok (${c.length} chains)`; } catch (e) { return `FAILED (${e.message})`; }
}

module.exports = { chains, tokens, token, rwa, quote, status, balance, probe, SOLANA_ID, formatUnits };
