/* Solana for the server: cluster config, an RPC proxy for the page, the coin
 * index (Raise accounts of the Sol Bite program), instruction builders for
 * the browser, the buys indexer (program transactions), sign-in with
 * ed25519 signatures, and gift-card payments in SOL / USDC verified on-chain
 * (direct transfer from a wallet, or Solana Pay with a reference key).
 *
 * Env: CLUSTER (mainnet-beta | devnet, default devnet until a mainnet
 * program exists), RPC_URL, RPC_URL_DEVNET, PROGRAM_ID, PROGRAM_ID_DEVNET,
 * MERCHANT_ADDRESS (a Solana wallet), USDC_MINT (override), X_URL. */
'use strict';
const crypto = require('crypto');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const S = require('./chain/solbite');

const CLUSTERS = {
  'mainnet-beta': { key: 'mainnet-beta', name: 'Solana', rpc: process.env.RPC_URL || 'https://api.mainnet-beta.solana.com', explorer: 'https://solscan.io', programId: (process.env.PROGRAM_ID || '').trim(), usdc: process.env.USDC_MINT || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'SOL' },
  devnet: { key: 'devnet', name: 'Solana Devnet', rpc: process.env.RPC_URL_DEVNET || 'https://api.devnet.solana.com', explorer: 'https://solscan.io', explorerSuffix: '?cluster=devnet', programId: (process.env.PROGRAM_ID_DEVNET || '').trim(), usdc: process.env.USDC_MINT_DEVNET || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', symbol: 'SOL' }
};
const DEFAULT_CLUSTER = CLUSTERS[process.env.CLUSTER] ? process.env.CLUSTER : (CLUSTERS['mainnet-beta'].programId ? 'mainnet-beta' : 'devnet');
const MERCHANT = (process.env.MERCHANT_ADDRESS || '').trim();
const conns = {}; const conn = (c) => conns[c] || (conns[c] = new Connection(CLUSTERS[c].rpc, 'confirmed'));
const isPk = (s) => { try { return typeof s === 'string' && s.length >= 32 && s.length <= 44 && Boolean(new PublicKey(s)); } catch { return false; } };
const cluster = (q) => (q && CLUSTERS[q]) ? q : DEFAULT_CLUSTER;

/* ---- base58 (Bitcoin alphabet) ---- */
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58decode(s) { let n = 0n; for (const ch of s) { const i = B58.indexOf(ch); if (i < 0) throw new Error('bad base58'); n = n * 58n + BigInt(i); } const bytes = []; while (n > 0n) { bytes.push(Number(n & 255n)); n >>= 8n; } for (const ch of s) { if (ch === '1') bytes.push(0); else break; } return Buffer.from(bytes.reverse()); }
function b58encode(buf) { let n = BigInt('0x' + (Buffer.from(buf).toString('hex') || '0')); let s = ''; while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; } for (const b of buf) { if (b === 0) s = '1' + s; else break; } return s; }

/* ---- sign-in: the wallet signs a text message (Phantom signMessage) ---- */
function verifySignature(address, message, signatureB58) {
  try { const pub = b58decode(address); const sig = b58decode(signatureB58); if (pub.length !== 32 || sig.length !== 64) return false;
    const key = crypto.createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), pub]), format: 'der', type: 'spki' });
    return crypto.verify(null, Buffer.from(message, 'utf8'), key, sig); } catch { return false; }
}

/* ---- config for the page ---- */
function config(store) {
  const c = CLUSTERS[DEFAULT_CLUSTER];
  return { chain: 'solana', paths: true, cluster: DEFAULT_CLUSTER, clusters: Object.fromEntries(Object.entries(CLUSTERS).map(([k, v]) => [k, { name: v.name, explorer: v.explorer, explorerSuffix: v.explorerSuffix || '', programId: v.programId || (store.programs && store.programs[k]) || null, usdc: v.usdc, symbol: v.symbol }])), rpc: '/api/rpc', merchant: MERCHANT || null, usdc: c.usdc, social: process.env.X_URL ? { x: process.env.X_URL.trim() } : {} };
}
const programOf = (c, store) => { const id = CLUSTERS[c].programId || (store && store.programs && store.programs[c]); return id ? new PublicKey(id) : null; };

