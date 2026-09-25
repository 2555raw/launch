/* On-chain: how much $ASKR a wallet holds, and whether a deposit reached the
 * treasury. Plus card top-ups through Stripe Checkout. Everything here reads
 * public state; the server never holds a private key. */
const crypto = require('crypto');
const { JsonRpcProvider, Contract, formatUnits, getAddress, Interface } = require('ethers');
const config = require('./config');
const markets = require('./markets');

const ERC20 = ['function balanceOf(address) view returns (uint256)', 'function totalSupply() view returns (uint256)', 'event Transfer(address indexed from, address indexed to, uint256 value)'];
const erc20Iface = new Interface(ERC20);

let rh = null;
let eth = null;
const rhProvider = () => rh || (rh = new JsonRpcProvider(config.chain.rhRpc, config.chain.rhChainId, { staticNetwork: true }));
const ethProvider = () => eth || (eth = new JsonRpcProvider(config.chain.ethRpc, 1, { staticNetwork: true }));

const holdingsConfigured = () => Boolean(config.chain.rhRpc && config.chain.askrToken);

/* percentage of supply held by an address, e.g. 0.0125 (= 0.0125%) */
async function holdingsPct(address) {
  if (!holdingsConfigured()) return null;
  const c = new Contract(config.chain.askrToken, ERC20, rhProvider());
  const [bal, supply] = await Promise.all([c.balanceOf(address), c.totalSupply().catch(() => null)]);
  const total = supply ? Number(formatUnits(supply, config.chain.askrDecimals)) : config.chain.askrSupply;
  const held = Number(formatUnits(bal, config.chain.askrDecimals));
  return { pct: (held / total) * 100, held, total };
}

/* ---------- deposits ---------- */
const depositsConfigured = () => ({ eth: Boolean(config.chain.treasury.eth), sol: Boolean(config.chain.treasury.sol), btc: Boolean(config.chain.treasury.btc), card: Boolean(config.stripe.secret) });

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

/* ---------- Stripe (card) ---------- */
async function stripe(path, params) {
  const body = new URLSearchParams();
  const add = (k, v) => { if (v && typeof v === 'object') Object.entries(v).forEach(([kk, vv]) => add(`${k}[${kk}]`, vv)); else body.append(k, String(v)); };
  Object.entries(params).forEach(([k, v]) => add(k, v));
  const r = await fetch(`https://api.stripe.com/v1/${path}`, { method: 'POST', headers: { Authorization: `Bearer ${config.stripe.secret}`, 'content-type': 'application/x-www-form-urlencoded' }, body });
  const j = await r.json();
  if (!r.ok) throw Object.assign(new Error(j.error?.message || 'Stripe error'), { status: 502 });
  return j;
}

async function cardCheckout(account, usd, origin) {
  if (!config.stripe.secret) throw Object.assign(new Error('Card payments are not configured on this server'), { status: 503 });
  const amount = Math.round(usd * 100);
  if (amount < 500) throw Object.assign(new Error('Minimum card top-up is $5'), { status: 400 });
  const s = await stripe('checkout/sessions', {
    mode: 'payment',
    success_url: `${origin}/ask#account?paid=1`,
    cancel_url: `${origin}/ask#account`,
    client_reference_id: account.id,
    'metadata[account]': account.id,
    'metadata[usd]': usd,
    'line_items[0][quantity]': 1,
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': amount,
    'line_items[0][price_data][product_data][name]': `askr credits — ${(usd * config.creditsPerUsd).toLocaleString()} credits`
  });
  return { url: s.url, id: s.id };
}

/* verify Stripe-Signature and return the event, or throw */
function stripeEvent(rawBody, sigHeader) {
  const parts = Object.fromEntries((sigHeader || '').split(',').map((p) => p.split('=')));
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) throw Object.assign(new Error('Missing signature'), { status: 400 });
  const expected = crypto.createHmac('sha256', config.stripe.webhookSecret).update(`${t}.${rawBody}`).digest('hex');
  if (expected.length !== v1.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1))) throw Object.assign(new Error('Bad signature'), { status: 400 });
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) throw Object.assign(new Error('Stale signature'), { status: 400 });
  return JSON.parse(rawBody);
}

module.exports = { holdingsConfigured, holdingsPct, depositsConfigured, verifyDeposit, cardCheckout, stripeEvent };
