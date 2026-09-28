/* Deploys the pad to any EVM chain and tells the web app where it is.
 *
 *   RPC_URL=https://sepolia.base.org PRIVATE_KEY=0x... npm run deploy
 *   npm run deploy                       # local anvil at 127.0.0.1:8545, dev key
 *
 * What it does, in order:
 *   1. CurrencyDesk, then every currency in shared/currencies.json as a test
 *      currency the desk mints (batched, ~20 per transaction).
 *   2. Uniswap V3: the chain's own position manager (shared/uniswap.json) or, where
 *      it has none (a local chain, a testnet), copies of Uniswap's own contracts
 *      (WETH, factory, position manager; plus the quoter and router the swap page
 *      uses, from their npm packages). Every coin opens as a pool of that factory.
 *   3. Launchpad (starting market cap from the environment).
 *   4. Router, wired into the pad; the deployer becomes the desk's keeper.
 *   5. deployments/<chainId>.json, merged into web/src/generated/.
 *
 * Environment (all optional):
 *   TREASURY           where protocol fees go                (deployer)
 *   KEEPER             who may post FX rates                 (deployer)
 *   START_MCAP_USD     what a coin's supply is worth at launch, in USD (4000)
 *   DESK_FEE_BPS       conversion fee                        (10)
 *   FAUCET_USD / FAUCET_COOLDOWN                             (1000 / 3600; local: 5000 / 0)
 *   PUBLIC_RPC         RPC the web app should use            (RPC_URL)
 *   EXPLORER           block explorer base URL               (none)
 *   CHAIN_NAME         display name                          ("Chain <id>")
 *   ONLY               comma list of currency codes to list, e.g. USD,EUR,JPY
 *   REAL_TOKENS        JSON list of real tokens to list instead of test currencies,
 *                      [{"code":"USD","symbol":"USDG","token":"0x…"}] (shared/real-tokens.json by chain)
 *   POSITION_MANAGER   a Uniswap V3 position manager to use  (the chain's own, or new copies) */
import { encodeAbiParameters, parseUnits } from 'viem';
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

/** Uniswap's contracts take their constructor arguments already encoded (older solc, same ABI encoding). */
async function deployRaw(name, types, values) {
  const a = artifacts[name];
  const bytecode = `${a.bytecode}${encodeAbiParameters(types, values).slice(2)}`;
  const hash = await ctx.walletClient.deployContract({ abi: [], bytecode });
  const receipt = await ctx.publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success' || !receipt.contractAddress) throw new Error(`deploy failed: ${name}`);
  return receipt.contractAddress;
}

const own = uniswap.v3[ctx.chainId];
let positionManager = env('POSITION_MANAGER', own?.positionManager);
let uniswapFactory = own?.factory;
const extras = {};
if (!positionManager) {
  const zero = '0x0000000000000000000000000000000000000000';
  const weth = (await deployContract(ctx, 'WETH9', [])).address;
  uniswapFactory = (await deployContract(ctx, 'UniswapV3Factory', [])).address;
  positionManager = await deployRaw('NonfungiblePositionManager', [{ type: 'address' }, { type: 'address' }, { type: 'address' }], [uniswapFactory, weth, zero]);
  // what the swap page prices and trades real tokens through, where the chain has no Uniswap of its own
  extras.weth = weth;
  extras.quoterV2 = await deployRaw('QuoterV2', [{ type: 'address' }, { type: 'address' }], [uniswapFactory, weth]);
  extras.swapRouter = await deployRaw('SwapRouter', [{ type: 'address' }, { type: 'address' }], [uniswapFactory, weth]);
  console.log('  uniswap v3     ', positionManager, '(copies: factory', uniswapFactory, 'quoter', extras.quoterV2, 'router', extras.swapRouter + ')');
} else {
  const named = await ctx.publicClient.readContract({ address: positionManager, abi: artifacts.NonfungiblePositionManager.abi, functionName: 'factory' });
  if (uniswapFactory && named.toLowerCase() !== uniswapFactory.toLowerCase()) throw new Error(`position manager ${positionManager} names factory ${named}, not ${uniswapFactory}`);
  uniswapFactory = named;
  console.log('  uniswap v3     ', positionManager, '(factory', uniswapFactory + ')');
}

const pad = await deployContract(ctx, 'Launchpad', [me, desk.address, positionManager, env('TREASURY', me), parseUnits(String(env('START_MCAP_USD', '4000')), 18)]);
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
  positionManager,
  uniswapFactory,
  ...extras,
  coinImplementation,
  deployBlock: Number(desk.block),
  deployedAt: new Date().toISOString(),
  testCurrencies: real.length === 0,
};
const file = writeDeployment(record);
console.log(`done. web config updated: ${file}`);
