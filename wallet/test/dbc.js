/* Does Ward build the same launch transaction Meteora's own SDK builds?
 *
 * The wallet cannot load that SDK — the page runs under script-src 'self' and
 * the SDK is a bundler's worth of dependencies — so public/dbc.js builds the
 * two instructions a launch needs by hand. Hand-built instruction bytes are
 * exactly the kind of thing that looks right and is wrong in a way nobody
 * notices until a transaction burns real SOL, so they are not trusted here:
 * every one is compared, field by field and byte for byte, against the same
 * instruction built by @coral-xyz/anchor from Meteora's published IDL.
 *
 * This runs entirely offline. It proves the bytes are right. It cannot prove
 * a launch succeeds against the live program, because that needs an RPC node
 * and a funded key, and it says nothing about whether the curve you configured
 * is a curve you want.
 *
 *   node test/dbc.js            (needs the dev dependencies in test/README.md)
 */
const fs = require('fs');
const path = require('path');
const url = require('url');
const assert = require('assert');

const PUB = path.join(__dirname, '..', 'public');
const MODS = process.env.DBC_MODULES || path.join(__dirname, 'node_modules');
const req = n => require(path.join(MODS, n));

const anchor = req('@coral-xyz/anchor');
const { PublicKey, Keypair } = req('@solana/web3.js');
const { DynamicBondingCurveIdl: IDL } = req('@meteora-ag/dynamic-bonding-curve-sdk');

/* ── load the browser modules into node ──────────────────────────────── */
global.window = global;
if (!global.crypto) global.crypto = require('crypto').webcrypto;

const load = (file, patch = s => s) => {
  const src = patch(fs.readFileSync(path.join(PUB, file), 'utf8'));
  // eslint-disable-next-line no-eval
  (0, eval)(src);
};
load('sol.js', s => s.replace("'./vendor/noble-ed25519.js'",
  JSON.stringify(url.pathToFileURL(path.join(PUB, 'vendor', 'noble-ed25519.js')).href)));
load('dbc.js');

const SOL = window.WARD_SOL;
const DBC = window.WARD_DBC;

const key = () => Keypair.generate().publicKey;
const pk = u8 => new PublicKey(Buffer.from(u8));

/* Anchor with no provider: nothing here is ever sent, only encoded. */
const program = new anchor.Program(IDL, { connection: null, publicKey: null });

let checks = 0;
function same(mine, ref, what) {
  assert.strictEqual(mine.programId.toBase58 ? mine.programId.toBase58() : pk(mine.programId).toBase58(),
    ref.programId.toBase58(), what + ': program id');
  assert.strictEqual(mine.keys.length, ref.keys.length, what + `: account count (${mine.keys.length} vs ${ref.keys.length})`);
  mine.keys.forEach((k, i) => {
    const r = ref.keys[i];
    const a = pk(k.key).toBase58();
    assert.strictEqual(a, r.pubkey.toBase58(), `${what}: account ${i} (${IDL.instructions.find(x => x.name === what.split(' ')[0])?.accounts[i]?.name})`);
    assert.strictEqual(!!k.signer, r.isSigner, `${what}: account ${i} signer`);
    assert.strictEqual(!!k.writable, r.isWritable, `${what}: account ${i} writable`);
  });
  assert.deepStrictEqual(Buffer.from(mine.data), Buffer.from(ref.data), what + ': data bytes');
  checks++;
}

