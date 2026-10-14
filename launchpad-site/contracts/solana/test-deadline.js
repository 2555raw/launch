/* Deadline path of the program, run against the `fast` test build (minimum
 * duration 3 s): a SOL raise that closes below its minimum -> finalize marks it
 * failed -> refund returns 100 %; and a raise that closes above the minimum
 * without reaching the target -> graduates with the real raised amount. */
'use strict';
const assert = require('assert');
const { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const S = require('../../chain/solbite');
const RPC = process.env.RPC || 'http://127.0.0.1:8899'; const PROGRAM = new PublicKey(process.env.PROGRAM_ID); const conn = new Connection(RPC, 'confirmed');
let passed = 0; const ok = (c, m) => { assert.ok(c, m); passed++; console.log('  ok ' + m); };
const send = async (ixs, signers) => sendAndConfirmTransaction(conn, new Transaction().add(...ixs), signers, { commitment: 'confirmed' });
const airdrop = async (pk, s) => { const sig = await conn.requestAirdrop(pk, s * LAMPORTS_PER_SOL); await conn.confirmTransaction(sig, 'confirmed'); };
const state = async (a) => S.decodeRaise((await conn.getAccountInfo(a)).data, a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const admin = Keypair.generate(), feeTo = Keypair.generate(), creator = Keypair.generate(), alice = Keypair.generate(), bob = Keypair.generate();
  for (const k of [admin, feeTo, creator, alice, bob]) await airdrop(k.publicKey, 20);
  await send([S.ixInitConfig(PROGRAM, admin.publicKey, feeTo.publicKey)], [admin]);
  // 1. below the minimum -> refund
  const coin = Keypair.generate(); const t = 10n * BigInt(LAMPORTS_PER_SOL);
  const c = S.ixCreate(PROGRAM, creator.publicKey, coin.publicKey, { name: 'Frap Coin', symbol: 'FRAP', restaurant: 'starbucks', target: t, duration: 4, pay: null });
  await send([c.ix], [creator, coin]); let r = await state(c.raise);
  await send([S.ixBuy(PROGRAM, alice.publicKey, r, t / 10n)], [alice]); r = await state(c.raise); ok(r.raised === String(t / 10n), 'alice puts 1 SOL into a 10 SOL raise (minimum 3.33)');
  await sleep(6000); const now = await conn.getBlockTime(await conn.getSlot()); ok(now >= r.closeAt, 'deadline passed');
  await send([S.ixFinalize(PROGRAM, bob.publicKey, r, feeTo.publicKey)], [bob]); r = await state(c.raise);
  ok(r.finalized && !r.graduated && r.closedAt === r.closeAt && r.poolPay === '0', 'finalize after the deadline below the minimum: failed, no pool, no fee');
  const before = await conn.getBalance(alice.publicKey); await send([S.ixRefund(PROGRAM, alice.publicKey, r)], [alice]); const after = await conn.getBalance(alice.publicKey);
  ok(after - before > 0.99 * LAMPORTS_PER_SOL, 'alice is refunded her 1 SOL');
  let twice = false; try { await send([S.ixRefund(PROGRAM, alice.publicKey, r)], [alice]); } catch { twice = true; } ok(twice, 'refund twice is refused');
  ok((await conn.getBalance(c.raise)) >= await conn.getMinimumBalanceForRentExemption(S.RAISE_LEN), 'raise PDA keeps its rent after refunds');
  let claimFail = false; try { await send([S.ixClaim(PROGRAM, alice.publicKey, r)], [alice]); } catch { claimFail = true; } ok(claimFail, 'no claim on a failed raise');
  // 2. above the minimum but below the target -> graduates at the deadline with the real amount
  const coin2 = Keypair.generate(); const c2 = S.ixCreate(PROGRAM, creator.publicKey, coin2.publicKey, { name: 'Latte', symbol: 'LATTE', restaurant: 'starbucks', target: t, duration: 4, pay: null });
  await send([c2.ix], [creator, coin2]); let r2 = await state(c2.raise);
  for (const k of [alice, bob, creator, admin]) { r2 = await state(c2.raise); await send([S.ixBuy(PROGRAM, k.publicKey, r2, t / 10n)], [k]); }
  r2 = await state(c2.raise); ok(r2.raised === String(4n * t / 10n) && r2.buyers === 4, 'four wallets put in 4 SOL of 10 (above the 3.33 minimum)');
  await sleep(6000);
  const feeBefore = await conn.getBalance(feeTo.publicKey); await send([S.ixFinalize(PROGRAM, bob.publicKey, r2, feeTo.publicKey)], [bob]); r2 = await state(c2.raise);
  ok(r2.graduated && r2.poolPay === String(4n * t / 10n - 4n * t / 1000n) && (await conn.getBalance(feeTo.publicKey)) - feeBefore === Number(4n * t / 1000n), 'graduates at the deadline: pool = 99 % of 4 SOL, fee = 1 % in SOL');
  await send([S.ixClaim(PROGRAM, alice.publicKey, r2)], [alice]); ok(BigInt((await conn.getTokenAccountBalance(S.ata(alice.publicKey, coin2.publicKey))).value.amount) === S.SUPPLY * 80n / 100n / 4n, 'alice claims a quarter of the buyers\' share');
  const q = S.quoteSwap(r2, BigInt(LAMPORTS_PER_SOL) / 10n, false); await send([S.ixSwap(PROGRAM, bob.publicKey, r2, BigInt(LAMPORTS_PER_SOL) / 10n, q, false)], [bob]);
  ok(BigInt((await conn.getTokenAccountBalance(S.ata(bob.publicKey, coin2.publicKey))).value.amount) === q, 'SOL -> coin swap on the built-in pool pays the quoted amount');
  console.log(`\n${passed} passed`); process.exit(0);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
