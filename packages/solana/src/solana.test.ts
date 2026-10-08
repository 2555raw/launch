import { describe, expect, it } from 'vitest';
import { Connection, Keypair, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { JupiterClient, buildCreateTokenTransaction, buildSolanaSignInMessage, fetchDexScreenerMetrics, getSignatureStatus, rawSupply, validateTokenInput, verifySolanaSignature, verifyTokenCreation } from './index.js';

describe('token input validation', () => {
  it('accepts a sane token and rejects overflow', () => {
    expect(validateTokenInput({ name: 'Ember', symbol: 'EMB', decimals: 9, totalSupply: 1_000_000_000n })).toEqual([]);
    expect(validateTokenInput({ name: 'Ember', symbol: 'EMB', decimals: 9, totalSupply: 10n ** 12n })).toContain('Total supply * 10^decimals exceeds the u64 limit of SPL tokens');
    expect(validateTokenInput({ name: '', symbol: '', decimals: 12, totalSupply: 0n }).length).toBe(4);
    expect(rawSupply(5n, 6)).toBe(5_000_000n);
  });
});

describe('wallet sign-in', () => {
  it('verifies ed25519 signatures in base58, hex and base64', () => {
    const kp = Keypair.generate();
    const message = buildSolanaSignInMessage({ domain: 'localhost', address: kp.publicKey.toBase58(), nonce: 'n0nce', issuedAt: new Date().toISOString() });
    const sig = nacl.sign.detached(new TextEncoder().encode(message), kp.secretKey);
    expect(verifySolanaSignature(message, bs58.encode(sig), kp.publicKey.toBase58())).toBe(true);
    expect(verifySolanaSignature(message, Buffer.from(sig).toString('hex'), kp.publicKey.toBase58())).toBe(true);
    expect(verifySolanaSignature(message, Buffer.from(sig).toString('base64'), kp.publicKey.toBase58())).toBe(true);
    expect(verifySolanaSignature(message + '!', bs58.encode(sig), kp.publicKey.toBase58())).toBe(false);
    expect(verifySolanaSignature(message, bs58.encode(sig), Keypair.generate().publicKey.toBase58())).toBe(false);
    expect(verifySolanaSignature(message, 'garbage', kp.publicKey.toBase58())).toBe(false);
  });
});

describe('market data normalization', () => {
  it('maps a DexScreener pair list to metrics and returns null when empty', async () => {
    const fake = (async () => new Response(JSON.stringify([{ chainId: 'solana', dexId: 'raydium', url: 'https://dexscreener.com/solana/p', pairAddress: 'p', baseToken: { address: 'm', name: 'M', symbol: 'M' }, quoteToken: { address: 'q', name: 'Q', symbol: 'Q' }, priceUsd: '0.5', txns: { h24: { buys: 10, sells: 5 } }, volume: { h24: 1234 }, liquidity: { usd: 500 }, fdv: 1000, marketCap: 900 }]), { status: 200 })) as unknown as typeof fetch;
    const m = await fetchDexScreenerMetrics('https://api.dexscreener.com', 'solana', 'm', fake);
    expect(m?.priceUsd).toBe(0.5);
    expect(m?.txns24h).toBe(15);
    expect(m?.liquidityUsd).toBe(500);
    expect(m?.source).toBe('dexscreener');
    const empty = (async () => new Response('[]', { status: 200 })) as unknown as typeof fetch;
    expect(await fetchDexScreenerMetrics('https://api.dexscreener.com', 'solana', 'm', empty)).toBeNull();
  });
  it('jupiter client builds the v2 order request and forwards errors', async () => {
    const calls: string[] = [];
    const fake = (async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url.includes('/order')) return new Response(JSON.stringify({ requestId: 'r1', transaction: null, inAmount: '1', outAmount: '2', inputMint: 'a', outputMint: 'b' }), { status: 200 });
      return new Response(JSON.stringify({ error: 'bad tx' }), { status: 400 });
    }) as unknown as typeof fetch;
    const jup = new JupiterClient('https://api.jup.ag/swap/v2', 'key', fake);
    const order = await jup.order({ inputMint: 'a', outputMint: 'b', amount: '1', slippageBps: 50 });
    expect(order.requestId).toBe('r1');
    expect(calls[0]).toContain('inputMint=a&outputMint=b&amount=1&slippageBps=50');
    await expect(jup.execute('sig', 'r1')).rejects.toThrow('bad tx');
  });
});

