/* Deploys the pad from the browser, signed by the connected wallet: the same steps as
 * scripts/deploy.mjs (desk, the currencies: the chain's real tokens where it has them,
 * else the test currencies in batches; Uniswap V3 where the chain has none of its own;
 * launchpad, router, keeper), so nobody has to hand a private key to a script. Progress
 * is saved after every step and read back from the chain, so a closed tab carries on
 * where it stopped. */
import { createPublicClient, encodeAbiParameters, http, parseUnits, zeroAddress, type Address, type Hash, type Hex, type PublicClient, type WalletClient } from 'viem';
import currencies from '@shared/currencies.json';
import realTokens from '@shared/real-tokens.json';
import uniswap from '@shared/uniswap.json';
import type { Deployment } from '../config/chains';
import { chainMeta, DEPLOYMENTS, viemChain } from '../config/chains';
import { feedRates } from './fx';

/** A token that already trades on the chain, listed on the desk under a currency code. */
export interface RealToken {
  code: string;
  symbol: string;
  token: Address;
}

/** The real tokens the desk lists on this chain (none: it mints test currencies). */
export function realTokensOf(chainId: number): RealToken[] {
  const list = (realTokens as Record<string, unknown>)[String(chainId)];
  return Array.isArray(list) ? (list as RealToken[]) : [];
}

/** `USD:0x…,ETH:0x…` from the page's ?tokens=, for a chain whose tokens are not on file. */
export function parseTokensParam(raw: string | null): RealToken[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((part) => part.trim().split(':'))
    .filter(([code, token]) => code && /^0x[0-9a-fA-F]{40}$/.test(token ?? ''))
    .map(([code, token]) => ({ code: code.toUpperCase(), symbol: code.toUpperCase(), token: token as Address }));
}

type Artifact = { abi: readonly unknown[]; bytecode: `0x${string}` };
type Artifacts = Record<'CurrencyDesk' | 'Launchpad' | 'Router' | 'WETH9' | 'UniswapV3Factory' | 'NonfungiblePositionManager', Artifact>;

/** The pad's settings, as scripts/deploy.mjs sets them by default off a local chain. */
export const SETTINGS = {
  deskFeeBps: 10,
  faucetUsd: 1000,
  faucetCooldown: 3600,
  /** What a coin's whole supply is worth the moment it launches, in USD. */
  startMcapUsd: 4000,
};
const BATCH = 20;

export interface DeployState {
  desk?: Address;
  deskBlock?: number;
  weth?: Address;
  factory?: Address;
  positions?: Address;
  quoterV2?: Address;
  swapRouter?: Address;
  launchpad?: Address;
  router?: Address;
  routerSet?: boolean;
  keeperSet?: boolean;
}

export interface Step {
  key: string;
  label: string;
  done: boolean;
}

// (v3: every coin opens as a Uniswap V3 pool; a run of an earlier pad can't be carried on)
const storeKey = (chainId: number, owner: string) => `starmint:deploy:v3:${chainId}:${owner.toLowerCase()}`;

/** Uniswap's own V3 on this chain, if it has one, or the copies an earlier deployment on this
 *  chain put up (a local node); otherwise the deploy puts up a copy. */
export function officialUniswap(chainId: number): { factory: Address; positionManager: Address; own: boolean; extras?: Pick<Deployment, 'weth' | 'quoterV2' | 'swapRouter'> } | undefined {
  const v3 = (uniswap.v3 as Record<string, { factory: string; positionManager?: string }>)[String(chainId)];
  if (v3?.positionManager) return { factory: v3.factory as Address, positionManager: v3.positionManager as Address, own: true };
  const dep = DEPLOYMENTS[chainId];
  if (dep?.positionManager && dep.uniswapFactory) {
    return { factory: dep.uniswapFactory, positionManager: dep.positionManager, own: false, extras: { weth: dep.weth, quoterV2: dep.quoterV2, swapRouter: dep.swapRouter } };
  }
  return undefined;
}

export function loadState(chainId: number, owner: string): DeployState {
  try {
    return JSON.parse(localStorage.getItem(storeKey(chainId, owner)) || '{}') as DeployState;
  } catch {
    return {};
  }
}

function saveState(chainId: number, owner: string, s: DeployState) {
  try {
    localStorage.setItem(storeKey(chainId, owner), JSON.stringify(s));
  } catch {
    /* no storage: a closed tab starts over */
  }
}

export function forgetState(chainId: number, owner: string) {
  try {
    localStorage.removeItem(storeKey(chainId, owner));
  } catch {
    /* ignore */
  }
}

/** A float rate as an 18-decimal fixed-point bigint, without scientific notation. */
const toWad = (v: number) => parseUnits(Number(v).toFixed(18), 18);

export function publicClientFor(chainId: number): PublicClient {
  return createPublicClient({ chain: viemChain(chainId), transport: http(chainMeta(chainId).rpc) }) as PublicClient;
}

