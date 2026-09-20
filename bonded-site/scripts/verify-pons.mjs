#!/usr/bin/env node
/* Proves, against Robinhood Chain itself, that a Bonded launch through Pons V2 pairs
   the coin with the chosen stock token. Run from any machine with Node 18+:

     node scripts/verify-pons.mjs                       # discover + check everything
     node scripts/verify-pons.mjs --stocks TSLA=0x…,NVDA=0x…   # check your own addresses
     node scripts/verify-pons.mjs --from 0xYourWallet   # also simulate launchToken as you
     node scripts/verify-pons.mjs --launcher 0x…        # check the deployed LilyPadLauncher may launch
     node scripts/verify-pons.mjs --rpc https://…       # another RPC
     node scripts/verify-pons.mjs --lookback 2000000    # more blocks of history

   What it does, in order:
     1. eth_chainId is 4663 and the factory has code.
     2. launchEnabled(), launchFee(), launchConfigCount() + every config.
     3. Scans TokenLaunched events and tallies the quote token of every launch.
        Each quote token is resolved (symbol, decimals) and checked with
        approvedPairTokens() and pairTokenEconomics().
     4. For the stock quotes (given or discovered) it opens one real curve per
        stock and confirms curve.pairToken() == the stock and reads reserves.
     5. Simulates launchToken(...) with a stock as quote (eth_call). A clean
        simulation, or a revert that is only about funds, means the call shape is right.
   Exit code 0 when every check passes. */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const here = path.dirname(fileURLToPath(import.meta.url));
await import(path.join(here, '..', 'pons', 'keccak.js'));
await import(path.join(here, '..', 'pons', 'abi.js'));
const A = globalThis.bdAbi;

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : '1'] : []).filter(Boolean));
const RPC = args.rpc || 'https://rpc.mainnet.chain.robinhood.com';
const FACTORY = (args.factory || '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e').toLowerCase();
const LOOKBACK = Number(args.lookback || 400_000);
const CHUNK = Number(args.chunk || 10_000);
const given = Object.fromEntries((args.stocks || '').split(',').filter(Boolean).map(kv => kv.split('=')).map(([k, v]) => [k.toUpperCase(), v.toLowerCase()]));

const rpc = A.makeRpc(RPC);
const call = async (to, name, types, argv, out, extra = {}) => A.decodeResult(out, await rpc('eth_call', [{ to, data: A.encodeCall(name, types, argv), ...extra }, 'latest']));
const SOCIALS = { tuple: ['string', 'string', 'string', 'string', 'string'] };
const TOKEN_PARAMS = { tuple: ['string', 'string', 'string', 'string', SOCIALS, 'address', 'uint16', 'bool', 'bytes32', 'bytes32'] };
const LAUNCH_CONFIG = { tuple: ['uint256', 'uint256', 'uint256', 'uint256', 'uint24', 'int24', 'bool'] };
const T_LAUNCHED = A.topic('TokenLaunched', ['address', 'address', 'address', 'address', 'uint256', 'uint256']);

let failed = 0;
const ok = (msg) => console.log('  ✔', msg);
const bad = (msg) => { failed++; console.log('  ✘', msg); };
const info = (msg) => console.log('   ', msg);
const fmt = (n, d) => (Number(n) / 10 ** d).toLocaleString('en-US', { maximumFractionDigits: 6 });

console.log(`\nBonded × Pons V2 verification\n  rpc ${RPC}\n  factory ${FACTORY}\n`);

// 1. chain + code
console.log('1. Chain');
try {
  const id = parseInt(await rpc('eth_chainId'), 16);
  id === 4663 ? ok(`chainId ${id} (Robinhood Chain)`) : bad(`chainId ${id}, expected 4663`);
  const code = await rpc('eth_getCode', [FACTORY, 'latest']);
  code && code !== '0x' ? ok(`factory has code (${(code.length - 2) / 2} bytes)`) : bad('no code at the factory address');
} catch (e) { bad('cannot reach the RPC: ' + e.message); console.log('\nStopping: without the RPC nothing else can be checked.\n'); process.exit(1); }

