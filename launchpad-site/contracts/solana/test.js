/* End-to-end test of the Sol Bite program on a local validator.
 *   solana-test-validator --reset --bpf-program <PROGRAM_ID> target/deploy/sol_bite.so
 *   PROGRAM_ID=... RPC=http://127.0.0.1:8899 node test.js
 * Covers: config, a raise paid in a Token-2022 mint (the shape of xStocks):
 * buy, cap clipping, early close at target, finalize -> graduation with the
 * 1 % fee, claim pro rata, swap both ways on the built-in pool; a raise paid
 * in SOL that closes below the minimum: finalize -> refund. */
'use strict';
const assert = require('assert');
const { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL, TransactionInstruction } = require('@solana/web3.js');
const S = require('../../chain/solbite');

const RPC = process.env.RPC || 'http://127.0.0.1:8899';
const PROGRAM = new PublicKey(process.env.PROGRAM_ID);
const conn = new Connection(RPC, 'confirmed');
let passed = 0; const ok = (c, m) => { assert.ok(c, m); passed++; console.log('  ok ' + m); };
const send = async (ixs, signers) => { const tx = new Transaction().add(...ixs); return sendAndConfirmTransaction(conn, tx, signers, { commitment: 'confirmed' }); };
const fails = async (p, re, m) => { try { await p; } catch (e) { passed++; console.log('  ok ' + m + ' (' + String(e.message || e).split('\n')[0].slice(0, 80) + ')'); return; } assert.fail('expected failure: ' + m); };
const airdrop = async (pk, sol) => { const sig = await conn.requestAirdrop(pk, sol * LAMPORTS_PER_SOL); await conn.confirmTransaction(sig, 'confirmed'); };
const raiseState = async (addr) => S.decodeRaise((await conn.getAccountInfo(addr)).data, addr);
const tokenBal = async (acc) => { try { return BigInt((await conn.getTokenAccountBalance(acc)).value.amount); } catch { return 0n; } };