/** How many transactions the whole deployment takes on a chain. */
export function txCount(chainId: number, tokens: RealToken[] = realTokensOf(chainId)): number {
  return 1 + (tokens.length || Math.ceil(currencies.length / BATCH)) + (officialUniswap(chainId) ? 0 : 3) + 4;
}

/** The steps and which are done, for the page to show. */
export function steps(s: DeployState, listed: number, chainId: number, tokens: RealToken[] = realTokensOf(chainId)): Step[] {
  const official = officialUniswap(chainId);
  const currencyStep = tokens.length
    ? `${tokens.length} real tokens: ${tokens.map((t) => `${t.symbol} as ${t.code}`).join(', ')} (${tokens.length} transactions)`
    : `${currencies.length} test currencies (${Math.ceil(currencies.length / BATCH)} transactions)`;
  return [
    { key: 'desk', label: 'Currency desk', done: !!s.desk },
    { key: 'currencies', label: currencyStep, done: listed >= (tokens.length || currencies.length) },
    {
      key: 'uniswap',
      label: official?.own
        ? 'Uniswap V3, where every coin’s pool opens (Uniswap’s own, nothing to deploy)'
        : official
          ? 'Uniswap V3, where every coin’s pool opens (the copies already on this test network)'
          : 'Uniswap V3, where every coin’s pool opens (a copy for this test network: WETH, factory, position manager)',
      done: !!s.positions || !!official,
    },
    { key: 'launchpad', label: 'Launchpad', done: !!s.launchpad },
    { key: 'router', label: 'Router', done: !!s.router },
    { key: 'wire', label: 'Router wired into the launchpad', done: !!s.routerSet },
    { key: 'keeper', label: 'You as the keeper of the rates', done: !!s.keeperSet },
  ];
}

export async function listedCount(pc: PublicClient, art: Artifacts, desk?: Address): Promise<number> {
  if (!desk) return 0;
  return Number(await pc.readContract({ address: desk, abi: art.CurrencyDesk.abi, functionName: 'currencyCount' }));
}

/** Units per USD for a real token's currency: today's rate from the public feed when
 *  the browser can reach it, else the reference rate on file (the keeper posts the
 *  next one). USD itself is always 1. */
async function startingRate(code: string, live: Record<string, number>): Promise<{ rate: number; from: string }> {
  if (code === 'USD') return { rate: 1, from: 'the reference currency' };
  const fresh = live[code];
  if (Number.isFinite(fresh) && fresh > 0) return { rate: fresh, from: "today's rate" };
  const ref = currencies.find((c) => c.code === code)?.rate;
  if (!ref) throw new Error(`No rate for ${code}: it is not one of the currencies on file and the rate feed has none`);
  return { rate: ref, from: 'the reference rate on file; the keeper posts the next one' };
}

const factoryOfAbi = [{ type: 'function', name: 'factory', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }] as const;

