/* Deploys the pad to any EVM chain and tells the web app where it is.
 *
 *   RPC_URL=https://sepolia.base.org PRIVATE_KEY=0x... npm run deploy
 *   npm run deploy                       # local anvil at 127.0.0.1:8545, dev key
 *
 * What it does, in order:
 *   1. CurrencyDesk, then every currency in shared/currencies.json as a test
 *      currency the desk mints (batched, ~20 per transaction).
 *   2. Uniswap V2: the chain's own factory (shared/uniswap.json) or, where it has
 *      none (a local chain, a testnet), a copy of Uniswap's (contracts/uniswap/).
 *      Coins graduate into pairs of that factory.
 *   3. Launchpad (curve size, fees, snipe tax from the environment).
 *   4. Router, wired into the pad; the deployer becomes the desk's keeper.
 *   5. deployments/<chainId>.json, merged into web/src/generated/.
 *
 * Environment (all optional):
 *   TREASURY           where protocol fees accrue          (deployer)
 *   KEEPER             who may post FX rates               (deployer)
 *   TARGET_RAISE_USD   what a full curve raises, in USD    (12000)
 *   PROTOCOL_FEE_BPS / CREATOR_FEE_BPS                     (50 / 50)
 *   SNIPE_TAX_BPS / SNIPE_WINDOW                           (2000 / 15)
 *   DESK_FEE_BPS       conversion fee                      (10)
 *   FAUCET_USD / FAUCET_COOLDOWN                           (1000 / 3600; local: 5000 / 0)
 *   PUBLIC_RPC         RPC the web app should use          (RPC_URL)
 *   EXPLORER           block explorer base URL             (none)
 *   CHAIN_NAME         display name                        ("Chain <id>")
 *   ONLY               comma list of currency codes to list, e.g. USD,EUR,JPY
 *   REAL_TOKENS        JSON list of real tokens to list instead of test currencies,
 *                      [{"code":"USD","symbol":"USDG","token":"0x…"}] (shared/real-tokens.json by chain)
 *   UNISWAP_V2_FACTORY a Uniswap V2 factory to use         (the chain's own, or a new copy) */
import { parseUnits } from 'viem';
import { readFileSync } from 'node:fs';
import { args, connect, currencies, deployContract, send, toWad, writeDeployment, artifacts } from './lib/common.mjs';

const uniswap = JSON.parse(readFileSync(new URL('../shared/uniswap.json', import.meta.url), 'utf8'));
const realTokens = JSON.parse(readFileSync(new URL('../shared/real-tokens.json', import.meta.url), 'utf8'));

const opts = args();
const env = (k, d) => opts[k.toLowerCase()] ?? process.env[k] ?? d;

const ctx = await connect({ rpc: opts.rpc });
if (!ctx.walletClient) throw new Error('set PRIVATE_KEY to deploy to a non-local chain');
const local = ctx.chainId === 31337;
const me = ctx.account.address;
console.log(`deploying to chain ${ctx.chainId} from ${me}`);

const faucetUsd = parseUnits(String(env('FAUCET_USD', local ? '5000' : '1000')), 18);
const faucetCooldown = Number(env('FAUCET_COOLDOWN', local ? '0' : '3600'));
const desk = await deployContract(ctx, 'CurrencyDesk', [me, Number(env('DESK_FEE_BPS', '10')), faucetUsd, faucetCooldown]);
console.log('  desk          ', desk.address);

// Real tokens where the chain has them (shared/real-tokens.json, or REAL_TOKENS as the
// same JSON list): listed as they are, at the reference rate; the keeper posts the next.
const real = env('REAL_TOKENS', '') ? JSON.parse(env('REAL_TOKENS')) : (realTokens[ctx.chainId] ?? []);
for (const t of real) {
  const rate = t.code === 'USD' ? 1 : currencies.find((c) => c.code === t.code)?.rate;
  if (!rate) throw new Error(`no reference rate for ${t.code}`);
  await send(ctx, { address: desk.address, abi: artifacts.CurrencyDesk.abi, functionName: 'listCurrency', args: [t.token, t.code, toWad(rate)] });
  console.log(`  listed         ${t.symbol ?? t.token} as ${t.code} at ${rate} per USD`);
}

const only = env('ONLY', '')
  .split(',')
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);
const list = real.length ? [] : currencies.filter((c) => !only.length || only.includes(c.code));
const BATCH = 20;
for (let i = 0; i < list.length; i += BATCH) {
  const batch = list.slice(i, i + BATCH).map((c) => ({
    code: c.code,
    name: `Test ${c.name}`,
    symbol: `t${c.code}`,
    decimals: 18,
    rate: toWad(c.rate),
  }));
  await send(ctx, {
    address: desk.address,
    abi: artifacts.CurrencyDesk.abi,
    functionName: 'createTestCurrencies',
    args: [batch],
  });
  console.log(`  currencies     ${Math.min(i + BATCH, list.length)}/${list.length}`);
}

let uniswapFactory = env('UNISWAP_V2_FACTORY', uniswap.v2Factory[ctx.chainId]);
if (!uniswapFactory) {
  // a copy nobody can switch Uniswap's protocol fee on for (feeToSetter = 0)
  uniswapFactory = (await deployContract(ctx, 'UniswapV2Factory', ['0x0000000000000000000000000000000000000000'])).address;
  console.log('  uniswap v2     ', uniswapFactory, '(a copy)');
} else {
  console.log('  uniswap v2     ', uniswapFactory);
}

const pad = await deployContract(ctx, 'Launchpad', [
  me,
  desk.address,
  uniswapFactory,
  env('TREASURY', me),
  parseUnits(String(env('TARGET_RAISE_USD', '12000')), 18),
  Number(env('PROTOCOL_FEE_BPS', '50')),
  Number(env('CREATOR_FEE_BPS', '50')),
  Number(env('SNIPE_TAX_BPS', '2000')),
  Number(env('SNIPE_WINDOW', '15')),
]);
console.log('  launchpad     ', pad.address);

const router = await deployContract(ctx, 'Router', [pad.address]);
console.log('  router        ', router.address);

await send(ctx, { address: pad.address, abi: artifacts.Launchpad.abi, functionName: 'setRouter', args: [router.address] });
await send(ctx, {
  address: desk.address,
  abi: artifacts.CurrencyDesk.abi,
  functionName: 'setKeeper',
  args: [env('KEEPER', me), true],
});

const coinImplementation = await ctx.publicClient.readContract({
  address: pad.address,
  abi: artifacts.Launchpad.abi,
  functionName: 'coinImplementation',
});

const record = {
  chainId: ctx.chainId,
  name: env('CHAIN_NAME', local ? 'Local galaxy' : `Chain ${ctx.chainId}`),
  rpcUrl: env('PUBLIC_RPC', ctx.url),
  explorer: env('EXPLORER', ''),
  desk: desk.address,
  launchpad: pad.address,
  router: router.address,
  uniswapFactory,
  coinImplementation,
  deployBlock: Number(desk.block),
  deployedAt: new Date().toISOString(),
  testCurrencies: real.length === 0,
};
const file = writeDeployment(record);
console.log(`done. web config updated: ${file}`);