/* ---- RPC proxy: the page talks to the cluster through us ---- */
const RPC_ALLOW = new Set(['getLatestBlockhash', 'sendTransaction', 'getSignatureStatuses', 'getBalance', 'getAccountInfo', 'getMultipleAccounts', 'getTokenAccountBalance', 'getTokenAccountsByOwner', 'getMinimumBalanceForRentExemption', 'simulateTransaction', 'getTransaction', 'getSlot', 'getBlockHeight', 'getFeeForMessage', 'getRecentPrioritizationFees', 'getSignaturesForAddress', 'getEpochInfo', 'getVersion', 'getParsedTokenAccountsByOwner']);
async function rpcProxy(req, res, url, h) {
  const { send, fail, limited } = h; if (req.method !== 'POST') return fail(res, 405, 'POST');
  if (limited(req)) return fail(res, 429, 'too many requests, slow down');
  let body; try { body = await h.readJson(req, 256 * 1024); } catch (e) { return fail(res, 400, e.message); }
  const calls = Array.isArray(body) ? body : [body]; if (calls.some((c) => !c || !RPC_ALLOW.has(c.method))) return fail(res, 400, 'method not allowed');
  const c = cluster(url.searchParams.get('cluster'));
  try { const r = await fetch(CLUSTERS[c].rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) }); const text = await r.text(); res.writeHead(r.status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(text); }
  catch (e) { fail(res, 502, 'rpc: ' + e.message); }
}

/* ---- coin index ---- */
const IDX = {};
async function coins(c, store, force) {
  const pid = programOf(c, store); if (!pid) return { programId: null, coins: [], feeTo: null };
  const k = c; const cur = IDX[k]; if (cur && !force && Date.now() - cur.at < 10000) return cur.data; if (cur && cur.pending) return cur.pending;
  const p = (async () => {
    const cn = conn(c);
    const accs = await cn.getProgramAccounts(pid, { filters: [{ dataSize: S.RAISE_LEN }, { memcmp: { offset: 0, bytes: b58encode(Buffer.from([2])) } }] });
    const list = accs.map((a) => S.decodeRaise(a.account.data, a.pubkey)).filter(Boolean).map((r) => ({ ...r, phase: S.phaseOf(r) })).sort((a, b) => b.openAt - a.openAt);
    let feeTo = null; try { const ci = await cn.getAccountInfo(S.configPda(pid)[0]); if (ci) feeTo = S.decodeConfig(ci.data).feeTo; } catch {}
    const data = { programId: pid.toBase58(), coins: list, feeTo, at: Date.now() }; IDX[k] = { at: Date.now(), data }; return data;
  })();
  IDX[k] = { ...(cur || {}), pending: p }; try { return await p; } finally { if (IDX[k]) delete IDX[k].pending; }
}
async function paidOf(c, store, raise, buyer) { const pid = programOf(c, store); const [pda] = S.paidPda(pid, new PublicKey(raise), new PublicKey(buyer)); const ai = await conn(c).getAccountInfo(pda); return ai ? S.decodePaid(ai.data) : { amount: '0', claimed: false }; }

