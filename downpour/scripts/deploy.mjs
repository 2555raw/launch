/* Deploys the pad to any EVM chain and tells the web app where it is.
 *
 *   RPC_URL=https://sepolia.base.org PRIVATE_KEY=0x... npm run deploy
 *   npm run deploy                       # local anvil at 127.0.0.1:8545, dev key
 *
 * What it does, in order:
 *   1. CurrencyDesk, then every currency in shared/currencies.json as a test
 *      currency the desk mints (batched, ~20 per transaction).
 *   2. Launchpad (curve size, fees, snipe tax from the environment).
 *   3. Router, wired into the pad; the deployer becomes the desk's keeper.
 *   4. deployments/<chainId>.json, merged into web/src/generated/.
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
 *   ONLY               comma list of currency codes to list, e.g. USD,EUR,JPY */
import { parseUnits } from 'viem';
import { args, connect, currencies, deployContract, send, toWad, writeDeployment, artifacts } from './lib/common.mjs';

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

const only = env('ONLY', '')
  .split(',')
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);
const list = currencies.filter((c) => !only.length || only.includes(c.code));
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

const pad = await deployContract(ctx, 'Launchpad', [
  me,
  desk.address,
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
  coinImplementation,
  deployBlock: Number(desk.block),
  deployedAt: new Date().toISOString(),
  testCurrencies: true,
};
const file = writeDeployment(record);
console.log(`done. web config updated: ${file}`);
