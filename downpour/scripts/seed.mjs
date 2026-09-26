/* Fills a fresh deployment with coins and trading history so the board is not empty.
 *
 *   npm run seed                 # local anvil: six traders, a few days of history
 *   RPC_URL=... PRIVATE_KEY=... npm run seed -- --light   # testnet: one wallet, a handful of trades
 *
 * On a local chain the script winds the clock forward between trades so charts
 * cover several days, then brings the chain back to the present. */
import { parseUnits, formatUnits, maxUint256 } from 'viem';
import { args, artifacts, connect, devAccount, readDeployment, send, walletFor, sleep } from './lib/common.mjs';

const opts = args();
const ctx = await connect({ rpc: opts.rpc });
const dep = readDeployment(ctx.chainId);
const local = ctx.chainId === 31337;
const light = opts.light === 'true' || !local;

const { Launchpad: L, CurrencyDesk: D, Router: R, TestCurrency: T, Coin: C } = artifacts;
const read = (address, abi, functionName, args = []) =>
  ctx.publicClient.readContract({ address, abi, functionName, args });

const currencyList = await read(dep.desk, D.abi, 'getCurrencies');
const tokenOf = Object.fromEntries(currencyList.map((c) => [c.code, c.token]));

/* Original demo coins: a name, a ticker, the currency it is paired with, a line of
 * description, and how hard the crowd piles in (share of the curve to fill). */
const COINS = [
  ['Tokyo Drizzle', 'DRIZZLE', 'JPY', 'Light rain over Shibuya, priced in yen.', 0.55],
  ['Samba Squall', 'SQUALL', 'BRL', 'A carnival gust that only moves in reais.', 0.72],
  ['Monsoon Masala', 'MASALA', 'INR', 'Four months of rain, one very spicy coin.', 0.38],
  ['Baguette Bolt', 'BOLT', 'EUR', 'Struck by lightning outside a Paris bakery.', 0.86],
  ['Lagos Thunder', 'THUNDA', 'NGN', 'Loud, bright and denominated in naira.', 0.47],
  ['Seoul Shower', 'SHOWER', 'KRW', 'A quick one on the way to the subway.', 0.29],
  ['Mariachi Mist', 'MIST', 'MXN', 'Fine mist, full band, paid in pesos.', 0.63],
  ['Teatime Tempest', 'TEMPEST', 'GBP', 'Brewing since four o’clock.', 0.21],
  ['Alpine Hail', 'HAIL', 'CHF', 'Small, cold, very precise. Swiss francs only.', 0.34],
  ['Bosphorus Puddle', 'PUDDLE', 'TRY', 'Every step splashes lira.', 0.18],
  ['Pho Flood', 'FLOOD', 'VND', 'A bowl that overflowed into the street.', 0.42],
  ['Braai Rain', 'BRAAI', 'ZAR', 'Never cancels the barbecue.', 0.26],
  ['Nugget Rain', 'NUGGET', 'XAU', 'It rains gold, measured in ounces.', 0.33],
  ['Buck Storm', 'BUCK', 'USD', 'Rained so hard it flooded into its own pool.', 1.0],
  ['Outback Downpour', 'OUTBACK', 'AUD', 'Once a decade, all at once.', 0.51],
  ['Maple Sleet', 'SLEET', 'CAD', 'Half snow, half syrup.', 0.15],
];

const traders = light ? [ctx.account] : [1, 2, 3, 4, 5, 6].map((i) => devAccount(i));
const wallets = traders.map((a) => walletFor(ctx, a));

async function rpc(method, params = []) {
  return ctx.publicClient.request({ method, params });
}
async function advance(seconds) {
  if (!local) return;
  await rpc('evm_increaseTime', [Math.floor(seconds)]);
  await rpc('evm_mine');
}

const approved = new Set();
async function ensureApproved(wallet, token, spender) {
  const key = `${wallet.account.address}:${token}:${spender}`;
  if (approved.has(key)) return;
  await send(ctx, { address: token, abi: T.abi, functionName: 'approve', args: [spender, maxUint256] }, wallet);
  approved.add(key);
}

async function topUp(wallet, token, want) {
  // Faucet until the wallet holds `want` (local faucets have no cooldown).
  for (let i = 0; i < 40; i++) {
    const bal = await read(token, T.abi, 'balanceOf', [wallet.account.address]);
    if (bal >= want) return bal;
    try {
      await send(ctx, { address: dep.desk, abi: D.abi, functionName: 'faucet', args: [token] }, wallet);
    } catch (e) {
      return bal; // cooldown on a public chain: trade with what there is
    }
  }
  return read(token, T.abi, 'balanceOf', [wallet.account.address]);
}

const rand = (() => {
  let s = 20260926;
  return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
})();