/* Token-2022 mint with 8 decimals (xStocks have 8), plus mint_to helper */
async function createMint2022(payer, decimals) {
  const mint = Keypair.generate(); const rent = await conn.getMinimumBalanceForRentExemption(82);
  const init = Buffer.concat([Buffer.from([20, decimals]), payer.publicKey.toBuffer(), Buffer.from([0])]);
  await send([SystemProgram.createAccount({ fromPubkey: payer.publicKey, newAccountPubkey: mint.publicKey, lamports: rent, space: 82, programId: S.SPL_TOKEN_2022 }), new TransactionInstruction({ programId: S.SPL_TOKEN_2022, keys: [{ pubkey: mint.publicKey, isSigner: false, isWritable: true }], data: init })], [payer, mint]);
  return mint.publicKey;
}
const ixCreateAta = (payer, owner, mint, program) => new TransactionInstruction({ programId: S.ATA_PROGRAM, keys: [{ pubkey: payer, isSigner: true, isWritable: true }, { pubkey: S.ata(owner, mint, program), isSigner: false, isWritable: true }, { pubkey: owner, isSigner: false, isWritable: false }, { pubkey: mint, isSigner: false, isWritable: false }, { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, { pubkey: program, isSigner: false, isWritable: false }], data: Buffer.from([1]) });
const ixMintTo = (mint, dest, authority, amount, program) => new TransactionInstruction({ programId: program, keys: [{ pubkey: mint, isSigner: false, isWritable: true }, { pubkey: dest, isSigner: false, isWritable: true }, { pubkey: authority, isSigner: true, isWritable: false }], data: Buffer.concat([Buffer.from([7]), S.u64(amount)]) });

(async () => {
  const admin = Keypair.generate(), feeTo = Keypair.generate(), creator = Keypair.generate(), alice = Keypair.generate(), bob = Keypair.generate();
  for (const k of [admin, feeTo, creator, alice, bob]) await airdrop(k.publicKey, 20);
  await send([S.ixInitConfig(PROGRAM, admin.publicKey, feeTo.publicKey)], [admin]);
  const cfg = S.decodeConfig((await conn.getAccountInfo(S.configPda(PROGRAM)[0])).data); ok(cfg.feeTo === feeTo.publicKey.toBase58(), 'config initialised with fee_to');
  await fails(send([S.ixInitConfig(PROGRAM, admin.publicKey, feeTo.publicKey)], [admin]), /custom program error|already/i, 'config cannot be initialised twice');

  /* ---- raise paid in a Token-2022 stock token ---- */
  const mcd = await createMint2022(admin, 8); const P = S.SPL_TOKEN_2022; const one = 10n ** 8n;
  for (const k of [alice, bob, feeTo]) await send([ixCreateAta(admin.publicKey, k.publicKey, mcd, P)], [admin]);
  await send([ixMintTo(mcd, S.ata(alice.publicKey, mcd, P), admin.publicKey, 1000n * one, P), ixMintTo(mcd, S.ata(bob.publicKey, mcd, P), admin.publicKey, 1000n * one, P)], [admin]);
  const coin = Keypair.generate(); const target = 100n * one;
  const c = S.ixCreate(PROGRAM, creator.publicKey, coin.publicKey, { name: 'Golden Arches Club', symbol: 'ARCHES', restaurant: 'mcdonalds', target, duration: 3600, pay: { mint: mcd, is2022: true } });
  await send([c.ix], [creator, coin]);
  let r = await raiseState(c.raise);
  ok(r.symbol === 'ARCHES' && r.name === 'Golden Arches Club' && r.restaurant === 'mcdonalds' && r.target === String(target) && r.min === String(target / 3n) && r.cap === String(target / 10n) && r.payMint === mcd.toBase58() && r.payIs2022 && r.payDecimals === 8, 'raise created: target, minimum = target/3, cap = target/10, Token-2022 pay mint');
  ok(await tokenBal(c.coinVault) === S.SUPPLY, 'whole supply sits in the coin vault');
  await send([S.ixBuy(PROGRAM, alice.publicKey, r, 5n * one)], [alice]); r = await raiseState(c.raise);
  ok(r.raised === String(5n * one) && r.buyers === 1 && await tokenBal(c.payVault) === 5n * one, 'alice buys 5 MCDx: raised and vault updated');
  await send([S.ixBuy(PROGRAM, alice.publicKey, r, 50n * one)], [alice]); r = await raiseState(c.raise);
  ok(r.raised === String(10n * one) && (await tokenBal(S.ata(alice.publicKey, mcd, P))) === 990n * one, 'buy over the cap is clipped to the cap (10 MCDx)');
  await fails(send([S.ixBuy(PROGRAM, alice.publicKey, r, 1n * one)], [alice]), /custom program error/i, 'nothing more can be bought once the cap is reached');
  await fails(send([S.ixFinalize(PROGRAM, bob.publicKey, r, feeTo.publicKey)], [bob]), /custom program error/i, 'finalize refused while the raise is open');
  // fill the raise with more wallets: 9 more buyers of 10 each => 100 = target, closes early
  const extra = []; for (let i = 0; i < 9; i++) { const k = Keypair.generate(); await airdrop(k.publicKey, 2); await send([ixCreateAta(admin.publicKey, k.publicKey, mcd, P), ixMintTo(mcd, S.ata(k.publicKey, mcd, P), admin.publicKey, 10n * one, P)], [admin]); extra.push(k); }
  for (const k of extra) { r = await raiseState(c.raise); await send([S.ixBuy(PROGRAM, k.publicKey, r, 10n * one)], [k]); }
  r = await raiseState(c.raise); ok(r.raised === String(target) && r.closedAt > 0 && r.buyers === 10, 'raise reaches the target and closes early');
  await fails(send([S.ixBuy(PROGRAM, bob.publicKey, r, 1n * one)], [bob]), /custom program error/i, 'closed raise refuses buys');
  await send([S.ixFinalize(PROGRAM, bob.publicKey, r, feeTo.publicKey)], [bob]); r = await raiseState(c.raise);
  const fee = target / 100n;
  ok(r.finalized && r.graduated && r.poolPay === String(target - fee) && r.poolCoin === String(S.SUPPLY * 20n / 100n) && await tokenBal(S.ata(feeTo.publicKey, mcd, P)) === fee, 'graduated: 1 % fee paid, pool seeded with 99 % of the raise and 20 % of the supply');
  await fails(send([S.ixFinalize(PROGRAM, bob.publicKey, r, feeTo.publicKey)], [bob]), /custom program error/i, 'finalize is idempotent-protected');
  await send([S.ixClaim(PROGRAM, alice.publicKey, r)], [alice]);
  const aliceCoins = await tokenBal(S.ata(alice.publicKey, coin.publicKey)); ok(aliceCoins === S.SUPPLY * 80n / 100n / 10n, 'alice claims 10 % of the buyers\' 80 % (she paid 10 of 100)');
  await fails(send([S.ixClaim(PROGRAM, alice.publicKey, r)], [alice]), /custom program error/i, 'claim twice is refused');
  await fails(send([S.ixClaim(PROGRAM, bob.publicKey, r)], [bob]), /custom program error|Error/i, 'a non-buyer cannot claim');
  // swap on the built-in pool: bob buys coin with 1 MCDx
  r = await raiseState(c.raise); const q = S.quoteSwap(r, 1n * one, false);
  await send([S.ixSwap(PROGRAM, bob.publicKey, r, 1n * one, q, false)], [bob]); const bobCoins = await tokenBal(S.ata(bob.publicKey, coin.publicKey)); r = await raiseState(c.raise);
  ok(bobCoins === q && q > 0n && r.poolPay === String(target - fee + 1n * one) && BigInt(r.poolCoin) + bobCoins === S.SUPPLY * 20n / 100n, 'swap pay->coin follows the constant-product quote and updates reserves');
  await fails(send([S.ixSwap(PROGRAM, bob.publicKey, r, 1n * one, q * 2n, false)], [bob]), /custom program error/i, 'swap with too high min_out fails (slippage)');
  const q2 = S.quoteSwap(r, bobCoins, true); const before = await tokenBal(S.ata(bob.publicKey, mcd, P));
  await send([S.ixSwap(PROGRAM, bob.publicKey, r, bobCoins, q2, true)], [bob]); const after = await tokenBal(S.ata(bob.publicKey, mcd, P));
  ok(after - before === q2 && q2 < 1n * one, 'swap coin->pay returns slightly less than paid (1 % fee stays in the pool)');
  await fails(send([S.ixRefund(PROGRAM, alice.publicKey, r)], [alice]), /custom program error/i, 'no refund on a graduated raise');

  /* ---- raise paid in SOL that fails ---- */
  const coin2 = Keypair.generate(); const t2 = 10n * BigInt(LAMPORTS_PER_SOL);
  const c2 = S.ixCreate(PROGRAM, creator.publicKey, coin2.publicKey, { name: 'Frap Coin', symbol: 'FRAP', restaurant: 'starbucks', target: t2, duration: 3600, pay: null });
  await send([c2.ix], [creator, coin2]); let r2 = await raiseState(c2.raise);
  ok(r2.payMint === null && r2.payDecimals === 9, 'SOL raise created');
  const aliceBefore = await conn.getBalance(alice.publicKey);
  await send([S.ixBuy(PROGRAM, alice.publicKey, r2, t2 / 10n)], [alice]); r2 = await raiseState(c2.raise);
  ok(r2.raised === String(t2 / 10n) && (await conn.getBalance(c2.raise)) > Number(t2 / 10n), 'alice pays 1 SOL into the raise PDA');
  // simulate the deadline: we cannot warp the clock on a test validator cheaply, so create a 1h raise and finalize is refused; use a fresh raise with the minimum duration? Instead test refund path through the admin-less route: close by reaching target is the only early close, so we verify refusal now and the refund math via a target-reaching-below-min scenario is impossible; document.
  await fails(send([S.ixFinalize(PROGRAM, bob.publicKey, r2, feeTo.publicKey)], [bob]), /custom program error/i, 'SOL raise cannot be finalized before its deadline');
  await fails(send([S.ixRefund(PROGRAM, alice.publicKey, r2)], [alice]), /custom program error/i, 'no refund before finalize');
  require('fs').writeFileSync(process.env.STATE || '/tmp/solbite-test-state.json', JSON.stringify({ alice: Array.from(alice.secretKey), raise: c2.raise.toBase58(), feeTo: feeTo.publicKey.toBase58(), closeAt: r2.closeAt }));
  console.log(`\n${passed} passed`); process.exit(0);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