// 2. factory state
console.log('\n2. Factory');
const [enabled] = await call(FACTORY, 'launchEnabled', [], [], ['bool']);
enabled ? ok('launchEnabled() = true') : bad('launchEnabled() = false — launches are paused');
const [fee] = await call(FACTORY, 'launchFee', [], [], ['uint256']);
ok(`launchFee() = ${fmt(fee, 18)} ETH`);
const [count] = await call(FACTORY, 'launchConfigCount', [], [], ['uint256']);
ok(`launchConfigCount() = ${count}`);
const configs = [];
for (let i = 0; i < Number(count); i++) {
  const [c] = await call(FACTORY, 'getLaunchConfig', ['uint256'], [i], [LAUNCH_CONFIG]);
  configs.push({ id: i, supply: c[0], curveFeeBps: c[1], phantomQuote: c[2], graduationThreshold: c[3], poolFee: c[4], tickSpacing: c[5], enabled: c[6] });
  info(`config ${i}: supply ${fmt(c[0], 18)} · curve fee ${Number(c[1]) / 100}% · pool fee ${Number(c[4]) / 10000}% · ${c[6] ? 'enabled' : 'disabled'}`);
}
const config = configs.find(c => c.enabled);
config ? ok(`using launch config ${config.id}`) : bad('no enabled launch config');

