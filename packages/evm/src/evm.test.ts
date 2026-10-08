import { describe, expect, it } from 'vitest';
import { createWalletClient, http, parseAbi, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { LAUNCH_TOKEN_ABI, LAUNCH_TOKEN_BYTECODE, buildEvmSignInMessage, createRobinhoodPublicClient, launchTokenConstructorArgs, robinhoodChain, robinhoodChainTestnet, validateErc20Input, verifyEvmSignature, verifyErc20Deployment } from './index.js';

describe('Robinhood Chain config', () => {
  it('has the official chain ids', () => {
    expect(robinhoodChain.id).toBe(4663);
    expect(robinhoodChainTestnet.id).toBe(46630);
  });
  it('artifact contains a compiled ERC-20 with the expected functions', () => {
    const names = LAUNCH_TOKEN_ABI.filter((x) => x.type === 'function').map((x) => (x as { name: string }).name);
    for (const fn of ['name', 'symbol', 'decimals', 'totalSupply', 'balanceOf', 'transfer', 'approve', 'transferFrom', 'burn', 'mint', 'disableMinting', 'owner']) expect(names).toContain(fn);
    expect(LAUNCH_TOKEN_BYTECODE.startsWith('0x60')).toBe(true);
    expect(LAUNCH_TOKEN_BYTECODE.length).toBeGreaterThan(1000);
  });
  it('validates ERC-20 inputs', () => {
    expect(validateErc20Input({ name: 'Ember', symbol: 'EMB', decimals: 18, totalSupply: 1_000_000n })).toEqual([]);
    expect(validateErc20Input({ name: '', symbol: 'TOOLONGSYMBOL', decimals: 19, totalSupply: 0n }).length).toBe(4);
    const args = launchTokenConstructorArgs({ name: 'Ember', symbol: 'EMB', decimals: 18, totalSupply: 5n, owner: '0x0000000000000000000000000000000000000001', fixedSupply: true });
    expect(args[3]).toBe(5n * 10n ** 18n);
  });
});

describe('EVM wallet sign-in', () => {
  it('verifies an EIP-191 signature over the sign-in message', async () => {
    const account = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
    const message = buildEvmSignInMessage({ domain: 'localhost', address: account.address, nonce: 'abc123', issuedAt: new Date().toISOString(), chainId: 4663 });
    const signature = await account.signMessage({ message });
    expect(await verifyEvmSignature(message, signature, account.address)).toBe(true);
    expect(await verifyEvmSignature(message + 'x', signature, account.address)).toBe(false);
    expect(await verifyEvmSignature(message, signature, '0x0000000000000000000000000000000000000001')).toBe(false);
  });
});

const live = process.env.EVM_TESTNET_TESTS === '1' && !!process.env.EVM_SERVER_PRIVATE_KEY;
describe.skipIf(!live)('Robinhood Chain testnet (live)', () => {
  it('deploys a LaunchToken and verifies it on chain', async () => {
    const account = privateKeyToAccount(process.env.EVM_SERVER_PRIVATE_KEY as Hex);
    const publicClient = createRobinhoodPublicClient('testnet');
    const wallet = createWalletClient({ account, chain: robinhoodChainTestnet, transport: http() });
    const hash = await wallet.deployContract({
      abi: LAUNCH_TOKEN_ABI,
      bytecode: LAUNCH_TOKEN_BYTECODE,
      args: launchTokenConstructorArgs({ name: 'Launch Test', symbol: 'LTST', decimals: 18, totalSupply: 1000n, owner: account.address, fixedSupply: true }),
    });
    await publicClient.waitForTransactionReceipt({ hash });
    const verified = await verifyErc20Deployment(publicClient, hash);
    expect(verified.symbol).toBe('LTST');
    expect(verified.totalSupply).toBe(1000n * 10n ** 18n);
    expect(verified.mintingDisabled).toBe(true);
    const bal = (await publicClient.readContract({ address: verified.address, abi: parseAbi(['function balanceOf(address) view returns (uint256)']), functionName: 'balanceOf', args: [account.address] })) as bigint;
    expect(bal).toBe(verified.totalSupply);
  });
});