/* ---- buys indexer: program transactions on a raise ---- */
const BUYS = {};
async function buys(c, store, raise, force) {
  const k = c + ':' + raise; const cur = BUYS[k]; if (cur && !force && Date.now() - cur.at < 20000) return cur.items;
  const pid = programOf(c, store); const cn = conn(c);
  const sigs = await cn.getSignaturesForAddress(new PublicKey(raise), { limit: 200 });
  const known = new Map((cur ? cur.items : []).map((b) => [b.sig, b]));
  const fresh = sigs.filter((s) => !s.err && !known.has(s.signature)).slice(0, 60);
  const txs = fresh.length ? await cn.getTransactions(fresh.map((s) => s.signature), { maxSupportedTransactionVersion: 0, commitment: 'confirmed' }) : [];
  const items = [...known.values()];
  txs.forEach((tx, i) => { if (!tx || !tx.meta || tx.meta.err) return; const keys = tx.transaction.message.staticAccountKeys || tx.transaction.message.accountKeys; const ixs = tx.transaction.message.compiledInstructions || tx.transaction.message.instructions;
    for (const ix of ixs) { const prog = keys[ix.programIdIndex]; if (!prog || prog.toBase58() !== pid.toBase58()) continue; const data = Buffer.from(ix.data instanceof Uint8Array ? ix.data : b58decode(ix.data)); const kind = data[0] === 2 ? 'buy' : data[0] === 6 ? 'swap' : data[0] === 4 ? 'claim' : data[0] === 5 ? 'refund' : data[0] === 3 ? 'finalize' : data[0] === 1 ? 'create' : null; if (!kind) continue;
      const accIdx = ix.accountKeyIndexes || ix.accounts; const who = keys[accIdx[0]].toBase58(); const log = (tx.meta.logMessages || []).map((l) => /Program log: (bought|sold|claimed|refunded) (\d+)(?: (?:total|for) (\d+))?/.exec(l)).find(Boolean);
      items.push({ sig: fresh[i].signature, kind, who, amount: log ? log[2] : null, total: log && log[3] ? log[3] : null, ts: (tx.blockTime || fresh[i].blockTime || 0) * 1000, slot: tx.slot }); } });
  items.sort((a, b) => b.ts - a.ts || b.slot - a.slot); BUYS[k] = { at: Date.now(), items }; return items;
}
/* recent buys across every coin on the cluster (home feed + leaderboard); cached 30 s */
const FEED = {};
async function feed(c, store, limit = 50) {
  const cur = FEED[c]; if (cur && Date.now() - cur.at < 30000) return cur.items.slice(0, limit);
  const d = await coins(c, store); const live = d.coins.filter((r) => !(r.finalized && !r.graduated)).slice(0, 40); const out = [];
  await Promise.all(live.map(async (r) => { try { const items = await buys(c, store, r.address); for (const b of items) if (b.kind === 'buy' && b.amount) out.push({ ...b, raise: r.address, symbol: r.symbol, payMint: r.payMint, payDecimals: r.payDecimals }); } catch {} }));
  out.sort((a, b) => b.ts - a.ts || b.slot - a.slot); FEED[c] = { at: Date.now(), items: out.slice(0, 200) }; return out.slice(0, limit);
}
async function buysByWallet(c, store, wallet) {
  const pid = programOf(c, store); const cn = conn(c); const sigs = (await cn.getSignaturesForAddress(new PublicKey(wallet), { limit: 50 })).filter((s) => !s.err);
  const txs = sigs.length ? await cn.getTransactions(sigs.map((s) => s.signature), { maxSupportedTransactionVersion: 0 }) : []; const out = [];
  txs.forEach((tx, i) => { if (!tx || !tx.meta || tx.meta.err) return; const keys = tx.transaction.message.staticAccountKeys || tx.transaction.message.accountKeys; const ixs = tx.transaction.message.compiledInstructions || tx.transaction.message.instructions;
    for (const ix of ixs) { const prog = keys[ix.programIdIndex]; if (!prog || prog.toBase58() !== pid.toBase58()) continue; const data = Buffer.from(ix.data instanceof Uint8Array ? ix.data : b58decode(ix.data)); if (data[0] !== 2) continue; const accIdx = ix.accountKeyIndexes || ix.accounts; const log = (tx.meta.logMessages || []).map((l) => /Program log: bought (\d+) total (\d+)/.exec(l)).find(Boolean); out.push({ sig: sigs[i].signature, raise: keys[accIdx[1]].toBase58(), who: wallet, amount: log ? log[1] : null, ts: (tx.blockTime || 0) * 1000 }); } });
  return out;
}

