/* On-chain: how much $SEEKR a wallet holds, and whether a deposit reached the
 * treasury. Everything here reads
 * public state; the server never holds a private key. */
const { JsonRpcProvider, Contract, formatUnits, getAddress, Interface } = require('ethers');
const config = require('./config');
const markets = require('./markets');

const ERC20 = ['function balanceOf(address) view returns (uint256)', 'function totalSupply() view returns (uint256)', 'function name() view returns (string)', 'function symbol() view returns (string)', 'function decimals() view returns (uint8)', 'event Transfer(address indexed from, address indexed to, uint256 value)'];
const erc20Iface = new Interface(ERC20);

let rh = null;
let eth = null;
const rhProvider = () => rh || (rh = new JsonRpcProvider(config.chain.rhRpc, config.chain.rhChainId, { staticNetwork: true }));
const ethProvider = () => eth || (eth = new JsonRpcProvider(config.chain.ethRpc, 1, { staticNetwork: true }));

const holdingsConfigured = () => Boolean(config.chain.rhRpc && config.chain.seekrToken);

/* percentage of supply held by an address, e.g. 0.0125 (= 0.0125%) */
async function holdingsPct(address) {
  if (!holdingsConfigured()) return null;
  const c = new Contract(config.chain.seekrToken, ERC20, rhProvider());
  const [bal, supply] = await Promise.all([c.balanceOf(address), c.totalSupply().catch(() => null)]);
  const total = supply ? Number(formatUnits(supply, config.chain.seekrDecimals)) : config.chain.seekrSupply;
  const held = Number(formatUnits(bal, config.chain.seekrDecimals));
  return { pct: (held / total) * 100, held, total };
}

/* ---------- deposits ---------- */
const depositsConfigured = () => ({ eth: Boolean(config.chain.treasury.eth), sol: Boolean(config.chain.treasury.sol), btc: Boolean(config.chain.treasury.btc) });

/* ETH or USDT sent to the treasury on Ethereum mainnet */
async function verifyEvm(txHash) {
  const treasury = getAddress(config.chain.treasury.eth);
  const p = ethProvider();
  const [tx, rc] = await Promise.all([p.getTransaction(txHash), p.getTransactionReceipt(txHash)]);
  if (!tx || !rc) throw Object.assign(new Error('Transaction not found yet. Give it a minute and try again.'), { status: 404 });
  if (rc.status !== 1) throw Object.assign(new Error('That transaction reverted'), { status: 400 });
  const conf = (await p.getBlockNumber()) - rc.blockNumber + 1;
  if (conf < config.chain.minConfirmations) throw Object.assign(new Error(`Waiting for confirmations (${conf}/${config.chain.minConfirmations})`), { status: 425 });

  if (tx.to && getAddress(tx.to) === treasury && tx.value > 0n) {
    const amount = Number(formatUnits(tx.value, 18));
    return { chain: 'ethereum', asset: 'ETH', amount, usd: amount * (await markets.usdPrice('ETH')), from: tx.from };
  }
  for (const log of rc.logs) {
    if (getAddress(log.address) !== getAddress(config.chain.usdtErc20)) continue;
    let parsed;
    try { parsed = erc20Iface.parseLog(log); } catch { continue; }
    if (parsed?.name === 'Transfer' && getAddress(parsed.args.to) === treasury) {
      const amount = Number(formatUnits(parsed.args.value, 6));
      return { chain: 'ethereum', asset: 'USDT', amount, usd: amount, from: parsed.args.from };
    }
  }
  throw Object.assign(new Error('That transaction did not send ETH or USDT to the treasury'), { status: 400 });
}

