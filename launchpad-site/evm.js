/* BNB Chain layer: networks, the kuai factory and raise contracts (index,
 * per-buyer state, buys from Bought events), calldata for the page (the page
 * signs with MetaMask and sends), a JSON-RPC proxy with an allowlist, sign-in
 * by personal_sign, and gift-card payments in BNB or USDT to the merchant.
 *
 * Env: BSC_RPC, BSC_TESTNET_RPC, FACTORY_56, FACTORY_97, DEFAULT_CHAIN,
 * MERCHANT_ADDRESS, DEPLOYER_KEY (deploy from /admin), FEE_TO, STOCK_TEST, X_URL. */
'use strict';
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const CLUSTERS = {
  56: { name: 'BNB Chain', hex: '0x38', chainId: 56, rpc: process.env.BSC_RPC || 'https://bsc-dataseed.binance.org', explorer: 'https://bscscan.com', explorerSuffix: '', symbol: 'BNB', usdt: '0x55d398326f99059fF775485246999027B3197955', router: '0x10ED43C718714eb63d5aA57B78B54704E256024E', pcsFactory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73', wbnb: '0xbb4CdB9CBd36B01bD1cBaEF60aF814a3f6F0Ee75', cg: 'binancecoin' },
  97: { name: 'BNB Testnet', hex: '0x61', chainId: 97, rpc: process.env.BSC_TESTNET_RPC || 'https://bsc-testnet-rpc.publicnode.com', explorer: 'https://testnet.bscscan.com', explorerSuffix: '', symbol: 'tBNB', usdt: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd', router: '0xD99D1c33F9fC3444f8101754aBC46c52416550D1', pcsFactory: '0x6725F303b657a9451d8BA641348b6761A6CC7a17', wbnb: '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd', cg: 'binancecoin' },
};
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const MERCHANT = ethers.isAddress(process.env.MERCHANT_ADDRESS || '') ? ethers.getAddress(process.env.MERCHANT_ADDRESS) : '';
const X_URL = (process.env.X_URL || '').trim();
const isPk = (v) => typeof v === 'string' && ethers.isAddress(v);
const cluster = (c) => (String(c) === '56' ? '56' : String(c) === '97' ? '97' : null) || DEFAULT_CLUSTER;
const FACTORY_ABI = ['function createCoin(string name, string symbol, string restaurantId, uint256 target, uint256 durationSeconds) returns (address)', 'function count() view returns (uint256)', 'function all(uint256 from, uint256 n) view returns (address[])', 'function stockOf(string) view returns (address)', 'function enabled(string) view returns (bool)', 'function feeTo() view returns (address)', 'function setStocks(string[] ids, address[] tokens)'];
const RAISE_ABI = ['function info() view returns (address token, address payToken, string name, string symbol, string restaurantId, address creator, uint256 target, uint256 minimum, uint256 cap, uint256 openAt, uint256 closeAt, uint256 raised, uint256 closedAt, uint256 buyers, bool finalized, bool graduated)', 'function paid(address) view returns (uint256)', 'function claimable(address) view returns (uint256)', 'function claimed(address) view returns (bool)', 'function buy() payable', 'function buyWith(uint256 amount)', 'function finalize()', 'function claim()', 'function refund()', 'event Bought(address indexed buyer, uint256 amount, uint256 raised)'];
const ERC20_ABI = ['function symbol() view returns (string)', 'function decimals() view returns (uint8)', 'function balanceOf(address) view returns (uint256)', 'function allowance(address,address) view returns (uint256)', 'function approve(address,uint256) returns (bool)', 'function transfer(address,uint256) returns (bool)'];
const ROUTER_ABI = ['function getAmountsIn(uint256 amountOut, address[] path) view returns (uint256[])', 'function swapTokensForExactETH(uint256 amountOut, uint256 amountInMax, address[] path, address to, uint256 deadline) returns (uint256[])', 'function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[])', 'function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) payable returns (uint256[])', 'function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[])', 'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[])'];
const IF = { factory: new ethers.Interface(FACTORY_ABI), raise: new ethers.Interface(RAISE_ABI), erc20: new ethers.Interface(ERC20_ABI), router: new ethers.Interface(ROUTER_ABI) };
const providers = {};
const conn = (c) => providers[c] || (providers[c] = new ethers.JsonRpcProvider(CLUSTERS[c].rpc, Number(c), { staticNetwork: true }));

/* ---- factory per chain: store (set from /admin or deployed) wins over env ---- */
function programOf(c, store) { const st = store && store.programs && store.programs[c]; const env = process.env['FACTORY_' + c]; const a = st || env; return a && ethers.isAddress(a) ? ethers.getAddress(a) : null; }
const DEFAULT_CLUSTER = (() => { const d = String(process.env.DEFAULT_CHAIN || process.env.CLUSTER || ''); if (d === '56' || d === '97') return d; return process.env.FACTORY_56 ? '56' : '97'; })();
function config(store) {
  return { chain: 'bnb', paths: true, cluster: DEFAULT_CLUSTER, clusters: Object.fromEntries(Object.entries(CLUSTERS).map(([k, v]) => [k, { name: v.name, hex: v.hex, explorer: v.explorer, explorerSuffix: '', programId: programOf(k, store), usdt: v.usdt, router: v.router, wbnb: v.wbnb, symbol: v.symbol }])), rpc: '/api/rpc', merchant: MERCHANT || null, usdt: CLUSTERS[DEFAULT_CLUSTER].usdt, social: X_URL ? { x: X_URL } : {} };
}
/* sign-in: the wallet signs the nonce message with personal_sign */
function verifySignature(address, message, signature) { try { return ethers.verifyMessage(message, signature).toLowerCase() === String(address).toLowerCase(); } catch { return false; } }

/* ---- RPC proxy: the page reads and sends through the server (no public node from the browser) ---- */
const RPC_OK = new Set(['eth_chainId', 'net_version', 'eth_blockNumber', 'eth_getBalance', 'eth_call', 'eth_estimateGas', 'eth_gasPrice', 'eth_maxPriorityFeePerGas', 'eth_feeHistory', 'eth_getTransactionCount', 'eth_sendRawTransaction', 'eth_getTransactionByHash', 'eth_getTransactionReceipt', 'eth_getBlockByNumber', 'eth_getCode', 'eth_getLogs']);
async function rpcProxy(req, res, url, h) {
  const { send, fail, readJson, limited } = h; if (req.method !== 'POST') return fail(res, 405, 'POST only'); if (limited && limited(req, res)) return;
  let body; try { body = await readJson(req); } catch (e) { return fail(res, 400, e.message); }
  const c = cluster(url.searchParams.get('cluster')); const one = async (j) => { if (!j || !RPC_OK.has(j.method)) return { jsonrpc: '2.0', id: j && j.id, error: { code: -32601, message: 'method not allowed' } }; try { const r = await fetch(CLUSTERS[c].rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: j.id ?? 1, method: j.method, params: j.params || [] }), signal: AbortSignal.timeout(15000) }); return await r.json(); } catch (e) { return { jsonrpc: '2.0', id: j.id, error: { code: -32000, message: e.message } }; } };
  return send(res, 200, Array.isArray(body) ? await Promise.all(body.slice(0, 20).map(one)) : await one(body), { 'cache-control': 'no-store' });
}

