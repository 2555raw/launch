/* Shared plumbing for the deploy, seed, keeper and verify scripts. */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseUnits,
} from 'viem';
import { mnemonicToAccount, privateKeyToAccount } from 'viem/accounts';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const artifacts = JSON.parse(readFileSync(join(ROOT, 'shared/artifacts.json'), 'utf8'));
export const currencies = JSON.parse(readFileSync(join(ROOT, 'shared/currencies.json'), 'utf8'));

/** The well-known development mnemonic every anvil / hardhat node funds. */
export const DEV_MNEMONIC = 'test test test test test test test test test test test junk';
export const devAccount = (i) => mnemonicToAccount(DEV_MNEMONIC, { addressIndex: i });

/** `--flag value` and `--flag=value` pairs, merged over the environment. */
export function args() {
  const out = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const [k, v] = a.slice(2).split('=');
    if (v !== undefined) out[k] = v;
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[k] = argv[++i];
    else out[k] = 'true';
  }
  return out;
}

export async function connect({ rpc, key, account } = {}) {
  const url = rpc || process.env.RPC_URL || 'http://127.0.0.1:8545';
  const probe = createPublicClient({ transport: http(url) });
  const id = await probe.getChainId();
  const chain = defineChain({
    id,
    name: id === 31337 ? 'Local storm' : `Chain ${id}`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [url] } },
  });
  const pk = key || process.env.PRIVATE_KEY;
  let signer = account;
  if (!signer && pk) signer = privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`);
  if (!signer && id === 31337) signer = devAccount(0);
  const publicClient = createPublicClient({ chain, transport: http(url), pollingInterval: 250 });
  const walletClient = signer ? createWalletClient({ chain, transport: http(url), account: signer }) : null;
  return { url, chain, chainId: id, publicClient, walletClient, account: signer };
}

export function walletFor(ctx, account) {
  return createWalletClient({ chain: ctx.chain, transport: http(ctx.url), account });
}

/** Sends a transaction and waits for it, failing loudly on a revert. */
export async function send(ctx, request, wallet = ctx.walletClient) {
  const hash = await wallet.writeContract({ ...request, account: wallet.account, chain: ctx.chain });
  const receipt = await ctx.publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`reverted: ${request.functionName} (${hash})`);
  return receipt;
}

export async function deployContract(ctx, name, args = []) {
  const a = artifacts[name];
  const hash = await ctx.walletClient.deployContract({ abi: a.abi, bytecode: a.bytecode, args });
  const receipt = await ctx.publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success' || !receipt.contractAddress) throw new Error(`deploy failed: ${name}`);
  return { address: receipt.contractAddress, block: receipt.blockNumber };
}

/** A float rate as an 18-decimal fixed-point bigint, without scientific notation. */
export function toWad(value) {
  const s = Number(value).toFixed(18);
  return parseUnits(s, 18);
}

export const DEPLOY_DIR = join(ROOT, 'deployments');
export const WEB_DEPLOYMENTS = join(ROOT, 'web/src/generated/deployments.json');
export const WEB_LOCAL_DEPLOYMENTS = join(ROOT, 'web/src/generated/deployments.local.json');

export function readDeployment(chainId) {
  const file = join(DEPLOY_DIR, `${chainId}.json`);
  if (!existsSync(file)) throw new Error(`no deployment for chain ${chainId} (run npm run deploy first)`);
  return JSON.parse(readFileSync(file, 'utf8'));
}

/** Writes deployments/<chainId>.json and merges it into what the web app imports.
 *  Local chains go to a git-ignored file so a production build never points at 127.0.0.1. */
export function writeDeployment(record) {
  mkdirSync(DEPLOY_DIR, { recursive: true });
  writeFileSync(join(DEPLOY_DIR, `${record.chainId}.json`), JSON.stringify(record, null, 2) + '\n');
  const target = record.chainId === 31337 ? WEB_LOCAL_DEPLOYMENTS : WEB_DEPLOYMENTS;
  const all = existsSync(target) ? JSON.parse(readFileSync(target, 'utf8')) : {};
  all[record.chainId] = record;
  writeFileSync(target, JSON.stringify(all, null, 2) + '\n');
  return target;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