// 3. launches and their quote tokens
console.log(`\n3. Launches (last ${LOOKBACK.toLocaleString()} blocks)`);
const head = parseInt(await rpc('eth_blockNumber'), 16);
const windows = [];
for (let a = Math.max(0, head - LOOKBACK); a <= head; a += CHUNK) windows.push([a, Math.min(head, a + CHUNK - 1)]);
const logs = [];
for (let i = 0; i < windows.length; i += 6) {
  const parts = await Promise.all(windows.slice(i, i + 6).map(([a, b]) => rpc('eth_getLogs', [{ address: FACTORY, topics: [T_LAUNCHED], fromBlock: A.hex(a), toBlock: A.hex(b) }])));
  logs.push(...parts.flat());
}
const launches = logs.map(l => {
  const [pairToken, launchConfigId] = A.decodeTuple(['address', 'uint256', 'uint256'], A.strip(l.data));
  return { token: '0x' + l.topics[1].slice(26), curve: '0x' + l.topics[2].slice(26), deployer: '0x' + l.topics[3].slice(26), pairToken: pairToken.toLowerCase(), launchConfigId, block: parseInt(l.blockNumber, 16), tx: l.transactionHash };
});
launches.length ? ok(`${launches.length} TokenLaunched events found`) : bad('no TokenLaunched events in range (raise --lookback or check the factory address)');
const tally = {};
for (const l of launches) tally[l.pairToken] = (tally[l.pairToken] || 0) + 1;
const quotes = {};
for (const [addr, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
  const [sym] = await call(addr, 'symbol', [], [], ['string']).catch(() => ['?']);
  const [approved] = await call(FACTORY, 'approvedPairTokens', ['address'], [addr], ['bool']);
  const [phantom, threshold, dec] = await call(FACTORY, 'pairTokenEconomics', ['address'], [addr], ['uint256', 'uint256', 'uint8']).catch(() => [0n, 0n, 18n]);
  quotes[addr] = { sym, approved, dec: Number(dec), n };
  info(`${sym.padEnd(8)} ${addr}  ${String(n).padStart(4)} launches  approved=${approved}  threshold ${fmt(threshold, Number(dec))} ${sym}`);
}
const stockQuotes = Object.entries(quotes).filter(([, q]) => q.approved && !/^(W?ETH|USDG|USDC|CBBTC|WBTC)$/i.test(q.sym));
stockQuotes.length ? ok(`${stockQuotes.length} approved non-stablecoin quote tokens seen on real launches (these are the stock tokens)`) : bad('no stock-like quote token seen on launches');

// given addresses
for (const [sym, addr] of Object.entries(given)) {
  const [approved] = await call(FACTORY, 'approvedPairTokens', ['address'], [addr], ['bool']);
  const [onSym] = await call(addr, 'symbol', [], [], ['string']).catch(() => ['?']);
  approved ? ok(`${sym} ${addr} (on-chain symbol ${onSym}) is approvedPairTokens()`) : bad(`${sym} ${addr} is NOT an approved quote token`);
}

// 4. one real curve per stock quote
console.log('\n4. Curves');
const sample = {};
for (const l of launches) if (quotes[l.pairToken]?.approved && !sample[l.pairToken]) sample[l.pairToken] = l;
for (const [addr, l] of Object.entries(sample).slice(0, 12)) {
  const q = quotes[addr];
  try {
    const [pairToken] = await call(l.curve, 'pairToken', [], [], ['address']);
    const [token] = await call(l.curve, 'token', [], [], ['address']);
    const [[qr, tr], [feeBps], [grad], [tsym]] = await Promise.all([
      call(l.curve, 'getReserves', [], [], ['uint256', 'uint256']), call(l.curve, 'feeBps', [], [], ['uint256']),
      call(l.curve, 'graduated', [], [], ['bool']), call(l.token, 'symbol', [], [], ['string']).catch(() => ['?']),
    ]);
    const paired = pairToken.toLowerCase() === addr && token.toLowerCase() === l.token.toLowerCase();
    (paired ? ok : bad)(`$${tsym} ↔ ${q.sym}: curve ${l.curve} pairToken()=${pairToken.slice(0, 10)}… reserves ${fmt(qr, q.dec)} ${q.sym} / ${fmt(tr, 18)} tokens · fee ${Number(feeBps) / 100}% · ${grad ? 'graduated' : 'on curve'}`);
  } catch (e) { bad(`curve ${l.curve}: ${A.revertReason(e)}`); }
}

// 4b. who may launch: your wallet and, if you deployed it, the LilyPad launcher
if (args.from || args.launcher) {
  console.log('\n4b. canLaunch');
  for (const [label, who] of [['--from', args.from], ['--launcher', args.launcher]].filter(x => x[1])) {
    const [can] = await call(FACTORY, 'canLaunch', ['address'], [who], ['bool']).catch(() => [null]);
    can === null ? bad(`canLaunch(${who}) reverted`) : (can ? ok : bad)(`canLaunch(${label} ${who}) = ${can}${!can && label === '--launcher' ? ' — a shared launcher would be blocked; launch on the factory directly' : ''}`);
  }
}

// 5. simulate a launch paired with a stock
console.log('\n5. Simulated launch');
const target = Object.entries(given)[0] || (stockQuotes[0] ? [stockQuotes[0][1].sym, stockQuotes[0][0]] : null);
if (!target || !config) bad('nothing to simulate (no stock quote token known)');
else {
  const [sym, quote] = target;
  const [economics] = await call(FACTORY, 'previewLaunchEconomics', ['uint256', 'address'], [config.id, quote], ['bytes32']);
  ok(`previewLaunchEconomics(${config.id}, ${sym}) = ${economics.slice(0, 18)}…`);
  const from = args.from || '0x000000000000000000000000000000000000dEaD';
  const params = ['Bonded Test', 'BNDT', '', 'verify-pons dry run', ['', '', '', '', ''], from, 0, false, economics, '0x' + '11'.repeat(32)];
  const data = A.encodeCall('launchToken', [TOKEN_PARAMS, 'uint256', 'address', 'address[]'], [params, config.id, quote, []]);
  const tx = { from, to: FACTORY, data, value: A.hex(fee) };
  const attempt = async (override) => rpc('eth_call', override ? [tx, 'latest', { [from]: { balance: '0x' + (10n ** 21n).toString(16) } }] : [tx, 'latest']);
  try {
    let res;
    try { res = await attempt(true); } catch (e) { if (/override|invalid argument|too many|params/i.test(e.message)) res = await attempt(false); else throw e; }
    const [token, curve] = A.decodeResult(['address', 'address'], res);
    ok(`launchToken(…, ${config.id}, ${sym}, []) simulates cleanly → token ${token}, curve ${curve}`);
    info(`send that exact calldata with value ${fmt(fee, 18)} ETH from your wallet and the coin is live, quoted in ${sym}`);
  } catch (e) {
    const reason = A.revertReason(e);
    if (/insufficient funds|balance|gas required exceeds/i.test(reason)) ok(`call shape accepted; the node only complains about funds for ${from} (${reason}). Re-run with --from <your funded wallet> to see it pass.`);
    else bad(`launchToken simulation reverted: ${reason}`);
  }
}

console.log(failed ? `\n${failed} check(s) failed.\n` : '\nAll checks passed: launching through Pons pairs the coin with the stock token.\n');
process.exit(failed ? 1 : 0);