const targetUsd = await read(dep.launchpad, L.abi, 'targetRaiseUsd');
const plans = light ? COINS.slice(0, 6) : COINS;
const HISTORY_SECONDS = 4 * 24 * 3600;
const step = HISTORY_SECONDS / (plans.length * 9);

for (const [i, [name, symbol, code, description, fill]] of plans.entries()) {
  const currency = tokenOf[code];
  if (!currency) {
    console.log(`  skip ${symbol}: ${code} not listed`);
    continue;
  }
  const creator = wallets[i % wallets.length];
  const rate = currencyList.find((c) => c.code === code).rate;
  const usd = (x) => (parseUnits(String(x), 18) * rate) / 10n ** 18n; // x USD in this currency (18 decimals)

  await topUp(creator, currency, usd(400));
  await ensureApproved(creator, currency, dep.launchpad);
  const meta = JSON.stringify({ description, image: '', links: {} });
  const firstBuy = usd(20 + Math.round(rand() * 120));
  const receipt = await send(
    ctx,
    { address: dep.launchpad, abi: L.abi, functionName: 'createCoin', args: [name, symbol, meta, currency, firstBuy, 0n] },
    creator,
  );
  const coin = (await read(dep.launchpad, L.abi, 'allCoins', [BigInt((await read(dep.launchpad, L.abi, 'coinsCount')) - 1n)]));
  console.log(`  ${symbol.padEnd(8)} / ${code}  ${coin}`);

  // The crowd: buys until the curve is `fill` full, with some selling along the way.
  const targetRaise = (targetUsd * rate) / 10n ** 18n;
  const rounds = light ? 3 : 8;
  for (let r = 0; r < rounds; r++) {
    await advance(step * (0.4 + rand()));
    const w = wallets[Math.floor(rand() * wallets.length)];
    const market = await read(dep.launchpad, L.abi, 'getMarket', [coin]);
    if (market.graduated && fill < 1) break;
    const raised = market.realQuote;
    const goal = (targetRaise * BigInt(Math.round(fill * 1000))) / 1000n;
    const sellTurn = rand() < 0.28 && r > 1;
    if (sellTurn) {
      const bal = await read(coin, C.abi, 'balanceOf', [w.account.address]);
      if (bal > 0n) {
        const amount = (bal * BigInt(20 + Math.floor(rand() * 60))) / 100n;
        await send(ctx, { address: coin, abi: C.abi, functionName: 'approve', args: [dep.launchpad, amount] }, w);
        await send(ctx, { address: dep.launchpad, abi: L.abi, functionName: 'sell', args: [coin, amount, 0n, w.account.address] }, w);
        continue;
      }
    }
    let spend = goal > raised ? ((goal - raised) * BigInt(Math.round((1 / (rounds - r)) * 1000 * (0.7 + rand() * 0.8)))) / 1000n : usd(15);
    if (fill >= 1 && r === rounds - 1) spend = targetRaise * 2n; // push it over the edge
    if (spend < usd(5)) spend = usd(5);
    const have = await topUp(w, currency, spend);
    if (have < spend) spend = have;
    if (spend === 0n) continue;
    await ensureApproved(w, currency, dep.launchpad);
    await send(ctx, { address: dep.launchpad, abi: L.abi, functionName: 'buy', args: [coin, spend, 0n, w.account.address] }, w);
  }
  const m = await read(dep.launchpad, L.abi, 'getMarket', [coin]);
  const pct = m.graduated ? 'graduated' : `${(Number((800_000_000n * 10n ** 18n - m.curveLeft) * 10000n / (800_000_000n * 10n ** 18n)) / 100).toFixed(1)}% of curve`;
  console.log(`           raised ${formatUnits(m.realQuote, 18)} ${code}, ${pct}`);
}

// A couple of cross-currency swaps through the router, so Swap has history too.
if (!light) {
  const w = wallets[0];
  const all = await read(dep.launchpad, L.abi, 'getCoins', [0n, 100n]);
  const usdToken = tokenOf.USD;
  await topUp(w, usdToken, parseUnits('300', 18));
  await ensureApproved(w, usdToken, dep.router);
  for (const target of all.filter((c) => !c.graduated).slice(0, 3)) {
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600 * 24 * 30);
    await send(
      ctx,
      { address: dep.router, abi: R.abi, functionName: 'swap', args: [usdToken, target.coin, parseUnits('60', 18), 0n, w.account.address, deadline] },
      w,
    );
    await advance(step);
  }
}

if (local) {
  // Bring the chain's clock back to now.
  const block = await ctx.publicClient.getBlock();
  const behind = Math.floor(Date.now() / 1000) - Number(block.timestamp);
  if (behind > 0) await advance(behind);
  await sleep(200);
}
console.log('seeded.');