const live = process.env.SOLANA_DEVNET_TESTS === '1';
describe.skipIf(!live)('Solana devnet (live)', () => {
  const rpc = process.env.SOLANA_DEVNET_RPC_URL ?? 'https://api.devnet.solana.com';
  const connection = new Connection(rpc, 'confirmed');

  async function fundedPayer(): Promise<Keypair> {
    if (process.env.SOLANA_SERVER_KEYPAIR) {
      const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.SOLANA_SERVER_KEYPAIR)));
      const bal = await connection.getBalance(kp.publicKey);
      if (bal > 0.05 * LAMPORTS_PER_SOL) return kp;
    }
    const kp = Keypair.generate();
    let lastErr: unknown;
    for (let i = 0; i < 4; i++) {
      try {
        const sig = await connection.requestAirdrop(kp.publicKey, LAMPORTS_PER_SOL);
        const bh = await connection.getLatestBlockhash();
        await connection.confirmTransaction({ signature: sig, ...bh }, 'confirmed');
        return kp;
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
      }
    }
    throw new Error(`Devnet airdrop failed (rate limited?). Set SOLANA_SERVER_KEYPAIR to a funded devnet key. ${String(lastErr)}`);
  }

  it('creates a Token-2022 mint with metadata, mints supply and verifies it on chain', async () => {
    const payer = await fundedPayer();
    const mintKeypair = Keypair.generate();
    const { transaction, mint } = await buildCreateTokenTransaction({
      connection,
      payer: payer.publicKey,
      mintKeypair,
      name: 'Launch Devnet Test',
      symbol: 'LDT',
      uri: 'https://example.com/ldt.json',
      decimals: 6,
      totalSupply: 1_000_000n,
      revokeMintAuthority: true,
      revokeFreezeAuthority: true,
    });
    const signature = await sendAndConfirmTransaction(connection, transaction, [payer, mintKeypair], { commitment: 'confirmed' });
    expect(signature).toBeTruthy();
    const status = await getSignatureStatus(connection, signature);
    expect(status.status).toBe('CONFIRMED');
    const verified = await verifyTokenCreation(connection, signature, mint.toBase58());
    expect(verified.decimals).toBe(6);
    expect(verified.supply).toBe(1_000_000_000_000n);
    expect(verified.name).toBe('Launch Devnet Test');
    expect(verified.symbol).toBe('LDT');
    expect(verified.mintAuthority).toBeNull();
    expect(verified.freezeAuthority).toBeNull();
    expect(verified.feePayer).toBe(payer.publicKey.toBase58());
    console.log(`devnet mint ${mint.toBase58()} tx ${signature}`);
  });
});

/** Read-only check against REAL mainnet chain state: parses a live Token-2022 mint with on-chain metadata (PYUSD). */
const mainnetReadable = process.env.SOLANA_MAINNET_READ_TESTS !== '0';
describe.skipIf(!mainnetReadable)('Solana mainnet (live, read-only)', () => {
  it('reads a Token-2022 mint and its metadata from mainnet', async () => {
    const { Connection: C, PublicKey } = await import('@solana/web3.js');
    const { TOKEN_2022_PROGRAM_ID, getMint, getTokenMetadata } = await import('@solana/spl-token');
    const connection = new C(process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com', 'confirmed');
    const pyusd = new PublicKey('2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo');
    const info = await connection.getAccountInfo(pyusd);
    expect(info?.owner.equals(TOKEN_2022_PROGRAM_ID)).toBe(true);
    const mint = await getMint(connection, pyusd, 'confirmed', TOKEN_2022_PROGRAM_ID);
    expect(mint.decimals).toBe(6);
    expect(mint.supply > 0n).toBe(true);
    const metadata = await getTokenMetadata(connection, pyusd, 'confirmed', TOKEN_2022_PROGRAM_ID);
    expect(metadata?.symbol).toBe('PYUSD');
  });
});