/* ---- index of raises: factory.all + info(), cached 20 s ---- */
const IDX = {}; const META = {};
async function tokenMeta(c, addr) { const k = c + ':' + addr.toLowerCase(); if (!META[k]) { try { const t = new ethers.Contract(addr, ERC20_ABI, conn(c)); const [symbol, decimals] = await Promise.all([t.symbol(), t.decimals()]); META[k] = { symbol, decimals: Number(decimals) }; } catch { META[k] = { symbol: addr.slice(0, 6), decimals: 18 }; } } return META[k]; }
async function coins(c, store, force) {
  const k = c; const cur = IDX[k]; if (cur && !force && Date.now() - cur.at < 20000) return cur.data;
  const pid = programOf(c, store); if (!pid) return { programId: null, coins: [], feeTo: null };
  const p = conn(c); const f = new ethers.Contract(pid, FACTORY_ABI, p);
  const count = Number(await f.count()); const addrs = count ? await f.all(0, Math.min(count, 500)) : [];
  let feeTo = null; try { feeTo = await f.feeTo(); } catch {}
  const list = await Promise.all(addrs.map(async (a) => {
    const i = await new ethers.Contract(a, RAISE_ABI, p).info(); const native = i.payToken === ethers.ZeroAddress; const meta = native ? { symbol: CLUSTERS[c].symbol, decimals: 18 } : await tokenMeta(c, i.payToken);
    return { address: a, creator: i.creator, coinMint: i.token, payMint: native ? null : i.payToken, payDecimals: meta.decimals, paySymbol: meta.symbol, name: i.name, symbol: i.symbol, restaurant: i.restaurantId, target: i.target.toString(), raised: i.raised.toString(), min: i.minimum.toString(), cap: i.cap.toString(), openAt: Number(i.openAt), closeAt: Number(i.closeAt), closedAt: Number(i.closedAt), finalized: i.finalized, graduated: i.graduated, buyers: Number(i.buyers), poolCoin: '0', poolPay: '0', claimedTotal: '0' };
  }));
  list.sort((a, b) => b.openAt - a.openAt);
  const data = { programId: pid, coins: list, feeTo, at: Date.now() }; IDX[k] = { at: Date.now(), data }; return data;
}
/* what one buyer has in a raise: paid, claimable, claimed, allowance and balance of the pay token */
async function paidOf(c, store, raise, buyer) {
  const p = conn(c); const r = new ethers.Contract(raise, RAISE_ABI, p); const d = await coins(c, store); const rec = d.coins.find((x) => x.address.toLowerCase() === raise.toLowerCase()); if (!rec) return null;
  const [amount, claimable, claimed] = await Promise.all([r.paid(buyer), rec.graduated ? r.claimable(buyer) : 0n, rec.graduated ? r.claimed(buyer).catch(() => false) : false]);
  let allowance = null, balance = null; if (rec.payMint) { const t = new ethers.Contract(rec.payMint, ERC20_ABI, p); [allowance, balance] = await Promise.all([t.allowance(buyer, raise), t.balanceOf(buyer)]); allowance = allowance.toString(); balance = balance.toString(); }
  return { amount: amount.toString(), claimable: claimable.toString(), claimed, allowance, balance };
}

