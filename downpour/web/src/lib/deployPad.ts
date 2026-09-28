/* Deploys the pad from the browser, signed by the connected wallet: the same steps as
 * scripts/deploy.mjs (desk, the test currencies in batches, Uniswap V2 where the chain
 * has none of its own, launchpad, router, keeper),
 * so nobody has to hand a private key to a script. Progress is saved after every step
 * and read back from the chain, so a closed tab carries on where it stopped. */
import { createPublicClient, http, parseUnits, zeroAddress, type Address, type Hash, type PublicClient, type WalletClient } from 'viem';
import currencies from '@shared/currencies.json';
import uniswap from '@shared/uniswap.json';
import type { Deployment } from '../config/chains';
import { chainMeta, viemChain } from '../config/chains';

type Artifact = { abi: readonly unknown[]; bytecode: `0x${string}` };
type Artifacts = Record<'CurrencyDesk' | 'Launchpad' | 'Router' | 'UniswapV2Factory', Artifact>;

/** The pad's settings, as scripts/deploy.mjs sets them by default off a local chain. */
export const SETTINGS = {
  deskFeeBps: 10,
  faucetUsd: 1000,
  faucetCooldown: 3600,
  targetRaiseUsd: 12000,
  protocolFeeBps: 50,
  creatorFeeBps: 50,
  snipeTaxBps: 2000,
  snipeWindow: 15,
};
const BATCH = 20;

export interface DeployState {
  desk?: Address;
  deskBlock?: number;
  uniswap?: Address;
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

// (v2: the pad graduates coins into Uniswap; a run of the earlier pad can't be carried on)
const storeKey = (chainId: number, owner: string) => `starmint:deploy:v2:${chainId}:${owner.toLowerCase()}`;

/** Uniswap's own V2 factory on this chain, if it has one; otherwise the deploy puts up a copy. */
export function officialUniswap(chainId: number): Address | undefined {
  return (uniswap.v2Factory as Record<string, string>)[String(chainId)] as Address | undefined;
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
export function txCount(chainId: number): number {
  return 1 + Math.ceil(currencies.length / BATCH) + (officialUniswap(chainId) ? 0 : 1) + 4;
}

/** The steps and which are done, for the page to show. */
export function steps(s: DeployState, listed: number, chainId: number): Step[] {
  const official = officialUniswap(chainId);
  return [
    { key: 'desk', label: 'Currency desk', done: !!s.desk },
    { key: 'currencies', label: `${currencies.length} test currencies (${Math.ceil(currencies.length / BATCH)} transactions)`, done: listed >= currencies.length },
    {
      key: 'uniswap',
      label: official ? 'Uniswap V2, where coins graduate (Uniswap’s own, nothing to deploy)' : 'Uniswap V2, where coins graduate (a copy for this test network)',
      done: !!s.uniswap || !!official,
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

/** Runs every step that is not done yet. `onProgress` gets a line for each transaction. */
export async function deployPad(opts: {
  chainId: number;
  wallet: WalletClient;
  owner: Address;
  onProgress: (line: string, s: DeployState, listed: number) => void;
}): Promise<Deployment> {
  const { chainId, wallet, owner, onProgress } = opts;
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
  const deploy = async (name: keyof Artifacts, args: unknown[]) => {
    const a = art[name];
    const hash = await wallet.deployContract({ abi: a.abi, bytecode: a.bytecode, args, account: owner, chain });
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
  while (listed < currencies.length) {
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
  if (!s.uniswap) {
    const official = officialUniswap(chainId);
    if (official) {
      s.uniswap = official;
      save(`Uniswap V2 factory: ${official} (Uniswap's own)`);
    } else {
      // a copy nobody can switch Uniswap's protocol fee on for (feeToSetter = 0)
      const f = await deploy('UniswapV2Factory', [zeroAddress]);
      s.uniswap = f.address;
      save(`Uniswap V2 factory at ${f.address}`);
    }
  }
  if (!s.launchpad) {
    const p = await deploy('Launchpad', [
      owner,
      s.desk,
      s.uniswap,
      owner,
      toWad(SETTINGS.targetRaiseUsd),
      SETTINGS.protocolFeeBps,
      SETTINGS.creatorFeeBps,
      SETTINGS.snipeTaxBps,
      SETTINGS.snipeWindow,
    ]);
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
    uniswapFactory: s.uniswap,
    coinImplementation,
    deployBlock: s.deskBlock ?? 0,
    deployedAt: new Date().toISOString(),
    testCurrencies: true,
  };
}