/* SOL sent to the treasury */
async function verifySol(signature) {
  const treasury = config.chain.treasury.sol;
  const r = await fetch(config.chain.solRpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransaction', params: [signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }] }) });
  const j = await r.json();
  const tx = j.result;
  if (!tx) throw Object.assign(new Error('Transaction not found yet. Give it a minute and try again.'), { status: 404 });
  if (tx.meta?.err) throw Object.assign(new Error('That transaction failed'), { status: 400 });
  const keys = tx.transaction.message.accountKeys.map((k) => (typeof k === 'string' ? k : k.pubkey));
  const idx = keys.indexOf(treasury);
  if (idx < 0) throw Object.assign(new Error('That transaction does not touch the treasury'), { status: 400 });
  const lamports = tx.meta.postBalances[idx] - tx.meta.preBalances[idx];
  if (lamports <= 0) throw Object.assign(new Error('The treasury received nothing in that transaction'), { status: 400 });
  const amount = lamports / 1e9;
  return { chain: 'solana', asset: 'SOL', amount, usd: amount * (await markets.usdPrice('SOL')), from: keys[0] };
}

/* BTC sent to the treasury, via a mempool.space compatible API */
async function verifyBtc(txid) {
  const treasury = config.chain.treasury.btc;
  const r = await fetch(`${config.chain.btcApi}/tx/${txid}`, { signal: AbortSignal.timeout(8000) });
  if (r.status === 404) throw Object.assign(new Error('Transaction not found yet. Give it a minute and try again.'), { status: 404 });
  if (!r.ok) throw Object.assign(new Error(`Could not look up that transaction (${r.status})`), { status: 502 });
  const tx = await r.json();
  if (!tx.status?.confirmed && config.chain.minConfirmations > 0) throw Object.assign(new Error('Waiting for the first confirmation'), { status: 425 });
  const sats = tx.vout.filter((o) => o.scriptpubkey_address === treasury).reduce((n, o) => n + o.value, 0);
  if (!sats) throw Object.assign(new Error('That transaction did not pay the treasury'), { status: 400 });
  const amount = sats / 1e8;
  return { chain: 'bitcoin', asset: 'BTC', amount, usd: amount * (await markets.usdPrice('BTC')), from: tx.vin[0]?.prevout?.scriptpubkey_address || null };
}

async function verifyDeposit(chain, ref) {
  const c = depositsConfigured();
  if (chain === 'ethereum' && c.eth) return verifyEvm(ref);
  if (chain === 'solana' && c.sol) return verifySol(ref);
  if (chain === 'bitcoin' && c.btc) return verifyBtc(ref);
  throw Object.assign(new Error(`${chain} deposits are not configured on this server`), { status: 503 });
}

/* boot check of the configured $SEEKR contract: what the chain says it is, and whether DexScreener has a pair */
async function tokenCheck() {
  const addr = config.chain.seekrToken;
  if (!addr) return null;
  const out = [];
  try {
    const c = new Contract(addr, ERC20, rhProvider());
    const [name, symbol, dec, supply] = await Promise.all([c.name(), c.symbol(), c.decimals(), c.totalSupply()]);
    out.push(`on chain ${config.chain.rhChainId}: ${name} (${symbol}), ${dec} decimals, supply ${Number(formatUnits(supply, dec)).toLocaleString('en-US')}${Number(dec) !== config.chain.seekrDecimals ? ` · WARNING: SEEKR_DECIMALS is ${config.chain.seekrDecimals}` : ''}`);
  } catch (e) { out.push(`chain read failed: ${e.shortMessage || e.message}`); }
  try {
    const { seekr: s } = await markets.snapshot();
    out.push(s.live ? `dexscreener: ${s.chainId}/${s.dexId} price $${s.price} · liquidity $${Math.round(s.liquidity || 0)} · mcap $${Math.round(s.mcap || 0)} · ${s.url}` : 'dexscreener: no pair yet');
  } catch (e) { out.push('dexscreener failed: ' + e.message); }
  return `${addr} · ${out.join(' · ')}`;
}

module.exports = { tokenCheck, holdingsConfigured, holdingsPct, depositsConfigured, verifyDeposit };