/* ---- buys from Bought events, in 5000-block windows, cached 20 s per raise ---- */
const BUYS = {}; const BOUGHT = IF.raise.getEvent('Bought').topicHash;
async function buys(c, store, raise, force) {
  const k = c + ':' + raise.toLowerCase(); const cur = BUYS[k]; if (cur && !force && Date.now() - cur.at < 20000) return cur.items;
  const p = conn(c); const head = await p.getBlockNumber(); const from = cur ? cur.to + 1 : Math.max(0, head - 200000); const items = cur ? [...cur.items] : [];
  const seen = new Set(items.map((b) => b.sig + ':' + b.idx));
  for (let a = from; a <= head; a += 5000) { const logs = await p.getLogs({ address: raise, topics: [BOUGHT], fromBlock: a, toBlock: Math.min(head, a + 4999) }); for (const l of logs) { const d = IF.raise.decodeEventLog('Bought', l.data, l.topics); const key = l.transactionHash + ':' + l.index; if (seen.has(key)) continue; seen.add(key); items.push({ sig: l.transactionHash, idx: l.index, kind: 'buy', who: d.buyer, amount: d.amount.toString(), total: d.raised.toString(), block: l.blockNumber, ts: 0 }); } }
  const blocks = [...new Set(items.filter((b) => !b.ts).map((b) => b.block))].slice(0, 40); await Promise.all(blocks.map(async (bn) => { try { const bl = await p.getBlock(bn); for (const b of items) if (b.block === bn) b.ts = bl.timestamp * 1000; } catch {} }));
  items.sort((a, b) => b.block - a.block || b.idx - a.idx); BUYS[k] = { at: Date.now(), to: head, items }; return items;
}
const FEED = {};
async function feed(c, store, limit = 50) {
  const cur = FEED[c]; if (cur && Date.now() - cur.at < 30000) return cur.items.slice(0, limit);
  const d = await coins(c, store); const live = d.coins.filter((r) => !(r.finalized && !r.graduated)).slice(0, 40); const out = [];
  await Promise.all(live.map(async (r) => { try { for (const b of await buys(c, store, r.address)) out.push({ ...b, raise: r.address, symbol: r.symbol, payMint: r.payMint, payDecimals: r.payDecimals }); } catch {} }));
  out.sort((a, b) => b.block - a.block || b.idx - a.idx); FEED[c] = { at: Date.now(), items: out.slice(0, 200) }; return out.slice(0, limit);
}
async function buysByWallet(c, store, wallet) {
  const d = await coins(c, store); const p = conn(c); if (!d.coins.length) return []; const head = await p.getBlockNumber(); const topic = ethers.zeroPadValue(wallet, 32); const out = [];
  const addrs = d.coins.map((r) => r.address); for (let a = Math.max(0, head - 200000); a <= head; a += 5000) { const logs = await p.getLogs({ address: addrs, topics: [BOUGHT, topic], fromBlock: a, toBlock: Math.min(head, a + 4999) }); for (const l of logs) { const dd = IF.raise.decodeEventLog('Bought', l.data, l.topics); const r = d.coins.find((x) => x.address.toLowerCase() === l.address.toLowerCase()); out.push({ sig: l.transactionHash, raise: l.address, symbol: r && r.symbol, who: wallet, amount: dd.amount.toString(), total: dd.raised.toString(), block: l.blockNumber, ts: 0 }); } }
  const blocks = [...new Set(out.map((b) => b.block))].slice(0, 20); await Promise.all(blocks.map(async (bn) => { try { const bl = await p.getBlock(bn); for (const b of out) if (b.block === bn) b.ts = bl.timestamp * 1000; } catch {} }));
  return out.sort((a, b) => b.block - a.block);
}