/** Runs every step that is not done yet. `onProgress` gets a line for each transaction. */
export async function deployPad(opts: {
  chainId: number;
  wallet: WalletClient;
  owner: Address;
  /** Real tokens to list instead of test currencies (the chain's own list by default). */
  tokens?: RealToken[];
  onProgress: (line: string, s: DeployState, listed: number) => void;
}): Promise<Deployment> {
  const { chainId, wallet, owner, onProgress } = opts;
  const tokens = opts.tokens ?? realTokensOf(chainId);
  const art = (await import('@shared/artifacts.json')).default as unknown as Artifacts;
  const pc = publicClientFor(chainId);
  const chain = viemChain(chainId);
  const s = loadState(chainId, owner);
  let listed = await listedCount(pc, art, s.desk);
  const save = (line: string) => {
    saveState(chainId, owner, s);
    onProgress(line, { ...s }, listed);
  };
  const confirm = async (hash: Hash, what: string) => {
    onProgress(`${what}: waiting for the transaction…`, { ...s }, listed);
    const rc = await pc.waitForTransactionReceipt({ hash });
    if (rc.status !== 'success') throw new Error(`${what} failed (transaction ${hash})`);
    return rc;
  };
  const deploy = async (name: keyof Artifacts, args: unknown[], rawArgs?: Hex) => {
    const a = art[name];
    // Uniswap's artifacts are compiled with an older solc whose ABI viem encodes all the same;
    // rawArgs skips the ABI for constructors given as already-encoded parameters
    const hash = rawArgs
      ? await wallet.deployContract({ abi: [], bytecode: `${a.bytecode}${rawArgs.slice(2)}` as Hex, account: owner, chain })
      : await wallet.deployContract({ abi: a.abi, bytecode: a.bytecode, args, account: owner, chain });
    const rc = await confirm(hash, name);
    if (!rc.contractAddress) throw new Error(`${name} has no address (transaction ${hash})`);
    return { address: rc.contractAddress, block: Number(rc.blockNumber) };
  };
  const call = async (address: Address, abi: readonly unknown[], functionName: string, args: unknown[], what: string) => {
    const hash = await wallet.writeContract({ address, abi, functionName, args, account: owner, chain } as Parameters<WalletClient['writeContract']>[0]);
    await confirm(hash, what);
  };

  if (!s.desk) {
    const d = await deploy('CurrencyDesk', [owner, SETTINGS.deskFeeBps, toWad(SETTINGS.faucetUsd), SETTINGS.faucetCooldown]);
    s.desk = d.address;
    s.deskBlock = d.block;
    listed = 0;
    save(`Currency desk at ${d.address}`);
  }
  // the desk lists currencies in order, so what it already holds says where to go on
  if (tokens.length) {
    const live = listed < tokens.length ? await feedRates() : {};
    while (listed < tokens.length) {
      const t = tokens[listed];
      const r = await startingRate(t.code, live);
      await call(s.desk, art.CurrencyDesk.abi, 'listCurrency', [t.token, t.code, toWad(r.rate)], `Listing ${t.symbol} as ${t.code}`);
      listed = await listedCount(pc, art, s.desk);
      save(`${t.symbol} listed as ${t.code} at ${r.rate} per USD (${r.from})`);
    }
  }
  while (!tokens.length && listed < currencies.length) {
    const batch = currencies.slice(listed, listed + BATCH).map((c) => ({
      code: c.code,
      name: `Test ${c.name}`,
      symbol: `t${c.code}`,
      decimals: 18,
      rate: toWad(c.rate),
    }));
    await call(s.desk, art.CurrencyDesk.abi, 'createTestCurrencies', [batch], `Currencies ${listed + 1} to ${listed + batch.length}`);
    listed = await listedCount(pc, art, s.desk);
    save(`${listed} of ${currencies.length} currencies listed`);
  }
  if (!s.positions) {
    const official = officialUniswap(chainId);
    if (official) {
      // the position manager must really be Uniswap's on this chain: it names its own factory
      const f = (await pc.readContract({ address: official.positionManager, abi: factoryOfAbi, functionName: 'factory' })) as Address;
      if (f.toLowerCase() !== official.factory.toLowerCase()) throw new Error(`The position manager at ${official.positionManager} names factory ${f}, not ${official.factory}`);
      s.factory = official.factory;
      s.positions = official.positionManager;
      if (official.extras) Object.assign(s, official.extras);
      save(`Uniswap V3 position manager: ${official.positionManager} (${official.own ? "Uniswap's own" : 'already on this network'}, factory ${official.factory})`);
    } else {
      if (!s.weth) {
        const w = await deploy('WETH9', []);
        s.weth = w.address;
        save(`WETH at ${w.address} (a copy for this network)`);
      }
      if (!s.factory) {
        const f = await deploy('UniswapV3Factory', []);
        s.factory = f.address;
        save(`Uniswap V3 factory at ${f.address} (a copy)`);
      }
      const p = await deploy(
        'NonfungiblePositionManager',
        [],
        encodeAbiParameters([{ type: 'address' }, { type: 'address' }, { type: 'address' }], [s.factory, s.weth, zeroAddress]),
      );
      s.positions = p.address;
      save(`Uniswap V3 position manager at ${p.address} (a copy)`);
    }
  }
  if (!s.launchpad) {
    const p = await deploy('Launchpad', [owner, s.desk, s.positions, owner, toWad(SETTINGS.startMcapUsd)]);
    s.launchpad = p.address;
    save(`Launchpad at ${p.address}`);
  }
  if (!s.router) {
    const r = await deploy('Router', [s.launchpad]);
    s.router = r.address;
    save(`Router at ${r.address}`);
  }
  if (!s.routerSet) {
    await call(s.launchpad, art.Launchpad.abi, 'setRouter', [s.router], 'Wiring the router');
    s.routerSet = true;
    save('Router wired into the launchpad');
  }
  if (!s.keeperSet) {
    await call(s.desk, art.CurrencyDesk.abi, 'setKeeper', [owner, true], 'Setting the keeper');
    s.keeperSet = true;
    save('You are the keeper of the rates');
  }

  const coinImplementation = (await pc.readContract({
    address: s.launchpad,
    abi: art.Launchpad.abi,
    functionName: 'coinImplementation',
  })) as Address;
  const meta = chainMeta(chainId);
  return {
    chainId,
    name: meta.name,
    rpcUrl: meta.rpc,
    explorer: meta.explorer,
    desk: s.desk,
    launchpad: s.launchpad,
    router: s.router,
    positionManager: s.positions,
    uniswapFactory: s.factory!,
    ...(s.weth ? { weth: s.weth } : {}),
    ...(s.quoterV2 ? { quoterV2: s.quoterV2 } : {}),
    ...(s.swapRouter ? { swapRouter: s.swapRouter } : {}),
    coinImplementation,
    deployBlock: s.deskBlock ?? 0,
    deployedAt: new Date().toISOString(),
    testCurrencies: tokens.length === 0,
  };
}
