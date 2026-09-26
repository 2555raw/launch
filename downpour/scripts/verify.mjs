/* The Verify page's checks, from a terminal. If the two ever disagree, trust this.
 *
 *   node scripts/verify.mjs --rpc <url> --pad <launchpad> [--coin <coin>] [--from-block <n>]
 *
 * Without --coin it walks every coin the pad has opened. Exits 1 if any check fails. */
import { createPublicClient, formatUnits, getAddress, http, keccak256, parseAbiItem } from 'viem';
import { args, artifacts } from './lib/common.mjs';

const opts = args();
if (!opts.rpc || !opts.pad) {
  console.log('usage: node scripts/verify.mjs --rpc <url> --pad <launchpad address> [--coin <address>] [--from-block <n>]');
  process.exit(2);
}
const client = createPublicClient({ transport: http(opts.rpc) });
const pad = getAddress(opts.pad);
const { Launchpad: L, CurrencyDesk: D, Coin: C } = artifacts;
const read = (address, abi, functionName, a = []) => client.readContract({ address, abi, functionName, args: a });
const balanceOf = parseAbiItem('function balanceOf(address) view returns (uint256)');
const created = parseAbiItem(
  'event CoinCreated(address indexed coin, address indexed creator, address indexed currency, string name, string symbol, string meta, uint256 virtualQuote)',
);
const CURVE = 800_000_000n * 10n ** 18n;
const TOTAL = 1_000_000_000n * 10n ** 18n;

const mask = (code, ranges) => {
  let s = code.toLowerCase().replace(/^0x/, '');
  for (const [start, len] of ranges) s = s.slice(0, start * 2) + '0'.repeat(len * 2) + s.slice((start + len) * 2);
  return s;
};

let failures = 0;
const report = (ok, title, detail) => {
  if (!ok) failures++;
  console.log(`  ${ok === null ? '?' : ok ? '✓' : '✗'} ${title}\n      ${detail}`);
};

console.log(`pad ${pad}`);
const padCode = (await client.getCode({ address: pad })) ?? '0x';
report(
  padCode !== '0x' && mask(padCode, L.immutables) === mask(L.deployedBytecode, L.immutables),
  'the pad runs the published Launchpad',
  `runtime code compared byte for byte with ${L.immutables.length} immutable slots masked`,
);
const impl = await read(pad, L.abi, 'coinImplementation');
const implHash = keccak256((await client.getCode({ address: impl })) ?? '0x');
report(implHash === keccak256(C.deployedBytecode), 'its coin implementation is the published Coin', `${impl} hashes to ${implHash}`);
const desk = await read(pad, L.abi, 'desk');

const coins = opts.coin
  ? [getAddress(opts.coin)]
  : await (async () => {
      const n = await read(pad, L.abi, 'coinsCount');
      const out = [];
      for (let i = 0n; i < n; i++) out.push(await read(pad, L.abi, 'allCoins', [i]));
      return out;
    })();

for (const coin of coins) {
  console.log(`\ncoin ${coin}`);
  const code = ((await client.getCode({ address: coin })) ?? '0x').toLowerCase();
  const expected = `0x3d3d3d3d363d3d37363d73${impl.slice(2).toLowerCase()}5af43d3d93803e602a57fd5bf3`;
  report(code === expected, 'is a clone of the pad’s coin', code === expected ? `delegates to ${impl}` : `found ${(code.length - 2) / 2} bytes of other code`);
  const isCoin = await read(pad, L.abi, 'isCoin', [coin]);
  const minter = await read(coin, C.abi, 'launchpad').catch(() => '0x0000000000000000000000000000000000000000');
  report(isCoin && getAddress(minter) === pad, 'was opened by this pad', `isCoin=${isCoin}, minted by ${minter}`);
  if (!isCoin) continue;

  const m = await read(pad, L.abi, 'getMarket', [coin]);
  const listed = await read(desk, D.abi, 'isListed', [m.currency]);
  const cur = listed ? await read(desk, D.abi, 'getCurrency', [m.currency]) : { code: '?', decimals: 18 };
  const q = (v) => `${formatUnits(v, Number(cur.decimals))} ${cur.code}`;
  report(listed, 'is paired with a currency on the desk', `${m.currency} = ${cur.code}`);

  try {
    const logs = await client.getLogs({ address: pad, event: created, args: { coin }, fromBlock: opts['from-block'] ? BigInt(opts['from-block']) : 'earliest', toBlock: 'latest' });
    const at = logs[0]?.args.currency;
    report(!!at && getAddress(at) === getAddress(m.currency), 'has kept its launch currency', at ? `launch event (block ${logs[0].blockNumber}) names ${at}` : 'launch event not found in range');
  } catch (e) {
    report(null, 'has kept its launch currency', `log search refused by the RPC; pass --from-block <deploy block>`);
  }

  const sums = m.graduated ? m.reserveQuote === m.realQuote : m.reserveQuote === m.virtualQuote + m.realQuote;
  const circ = m.graduated ? TOTAL - m.reserveToken : CURVE - m.curveLeft;
  const payout = circ === 0n ? 0n : (m.reserveQuote * circ) / (m.reserveToken + circ);
  report(sums && payout <= m.realQuote, 'books balance and cover a full sell-back', `backing ${q(m.realQuote)}, full sell-back pays ${q(payout)}`);

  const [held, backing, fees] = await Promise.all([
    read(m.currency, [balanceOf], 'balanceOf', [pad]),
    read(pad, L.abi, 'backing', [m.currency]),
    read(pad, L.abi, 'totalFeesOwed', [m.currency]),
  ]);
  report(held >= backing + fees, 'the pad holds the money', `holds ${q(held)} ≥ owes ${q(backing + fees)}`);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nevery check passed');
process.exit(failures ? 1 : 0);