/* ---- calldata for the page: it signs and sends each call in order ---- */
const call = (to, data, value = '0') => ({ to, data, value });
function callsFor(kind, c, store, r, who, q) {
  const net = CLUSTERS[c];
  if (kind === 'approve') return [call(r.payMint, IF.erc20.encodeFunctionData('approve', [r.address, ethers.MaxUint256]))];
  if (kind === 'buy') { const amount = BigInt(q.get('amount') || '0'); if (amount <= 0n) throw new Error('amount required'); return r.payMint ? [call(r.address, IF.raise.encodeFunctionData('buyWith', [amount]))] : [call(r.address, IF.raise.encodeFunctionData('buy', []), amount.toString())]; }
  if (kind === 'finalize') return [call(r.address, IF.raise.encodeFunctionData('finalize', []))];
  if (kind === 'claim') return [call(r.address, IF.raise.encodeFunctionData('claim', []))];
  if (kind === 'refund') return [call(r.address, IF.raise.encodeFunctionData('refund', []))];
  throw new Error('unknown call');
}
/* PancakeSwap v2 quote and swap calldata for a graduated coin (COIN/BNB or COIN/stock pair) */
async function swapCalls(c, r, who, amountIn, coinToPay, slippageBps) {
  const net = CLUSTERS[c]; const router = new ethers.Contract(net.router, ROUTER_ABI, conn(c)); const quoteTok = r.payMint || net.wbnb;
  const path = coinToPay ? [r.coinMint, quoteTok] : [quoteTok, r.coinMint]; const amounts = await router.getAmountsOut(amountIn, path); const out = amounts[amounts.length - 1]; const minOut = out - out * BigInt(slippageBps) / 10000n; const deadline = Math.floor(Date.now() / 1000) + 600; const calls = [];
  if (coinToPay) { calls.push(call(r.coinMint, IF.erc20.encodeFunctionData('approve', [net.router, amountIn]))); calls.push(call(net.router, r.payMint ? IF.router.encodeFunctionData('swapExactTokensForTokens', [amountIn, minOut, path, who, deadline]) : IF.router.encodeFunctionData('swapExactTokensForETH', [amountIn, minOut, path, who, deadline]))); }
  else if (r.payMint) { calls.push(call(r.payMint, IF.erc20.encodeFunctionData('approve', [net.router, amountIn]))); calls.push(call(net.router, IF.router.encodeFunctionData('swapExactTokensForTokens', [amountIn, minOut, path, who, deadline]))); }
  else calls.push(call(net.router, IF.router.encodeFunctionData('swapExactETHForTokens', [minOut, path, who, deadline]), amountIn.toString()));
  return { calls, quote: out.toString(), minOut: minOut.toString() };
}
/* Cash a graduated coin out for an exact amount of BNB (gift-card payments): approve + swapTokensForExactETH,
   routed through the stock token when the raise was paid in one. amountInMax carries the slippage. */
async function cashoutCalls(c, r, who, outWei, slippageBps) {
  const net = CLUSTERS[c]; const router = new ethers.Contract(net.router, ROUTER_ABI, conn(c)); const path = r.payMint ? [r.coinMint, r.payMint, net.wbnb] : [r.coinMint, net.wbnb];
  const amounts = await router.getAmountsIn(outWei, path); const amountIn = amounts[0]; const maxIn = amountIn + amountIn * BigInt(slippageBps) / 10000n; const deadline = Math.floor(Date.now() / 1000) + 600;
  return { calls: [call(r.coinMint, IF.erc20.encodeFunctionData('approve', [net.router, maxIn])), call(net.router, IF.router.encodeFunctionData('swapTokensForExactETH', [outWei, maxIn, path, who, deadline]))], amountIn: amountIn.toString(), maxIn: maxIn.toString(), path };
}
/* pool price of a graduated coin from the PancakeSwap pair reserves */
async function poolInfo(c, r) {
  const net = CLUSTERS[c]; const p = conn(c); const quote = r.payMint || net.wbnb; const f = new ethers.Contract(net.pcsFactory, ['function getPair(address,address) view returns (address)'], p);
  const pair = await f.getPair(r.coinMint, quote); if (pair === ethers.ZeroAddress) return { graduated: true, pair: null, price: 0, liquidity: 0, marketCap: 0 };
  const pc = new ethers.Contract(pair, ['function getReserves() view returns (uint112,uint112,uint32)', 'function token0() view returns (address)'], p); const [res, t0] = await Promise.all([pc.getReserves(), pc.token0()]);
  const coinFirst = t0.toLowerCase() === r.coinMint.toLowerCase(); const rCoin = Number(ethers.formatUnits(coinFirst ? res[0] : res[1], 18)); const rQ = Number(ethers.formatUnits(coinFirst ? res[1] : res[0], r.payDecimals));
  const price = rCoin > 0 ? rQ / rCoin : 0; return { graduated: true, pair, price, liquidity: rQ, marketCap: price * 1e9, token: r.coinMint, symbol: r.symbol, unit: r.payMint ? null : net.symbol, payToken: r.payMint, dex: 'PancakeSwap' };
}