(async () => {
  /* ── discriminators, from the rule rather than the copy ─────────────── */
  const crypto = require('crypto');
  for (const [name, disc] of [['initialize_virtual_pool_with_spl_token', DBC.DISC.initialize],
                              ['swap', DBC.DISC.swap]]) {
    const want = crypto.createHash('sha256').update('global:' + name).digest().slice(0, 8);
    assert.deepStrictEqual(Buffer.from(disc), want, `discriminator for ${name}`);
    checks++;
  }
  console.log('  ▸ both discriminators match sha256("global:<name>")');

  /* ── the addresses the program derives ──────────────────────────────── */
  const meteora = req('@meteora-ag/dynamic-bonding-curve-sdk');
  for (let i = 0; i < 120; i++) {
    const config = key(), base = key(), quote = key();
    const pool = (await DBC.poolAddress(config.toBytes(), base.toBytes(), quote.toBytes())).address;
    assert.strictEqual(pk(pool).toBase58(),
      meteora.deriveDbcPoolAddress(quote, base, config).toBase58(), 'pool address');
    assert.strictEqual(pk((await DBC.tokenVault(pool, base.toBytes())).address).toBase58(),
      meteora.deriveDbcTokenVaultAddress(pk(pool), base).toBase58(), 'base vault');
    assert.strictEqual(pk((await DBC.mintMetadata(base.toBytes())).address).toBase58(),
      meteora.deriveMintMetadata(base).toBase58(), 'mint metadata');
    checks += 3;
  }
  assert.strictEqual(pk((await DBC.poolAuthority()).address).toBase58(),
    meteora.deriveDbcPoolAuthority().toBase58(), 'pool authority');
  assert.strictEqual(pk((await DBC.eventAuthority()).address).toBase58(),
    meteora.deriveDbcEventAuthority().toBase58(), 'event authority');
  console.log('  ▸ 362 derived addresses match Meteora\'s own helpers');

  /* ── the shared primitive, still intact ─────────────────────────────── */
  /* findAta was rewritten to sit on top of a general findPda so the launchpad
     could reuse it. It is on the path money takes, so it is re-proved against
     @solana/spl-token here rather than assumed to have survived the edit. */
  const spl = req('@solana/spl-token');
  for (let i = 0; i < 60; i++) {
    const owner = key(), mint = key();
    assert.strictEqual(pk((await SOL.findAta(owner.toBytes(), mint.toBytes())).address).toBase58(),
      spl.getAssociatedTokenAddressSync(mint, owner, true).toBase58(), 'associated token address');
    checks++;
  }
  console.log('  ▸ 60 associated token addresses still match @solana/spl-token');

  /* ── launching a coin ───────────────────────────────────────────────── */
  const NAMES = [
    ['Ward', 'WARD', 'https://ward.example/t.json'],
    ['', '', ''],                                    // empty strings still encode a length
    ['ライオン', 'ライ', 'https://例え.jp/token.json'],  // multi-byte: length is bytes, not characters
    ['Ünïcödé Çoin', 'ÜÇ', 'https://a.b/c?d=é'],
    ['x'.repeat(32), 'y'.repeat(10), 'https://' + 'z'.repeat(180)],
    ['emoji 🚀🌕', '🚀', 'https://a.io/🚀.json']
  ];
  for (const [name, symbol, uri] of NAMES) {
    for (let i = 0; i < 4; i++) {
      const config = key(), baseMint = key(), creator = key(), payer = key();
      const quoteMint = i % 2 ? key() : new PublicKey(Buffer.from(DBC.WSOL));

      const mine = await DBC.initializeIx({
        config: config.toBytes(), baseMint: baseMint.toBytes(), quoteMint: quoteMint.toBytes(),
        creator: creator.toBytes(), payer: payer.toBytes(), name, symbol, uri
      });

      const pool = pk((await DBC.poolAddress(config.toBytes(), baseMint.toBytes(), quoteMint.toBytes())).address);
      const ref = await program.methods
        .initializeVirtualPoolWithSplToken({ name, symbol, uri })
        .accountsStrict({
          config, poolAuthority: meteora.deriveDbcPoolAuthority(), creator,
          baseMint, quoteMint, pool,
          baseVault: meteora.deriveDbcTokenVaultAddress(pool, baseMint),
          quoteVault: meteora.deriveDbcTokenVaultAddress(pool, quoteMint),
          mintMetadata: meteora.deriveMintMetadata(baseMint),
          metadataProgram: new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'),
          payer,
          tokenQuoteProgram: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
          tokenProgram: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
          systemProgram: new PublicKey('11111111111111111111111111111111'),
          eventAuthority: meteora.deriveDbcEventAuthority(),
          program: new PublicKey('dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN')
        }).instruction();

      same(mine, ref, `initialize_virtual_pool_with_spl_token "${name}"`);
    }
  }
  console.log('  ▸ 24 launch instructions match byte for byte, including empty and multi-byte names');

  /* ── trading against the curve ──────────────────────────────────────── */
  const AMOUNTS = [0n, 1n, 5000n, 1_000_000_000n, (1n << 64n) - 1n];
  for (const amountIn of AMOUNTS) {
    for (const minOut of [0n, 1n, (1n << 64n) - 1n]) {
      const config = key(), baseMint = key(), payer = key();
      const quoteMint = new PublicKey(Buffer.from(DBC.WSOL));
      const inAcc = key(), outAcc = key();

      const mine = await DBC.swapIx({
        config: config.toBytes(), baseMint: baseMint.toBytes(), quoteMint: quoteMint.toBytes(),
        inputTokenAccount: inAcc.toBytes(), outputTokenAccount: outAcc.toBytes(),
        payer: payer.toBytes(), amountIn, minOut
      });

      const pool = pk((await DBC.poolAddress(config.toBytes(), baseMint.toBytes(), quoteMint.toBytes())).address);
      const ref = await program.methods
        .swap({ amountIn: new anchor.BN(amountIn.toString()), minimumAmountOut: new anchor.BN(minOut.toString()) })
        .accountsStrict({
          poolAuthority: meteora.deriveDbcPoolAuthority(), config, pool,
          inputTokenAccount: inAcc, outputTokenAccount: outAcc,
          baseVault: meteora.deriveDbcTokenVaultAddress(pool, baseMint),
          quoteVault: meteora.deriveDbcTokenVaultAddress(pool, quoteMint),
          baseMint, quoteMint, payer,
          tokenBaseProgram: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
          tokenQuoteProgram: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
          referralTokenAccount: null,
          eventAuthority: meteora.deriveDbcEventAuthority(),
          program: new PublicKey('dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN')
        }).instruction();

      same(mine, ref, `swap ${amountIn}/${minOut}`);
    }
  }
  console.log('  ▸ 15 swap instructions match, from zero to u64 max');

  /* ── two signatures, in the order the message asks for them ─────────── */
  const P = SOL.parts;
  for (let i = 0; i < 50; i++) {
    const creator = Keypair.generate(), mint = Keypair.generate();
    const ix = await DBC.initializeIx({
      config: key().toBytes(), baseMint: mint.publicKey.toBytes(),
      quoteMint: Buffer.from(DBC.WSOL), creator: creator.publicKey.toBytes(),
      payer: creator.publicKey.toBytes(), name: 'T', symbol: 'T', uri: 'u'
    });
    const msg = P.buildMessage(creator.publicKey.toBytes(), [ix], Keypair.generate().publicKey.toBase58());
    const want = P.signersOf(msg).map(s => pk(s).toBase58());
    assert.strictEqual(want.length, 2, 'a launch needs exactly two signatures');
    assert.strictEqual(want[0], creator.publicKey.toBase58(), 'the fee payer signs first');
    assert.ok(want.includes(mint.publicKey.toBase58()), 'the new mint signs too');
    checks++;
  }
  console.log('  ▸ 50 launch messages ask for the creator and the mint, payer first');

  console.log(`\n${checks} checks passed.`);
})().catch(e => { console.error('\nFAILED: ' + e.message); process.exit(1); });