/* ---- gift-card payments ---- */
const SOL_PX = { at: 0, usd: 0 };
async function solPrice() { if (Date.now() - SOL_PX.at < 120000 && SOL_PX.usd) return SOL_PX.usd; try { const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', { signal: AbortSignal.timeout(8000) }); const j = await r.json(); const v = Number(j.solana && j.solana.usd); if (v > 0) { SOL_PX.usd = v; SOL_PX.at = Date.now(); } } catch {} if (!SOL_PX.usd) throw new Error('no SOL price'); return SOL_PX.usd; }
async function walletAmounts(priceUsd) { const px = await solPrice(); const sol = Math.ceil(priceUsd / px * 1e6) / 1e6; return { SOL: { amount: sol, lamports: String(Math.round(sol * 1e9)) }, USDC: { amount: priceUsd, units: String(Math.round(priceUsd * 1e6)) } }; }
const merchantUsdcAta = (c) => MERCHANT ? S.ata(new PublicKey(MERCHANT), new PublicKey(CLUSTERS[c].usdc), S.SPL_TOKEN).toBase58() : null;
function payUrl(c, order) { const usdc = CLUSTERS[c].usdc; const amt = order.pay.amounts.USDC.amount; return `solana:${MERCHANT}?amount=${amt}&spl-token=${usdc}&reference=${order.pay.reference}&label=${encodeURIComponent(process.env.BRAND_NAME || 'Sol Bite')}&message=${encodeURIComponent(order.name + ' gift card ' + order.value + ' ' + order.currency)}&memo=${encodeURIComponent(order.id)}`; }
function newReference() { return Keypair.generate().publicKey.toBase58(); }
/* Verifies a transaction pays the merchant at least 99.5 % of the quote in SOL or USDC. */
async function verifyPayment(order, signature, c = DEFAULT_CLUSTER) {
  const tx = await conn(c).getParsedTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' });
  if (!tx) throw new Error('transaction not found or not confirmed yet'); if (tx.meta && tx.meta.err) throw new Error('transaction failed');
  const want = order.pay.amounts; const mUsdc = merchantUsdcAta(c); const all = [...tx.transaction.message.instructions, ...((tx.meta && tx.meta.innerInstructions) || []).flatMap((x) => x.instructions)];
  let solPaid = 0n, usdcPaid = 0n; let from = null;
  for (const ix of all) { const p = ix.parsed; if (!p) continue;
    if (ix.program === 'system' && p.type === 'transfer' && p.info.destination === MERCHANT) { solPaid += BigInt(p.info.lamports); from = p.info.source; }
    if (ix.program === 'spl-token' && (p.type === 'transfer' || p.type === 'transferChecked') && p.info.destination === mUsdc) { const amt = p.type === 'transfer' ? p.info.amount : p.info.tokenAmount.amount; usdcPaid += BigInt(amt); from = p.info.authority || from; } }
  if (solPaid > 0n && solPaid * 1000n >= BigInt(want.SOL.lamports) * 995n) return { token: 'SOL', from, amount: solPaid.toString() };
  if (usdcPaid > 0n && usdcPaid * 1000n >= BigInt(want.USDC.units) * 995n) return { token: 'USDC', from, amount: usdcPaid.toString() };
  if (solPaid > 0n || usdcPaid > 0n) throw new Error('amount below quote');
  throw new Error('transaction does not pay the merchant');
}
/* Solana Pay: any transaction that includes the reference key */
async function findReference(reference, c = DEFAULT_CLUSTER) { const sigs = await conn(c).getSignaturesForAddress(new PublicKey(reference), { limit: 5 }); const ok = sigs.find((s) => !s.err); return ok ? ok.signature : null; }

/* ---- status ---- */
const ST = { at: 0, slots: {} };
async function slots() { if (Date.now() - ST.at < 60000) return ST.slots; const out = {}; await Promise.all(Object.keys(CLUSTERS).map(async (c) => { try { out[c] = await Promise.race([conn(c).getSlot(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))]); } catch { out[c] = null; } })); ST.slots = out; ST.at = Date.now(); return out; }

/* ---- HTTP ---- */
async function solanaApi(req, res, url, h) {
  const { send, fail, store } = h; const p = url.pathname; let m; const c = cluster(url.searchParams.get('cluster'));
  if (p === '/api/rpc') return rpcProxy(req, res, url, h);
  if (req.method === 'GET' && p === '/api/coins') { try { const d = await coins(c, store, url.searchParams.get('fresh') === '1'); return send(res, 200, { cluster: c, now: Date.now(), ...d }, { 'cache-control': 'no-store' }); } catch (e) { return fail(res, 502, 'rpc: ' + e.message); } }
  if (req.method === 'GET' && (m = /^\/api\/coins\/([1-9A-HJ-NP-Za-km-z]{32,44})$/.exec(p))) {
    try { const d = await coins(c, store); const r = d.coins.find((x) => x.address === m[1]); if (!r) return fail(res, 404, 'no such coin'); const buyer = url.searchParams.get('buyer'); const paid = buyer && isPk(buyer) ? await paidOf(c, store, r.address, buyer) : null; return send(res, 200, { ...r, paid, feeTo: d.feeTo }, { 'cache-control': 'no-store' }); } catch (e) { return fail(res, 502, 'rpc: ' + e.message); }
  }
  if (req.method === 'GET' && (m = /^\/api\/coins\/([1-9A-HJ-NP-Za-km-z]{32,44})\/buys$/.exec(p))) { try { return send(res, 200, { items: await buys(c, store, m[1], url.searchParams.get('fresh') === '1') }, { 'cache-control': 'no-store' }); } catch (e) { return fail(res, 502, 'rpc: ' + e.message); } }
  if (req.method === 'GET' && p === '/api/feed') { const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 50)); try { return send(res, 200, { cluster: c, items: await feed(c, store, limit) }, { 'cache-control': 'no-store' }); } catch (e) { return fail(res, 502, 'rpc: ' + e.message); } }
  if (req.method === 'GET' && p === '/api/buys') { const w = url.searchParams.get('wallet'); if (!isPk(w)) return fail(res, 400, 'wallet required'); try { return send(res, 200, { items: await buysByWallet(c, store, w) }); } catch (e) { return fail(res, 502, 'rpc: ' + e.message); } }
  if (req.method === 'GET' && (m = /^\/api\/coins\/ix\/(create|buy|finalize|claim|refund|swap)$/.exec(p))) {
    const pid = programOf(c, store); if (!pid) return fail(res, 503, 'program not deployed on ' + c); const q = url.searchParams; const who = q.get('wallet'); if (!isPk(who)) return fail(res, 400, 'wallet required'); const W = new PublicKey(who);
    try {
      if (m[1] === 'create') { const mint = q.get('coinMint'); if (!isPk(mint)) return fail(res, 400, 'coinMint required'); const name = String(q.get('name') || '').slice(0, 32), symbol = String(q.get('symbol') || '').toUpperCase().slice(0, 8), restaurant = String(q.get('restaurant') || '').slice(0, 24); const target = BigInt(q.get('target') || '0'); const duration = Number(q.get('duration') || 0); if (name.length < 2 || symbol.length < 2 || !restaurant || target < 1000n || duration < 3600) return fail(res, 400, 'name, symbol, restaurant, target (raw units) and duration (seconds, >= 3600) required');
        const payMint = q.get('payMint'); const pay = payMint && payMint !== 'SOL' ? { mint: new PublicKey(payMint), is2022: q.get('pay2022') === '1' } : null; const out = S.ixCreate(pid, W, new PublicKey(mint), { name, symbol, restaurant, target, duration, pay }); return send(res, 200, { ix: S.ixJson(out.ix), raise: out.raise.toBase58() }); }
      const d = await coins(c, store); const r = d.coins.find((x) => x.address === q.get('raise')); if (!r) return fail(res, 404, 'no such coin');
      if (m[1] === 'buy') return send(res, 200, { ix: S.ixJson(S.ixBuy(pid, W, r, BigInt(q.get('amount') || '0'))) });
      if (m[1] === 'finalize') { if (!d.feeTo) return fail(res, 503, 'program config missing'); return send(res, 200, { ix: S.ixJson(S.ixFinalize(pid, W, r, new PublicKey(d.feeTo))) }); }
      if (m[1] === 'claim') return send(res, 200, { ix: S.ixJson(S.ixClaim(pid, W, r)) });
      if (m[1] === 'refund') return send(res, 200, { ix: S.ixJson(S.ixRefund(pid, W, r)) });
      if (m[1] === 'swap') { const amountIn = BigInt(q.get('amountIn') || '0'); const coinToPay = q.get('coinToPay') === '1'; const quote = S.quoteSwap(r, amountIn, coinToPay); const minOut = quote - quote * BigInt(Math.round(Number(q.get('slippageBps') || 100))) / 10000n; return send(res, 200, { ix: S.ixJson(S.ixSwap(pid, W, r, amountIn, minOut, coinToPay)), quote: quote.toString(), minOut: minOut.toString() }); }
    } catch (e) { return fail(res, 400, e.message); }
  }
  return fail(res, 404, 'no such route');
}

module.exports = { CLUSTERS, DEFAULT_CLUSTER, MERCHANT, cluster, conn, isPk, b58decode, b58encode, verifySignature, config, programOf, coins, paidOf, buys, feed, buysByWallet, solPrice, walletAmounts, merchantUsdcAta, payUrl, newReference, verifyPayment, findReference, slots, solanaApi };