/* ---- gift-card payments: BNB or USDT to the merchant, verified by transaction hash ---- */
const PX = { at: 0, usd: 0 };
async function bnbPrice() { if (Date.now() - PX.at < 120000 && PX.usd) return PX.usd; try { const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd', { signal: AbortSignal.timeout(8000) }); const j = await r.json(); const v = Number(j.binancecoin && j.binancecoin.usd); if (v > 0) { PX.usd = v; PX.at = Date.now(); } } catch (e) { console.error('bnb price', e.message); } if (!PX.usd) throw new Error('no price feed'); return PX.usd; }
async function walletAmounts(priceUsd) { const px = await bnbPrice(); const bnb = Math.ceil(priceUsd / px * 1e6) / 1e6; return { BNB: { amount: bnb, wei: (BigInt(Math.round(bnb * 1e6)) * 10n ** 12n).toString() }, USDT: { amount: priceUsd, wei: (BigInt(Math.round(priceUsd * 100)) * 10n ** 16n).toString() } }; }
const isTxHash = (v) => typeof v === 'string' && /^0x[0-9a-fA-F]{64}$/.test(v);
async function verifyPayment(order, txHash, c = DEFAULT_CLUSTER) {
  if (!MERCHANT) throw new Error('merchant not configured'); if (!isTxHash(txHash)) throw new Error('bad transaction hash');
  const p = conn(order.pay.cluster || c); const [tx, rc] = await Promise.all([p.getTransaction(txHash), p.getTransactionReceipt(txHash)]);
  if (!tx) throw new Error('transaction not found'); if (!rc || !rc.blockNumber) throw new Error('not confirmed yet'); if (rc.status !== 1) throw new Error('transaction failed');
  const want = order.pay.amounts; const to = (tx.to || '').toLowerCase(); const usdt = CLUSTERS[order.pay.cluster || c].usdt.toLowerCase();
  if (to === MERCHANT.toLowerCase()) { const v = tx.value; if (v * 1000n < BigInt(want.BNB.wei) * 995n) throw new Error('amount below quote'); return { token: 'BNB', from: tx.from, amount: v.toString(), signature: txHash }; }
  const log = rc.logs.find((l) => l.address.toLowerCase() === usdt && l.topics[0] === TRANSFER && ('0x' + l.topics[2].slice(26)).toLowerCase() === MERCHANT.toLowerCase());
  if (!log) throw new Error('transaction does not pay the merchant');
  const v = BigInt(log.data); if (v * 1000n < BigInt(want.USDT.wei) * 995n) throw new Error('amount below quote'); return { token: 'USDT', from: tx.from, amount: v.toString(), signature: txHash };
}
/* EIP-681 link for the QR: a BNB transfer to the merchant for the quoted amount */
const payUrl = (c, amounts) => MERCHANT ? `ethereum:${MERCHANT}@${c}?value=${amounts.BNB.wei}` : null;
const newReference = () => null; const findReference = async () => null;
const slots = async () => { const out = {}; await Promise.all(Object.keys(CLUSTERS).map(async (c) => { try { out[c] = await Promise.race([conn(c).getBlockNumber(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))]); } catch { out[c] = null; } })); return out; };

/* ---- deploying the factory from /admin with DEPLOYER_KEY ---- */
const deployerWallet = () => { const k = (process.env.DEPLOYER_KEY || '').trim(); if (!/^0x[0-9a-fA-F]{64}$/.test(k)) return null; try { return new ethers.Wallet(k); } catch { return null; } };
async function deployStatus(store) {
  const w = deployerWallet(); const chains = {};
  await Promise.all(Object.keys(CLUSTERS).map(async (c) => { const row = { factory: programOf(c, store), symbol: CLUSTERS[c].symbol, balance: null, record: (store.factories || {})[c] || null }; if (w) { try { row.balance = ethers.formatEther(await conn(c).getBalance(w.address)); } catch (e) { row.balanceError = e.message; } } chains[c] = row; }));
  return { deployer: w ? w.address : null, chains, busy: Boolean(busy) };
}
let busy = null;
async function deployFactory(c, store, save) {
  const net = CLUSTERS[c]; if (!net) throw new Error('chain must be 56 or 97'); const w = deployerWallet(); if (!w) throw new Error('DEPLOYER_KEY is not set or not a private key'); if (busy) throw new Error('a deployment is already running'); busy = c;
  try {
    const art = JSON.parse(fs.readFileSync(path.join(__dirname, 'contracts', 'build', 'KuaiFactory.json'), 'utf8')); const pairs = JSON.parse(fs.readFileSync(path.join(__dirname, 'contracts', 'pairs.json'), 'utf8')); delete pairs._note;
    const wallet = w.connect(conn(c)); const bal = await conn(c).getBalance(wallet.address); if (bal < ethers.parseEther('0.02')) throw new Error(`deployer ${wallet.address} has ${ethers.formatEther(bal)} ${net.symbol}; it needs about 0.05 ${net.symbol}`);
    const feeTo = process.env.FEE_TO && ethers.isAddress(process.env.FEE_TO) ? process.env.FEE_TO : wallet.address;
    const cf = new ethers.ContractFactory(art.abi, art.bytecode, wallet); const ct = await cf.deploy(feeTo, net.router); const tx = ct.deploymentTransaction().hash; await ct.waitForDeployment(); const address = await ct.getAddress();
    const ids = Object.keys(pairs); const stocks = ids.map((id) => c === '56' ? pairs[id].address : (process.env.STOCK_TEST || ethers.ZeroAddress)); const reg = await ct.setStocks(ids, stocks); await reg.wait();
    store.factories ||= {}; store.factories[c] = { address, tx, feeTo, deployer: wallet.address, at: Date.now(), registered: ids.length, stocks: c === '56' ? 'tokenized' : (process.env.STOCK_TEST ? 'STOCK_TEST' : 'tBNB') }; (store.programs ||= {})[c] = address; await save(); delete IDX[c]; return store.factories[c];
  } finally { busy = null; }
}

/* ---- HTTP ---- */
/* ---- KuaiStaking: the house coin's staking pool (70 % of fees to stakers in BNB, 30 % buyback and burn) ---- */
const STAKING_ABI = ['function summary() view returns (address token, uint256 staked, uint256 rewards, uint256 pool, uint256 pending, uint256 fees, uint256 paid, uint256 burned, uint256 waitingStakers)', 'function stakedOf(address) view returns (uint256)', 'function pendingOf(address) view returns (uint256)', 'function stake(uint256)', 'function unstake(uint256)', 'function claim()', 'function owner() view returns (address)', 'function setStakeToken(address)', 'function harvest(address[] path, uint256 minOut)', 'function buyback(uint256 minOut)', 'function sync()', 'function lifetimeBuyback() view returns (uint256)'];
IF.staking = new ethers.Interface(STAKING_ABI);
function stakingOf(c, store) { const st = store && store.staking && store.staking[c] && store.staking[c].address; const a = st || process.env['STAKING_' + c]; return a && ethers.isAddress(a) ? ethers.getAddress(a) : null; }
const STK = {};
async function stakeInfo(c, store, wallet) {
  const addr = stakingOf(c, store); const net = CLUSTERS[c]; const base = { cluster: c, staking: addr, stakerBps: 7000, payout: net.symbol };
  if (!addr) return { ...base, deployed: false };
  const k = c + ':' + addr; let g = STK[k];
  if (!g || Date.now() - g.at > 15000) {
    const st = new ethers.Contract(addr, STAKING_ABI, conn(c)); const [sm, bought, owner] = await Promise.all([st.summary(), st.lifetimeBuyback().catch(() => 0n), st.owner().catch(() => null)]);
    const token = sm[0] === ethers.ZeroAddress ? null : sm[0]; const meta = token ? await tokenMeta(c, token) : null;
    g = STK[k] = { at: Date.now(), d: { token, tokenSymbol: meta ? meta.symbol : null, tokenDecimals: meta ? meta.decimals : 18, owner, totalStaked: sm[1].toString(), rewardReserve: sm[2].toString(), buybackPool: sm[3].toString(), unaccounted: sm[4].toString(), lifetimeFees: sm[5].toString(), lifetimePaid: sm[6].toString(), lifetimeBurned: sm[7].toString(), waiting: sm[8].toString(), lifetimeBuyback: bought.toString() } };
  }
  const out = { ...base, deployed: true, ...g.d, you: null };
  if (wallet && isPk(wallet)) {
    const st = new ethers.Contract(addr, STAKING_ABI, conn(c)); const reads = [st.stakedOf(wallet), st.pendingOf(wallet)];
    if (g.d.token) { const t = new ethers.Contract(g.d.token, ERC20_ABI, conn(c)); reads.push(t.balanceOf(wallet), t.allowance(wallet, addr)); }
    const [staked, pending, balance, allowance] = await Promise.all(reads);
    out.you = { staked: staked.toString(), pending: pending.toString(), balance: balance != null ? balance.toString() : '0', allowance: allowance != null ? allowance.toString() : '0' };
  }
  return out;
}
function stakeCalls(kind, c, store, info, amount) {
  const addr = info.staking; if (!addr) throw new Error('staking not deployed on ' + c);
  if (kind === 'claim') return [call(addr, IF.staking.encodeFunctionData('claim', []))];
  if (!info.token) throw new Error('the house coin is not set yet');
  if (amount <= 0n) throw new Error('amount required');
  if (kind === 'approve') return [call(info.token, IF.erc20.encodeFunctionData('approve', [addr, amount]))];
  if (kind === 'unstake') return [call(addr, IF.staking.encodeFunctionData('unstake', [amount]))];
  const calls = []; if (!info.you || BigInt(info.you.allowance) < amount) calls.push(call(info.token, IF.erc20.encodeFunctionData('approve', [addr, amount])));
  calls.push(call(addr, IF.staking.encodeFunctionData('stake', [amount]))); return calls;
}
/* keeper actions, signed by DEPLOYER_KEY on the server (admin only) */
async function deployStaking(c, store, save) {
  const net = CLUSTERS[c]; const w = deployerWallet(); if (!w) throw new Error('DEPLOYER_KEY is not set or not a private key'); if (busy) throw new Error('a deployment is already running'); busy = 'staking:' + c;
  try {
    const wallet = w.connect(conn(c)); const bal = await conn(c).getBalance(wallet.address); if (bal < ethers.parseEther('0.01')) throw new Error(`deployer ${wallet.address} has ${ethers.formatEther(bal)} ${net.symbol}; it needs about 0.02 ${net.symbol}`);
    const art = JSON.parse(fs.readFileSync(path.join(__dirname, 'contracts', 'build', 'KuaiStaking.json'), 'utf8'));
    const ct = await new ethers.ContractFactory(art.abi, art.bytecode, wallet).deploy(net.router, net.wbnb); const tx = ct.deploymentTransaction().hash; await ct.waitForDeployment(); const address = await ct.getAddress();
    const rec = { address, tx, deployer: wallet.address, at: Date.now(), feeToSet: false, feeToError: null };
    const fac = programOf(c, store);
    if (fac) { try { const f = new ethers.Contract(fac, ['function owner() view returns (address)', 'function setFeeTo(address)'], wallet); if ((await f.owner()).toLowerCase() === wallet.address.toLowerCase()) { await (await f.setFeeTo(address)).wait(); rec.feeToSet = true; } else rec.feeToError = 'the deployer does not own the factory'; } catch (e) { rec.feeToError = e.shortMessage || e.message; } }
    (store.staking ||= {})[c] = rec; await save(); return rec;
  } finally { busy = null; }
}
async function keeper(c, store, action, arg) {
  const addr = stakingOf(c, store); if (!addr) throw new Error('staking not deployed on ' + c); const w = deployerWallet(); if (!w) throw new Error('DEPLOYER_KEY is not set');
  const net = CLUSTERS[c]; const wallet = w.connect(conn(c)); const st = new ethers.Contract(addr, STAKING_ABI, wallet); const router = new ethers.Contract(net.router, ROUTER_ABI, conn(c)); let tx;
  if (action === 'setToken') { if (!isPk(arg)) throw new Error('token address required'); tx = await st.setStakeToken(arg); }
  else if (action === 'sync') tx = await st.sync();
  else if (action === 'harvest') {
    if (!isPk(arg)) throw new Error('token address required'); const t = new ethers.Contract(arg, ERC20_ABI, conn(c)); const amt = await t.balanceOf(addr); if (amt === 0n) throw new Error('nothing to harvest in that token');
    let best = null; for (const pth of [[arg, net.wbnb], [arg, net.usdt, net.wbnb]]) { try { const out = await router.getAmountsOut(amt, pth); const o = out[out.length - 1]; if (!best || o > best.o) best = { pth, o }; } catch {} }
    if (!best) throw new Error('no PancakeSwap route from that token to BNB'); tx = await st.harvest(best.pth, best.o * 97n / 100n);
  } else if (action === 'buyback') {
    const sm = await st.summary(); if (sm[0] === ethers.ZeroAddress) throw new Error('the house coin is not set'); const pool = sm[3] + sm[4] * 3000n / 10000n; if (pool === 0n) throw new Error('buyback pool is empty');
    const out = await router.getAmountsOut(pool, [net.wbnb, sm[0]]); tx = await st.buyback(out[out.length - 1] * 95n / 100n);
  } else throw new Error('unknown action');
  await tx.wait(); delete STK[c + ':' + addr]; (store.adminLog ||= []).push({ at: Date.now(), action: 'staking-' + action, cluster: c, tx: tx.hash }); return { ok: true, tx: tx.hash };
}

async function chainApi(req, res, url, h) {
  const { send, fail, store } = h; const p = url.pathname; let m; const c = cluster(url.searchParams.get('cluster'));
  if (p === '/api/rpc') return rpcProxy(req, res, url, h);
  if (req.method === 'GET' && p === '/api/stake') { const w = url.searchParams.get('wallet'); try { return send(res, 200, await stakeInfo(c, store, w), { 'cache-control': 'no-store' }); } catch (e) { return fail(res, 502, 'rpc: ' + e.message); } }
  if (req.method === 'GET' && (m = /^\/api\/stake\/ix\/(approve|stake|unstake|claim)$/.exec(p))) { const w = url.searchParams.get('wallet'); if (!isPk(w)) return fail(res, 400, 'wallet required'); try { const info = await stakeInfo(c, store, w); let amount = 0n; try { amount = BigInt(url.searchParams.get('amount') || '0'); } catch { return fail(res, 400, 'bad amount'); } return send(res, 200, { calls: stakeCalls(m[1], c, store, info, amount) }); } catch (e) { return fail(res, 400, e.message); } }
  if (req.method === 'GET' && p === '/api/coins') { try { const d = await coins(c, store, url.searchParams.get('fresh') === '1'); return send(res, 200, { cluster: c, now: Date.now(), ...d }, { 'cache-control': 'no-store' }); } catch (e) { return fail(res, 502, 'rpc: ' + e.message); } }
  if (req.method === 'GET' && (m = /^\/api\/coins\/(0x[0-9a-fA-F]{40})$/.exec(p))) { try { const d = await coins(c, store); const r = d.coins.find((x) => x.address.toLowerCase() === m[1].toLowerCase()); if (!r) return fail(res, 404, 'no such coin'); const buyer = url.searchParams.get('buyer'); const paid = buyer && isPk(buyer) ? await paidOf(c, store, r.address, buyer) : null; return send(res, 200, { coin: r, paid }, { 'cache-control': 'no-store' }); } catch (e) { return fail(res, 502, 'rpc: ' + e.message); } }
  if (req.method === 'GET' && (m = /^\/api\/coins\/(0x[0-9a-fA-F]{40})\/buys$/.exec(p))) { try { return send(res, 200, { items: await buys(c, store, m[1], url.searchParams.get('fresh') === '1') }, { 'cache-control': 'no-store' }); } catch (e) { return fail(res, 502, 'rpc: ' + e.message); } }
  if (req.method === 'GET' && p === '/api/feed') { const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 50)); try { return send(res, 200, { cluster: c, items: await feed(c, store, limit) }, { 'cache-control': 'no-store' }); } catch (e) { return fail(res, 502, 'rpc: ' + e.message); } }
  if (req.method === 'GET' && p === '/api/buys') { const w = url.searchParams.get('wallet'); if (!isPk(w)) return fail(res, 400, 'wallet required'); try { return send(res, 200, { items: await buysByWallet(c, store, w) }); } catch (e) { return fail(res, 502, 'rpc: ' + e.message); } }
  if (req.method === 'GET' && (m = /^\/api\/coins\/ix\/(create|approve|buy|finalize|claim|refund|swap|cashout)$/.exec(p))) {
    const pid = programOf(c, store); if (!pid) return fail(res, 503, 'factory not deployed on ' + c); const q = url.searchParams; const who = q.get('wallet'); if (!isPk(who)) return fail(res, 400, 'wallet required');
    try {
      if (m[1] === 'create') { const name = String(q.get('name') || '').slice(0, 32), symbol = String(q.get('symbol') || '').toUpperCase().slice(0, 8), restaurant = String(q.get('restaurant') || '').slice(0, 24); const target = BigInt(q.get('target') || '0'); const duration = Number(q.get('duration') || 0); if (!name || !symbol || !restaurant || target <= 0n || !duration) return fail(res, 400, 'name, symbol, restaurant, target, duration required'); return send(res, 200, { calls: [call(pid, IF.factory.encodeFunctionData('createCoin', [name, symbol, restaurant, target, BigInt(duration)]))] }); }
      const d = await coins(c, store); const r = d.coins.find((x) => x.address.toLowerCase() === String(q.get('raise') || '').toLowerCase()); if (!r) return fail(res, 404, 'no such coin');
      if (m[1] === 'cashout') { const outWei = BigInt(q.get('outWei') || '0'); if (outWei <= 0n) return fail(res, 400, 'outWei required'); return send(res, 200, await cashoutCalls(c, r, who, outWei, Math.min(2000, Math.max(0, Number(q.get('slippageBps') || 300))))); }
      if (m[1] === 'swap') { const amountIn = BigInt(q.get('amountIn') || '0'); if (amountIn <= 0n) return fail(res, 400, 'amountIn required'); return send(res, 200, await swapCalls(c, r, who, amountIn, q.get('coinToPay') === '1', Math.min(5000, Math.max(1, Number(q.get('slippageBps') || 100))))); }
      return send(res, 200, { calls: callsFor(m[1], c, store, r, who, q) });
    } catch (e) { return fail(res, 400, e.message); }
  }
  return fail(res, 404, 'no such route');
}

module.exports = { stakingOf, stakeInfo, stakeCalls, deployStaking, keeper, STAKING_ABI, CLUSTERS, DEFAULT_CLUSTER, MERCHANT, cluster, conn, isPk, isTxHash, verifySignature, config, programOf, coins, paidOf, buys, feed, buysByWallet, poolInfo, bnbPrice, walletAmounts, verifyPayment, payUrl, newReference, findReference, slots, deployStatus, deployFactory, chainApi, FACTORY_ABI, RAISE_ABI, ERC20_ABI, TRANSFER };
