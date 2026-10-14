/* Client for the Sol Bite program (contracts/solana): account layouts, PDAs,
 * instruction builders and decoders. Used by the server (API + indexer), the
 * tests and the admin tools. Mirrors src/lib.rs byte for byte. */
'use strict';
const { PublicKey, SystemProgram, TransactionInstruction, SYSVAR_RENT_PUBKEY } = require('@solana/web3.js');

const SPL_TOKEN = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const SPL_TOKEN_2022 = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
const ATA_PROGRAM = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const SUPPLY = 1_000_000_000n * 1_000_000n;
const COIN_DECIMALS = 6;
const POOL_BPS = 2000n, FEE_BPS = 100n, SWAP_FEE_BPS = 100n;
const RAISE_LEN = 1 + 1 + 32 + 32 + 32 + 1 + 1 + 32 + 8 + 24 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + 1 + 4 + 8 + 8 + 8;

const u64 = (v) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(v)); return b; };
const i64 = (v) => { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(v)); return b; };
const fixed = (s, n) => { const b = Buffer.alloc(n); Buffer.from(String(s), 'utf8').copy(b, 0, 0, n); return b; };
const str = (b) => b.toString('utf8').replace(/\0+$/, '');

function ata(owner, mint, tokenProgram = SPL_TOKEN) { return PublicKey.findProgramAddressSync([owner.toBuffer(), tokenProgram.toBuffer(), mint.toBuffer()], ATA_PROGRAM)[0]; }
function configPda(programId) { return PublicKey.findProgramAddressSync([Buffer.from('config')], programId); }
function raisePda(programId, coinMint) { return PublicKey.findProgramAddressSync([Buffer.from('raise'), coinMint.toBuffer()], programId); }
function paidPda(programId, raise, buyer) { return PublicKey.findProgramAddressSync([Buffer.from('paid'), raise.toBuffer(), buyer.toBuffer()], programId); }

function decodeRaise(data, pubkey) {
  const d = Buffer.from(data); if (d.length < RAISE_LEN || d[0] !== 2) return null; let o = 1;
  const r = {}; r.bump = d[o]; o += 1;
  r.creator = new PublicKey(d.subarray(o, o + 32)).toBase58(); o += 32;
  r.coinMint = new PublicKey(d.subarray(o, o + 32)).toBase58(); o += 32;
  const pm = new PublicKey(d.subarray(o, o + 32)); r.payMint = pm.equals(PublicKey.default) ? null : pm.toBase58(); o += 32;
  r.payDecimals = d[o]; o += 1; r.payIs2022 = d[o] === 1; o += 1;
  r.name = str(d.subarray(o, o + 32)); o += 32; r.symbol = str(d.subarray(o, o + 8)); o += 8; r.restaurant = str(d.subarray(o, o + 24)); o += 24;
  for (const k of ['target', 'raised', 'min', 'cap']) { r[k] = d.readBigUInt64LE(o).toString(); o += 8; }
  for (const k of ['openAt', 'closeAt', 'closedAt']) { r[k] = Number(d.readBigInt64LE(o)); o += 8; }
  r.finalized = d[o] === 1; o += 1; r.graduated = d[o] === 1; o += 1; r.buyers = d.readUInt32LE(o); o += 4;
  for (const k of ['poolCoin', 'poolPay', 'claimedTotal']) { r[k] = d.readBigUInt64LE(o).toString(); o += 8; }
  if (pubkey) r.address = typeof pubkey === 'string' ? pubkey : pubkey.toBase58();
  return r;
}
function decodePaid(data) { const d = Buffer.from(data); if (d.length < 11 || d[0] !== 3) return null; return { amount: d.readBigUInt64LE(1).toString(), claimed: d[9] === 1 }; }
function decodeConfig(data) { const d = Buffer.from(data); if (d.length < 66 || d[0] !== 1) return null; return { admin: new PublicKey(d.subarray(1, 33)).toBase58(), feeTo: new PublicKey(d.subarray(33, 65)).toBase58() }; }

const meta = (pubkey, isSigner = false, isWritable = false) => ({ pubkey, isSigner, isWritable });

function ixInitConfig(programId, admin, feeTo) {
  const [config] = configPda(programId);
  return new TransactionInstruction({ programId, keys: [meta(admin, true, true), meta(config, false, true), meta(SystemProgram.programId)], data: Buffer.concat([Buffer.from([0]), feeTo.toBuffer()]) });
}
function ixSetFeeTo(programId, admin, feeTo) { const [config] = configPda(programId); return new TransactionInstruction({ programId, keys: [meta(admin, true), meta(config, false, true)], data: Buffer.concat([Buffer.from([7]), feeTo.toBuffer()]) }); }

/* pay: { mint: PublicKey|null, is2022: bool } ; null = SOL */
function ixCreate(programId, creator, coinMint, { name, symbol, restaurant, target, duration, pay }) {
  const [raise] = raisePda(programId, coinMint); const coinVault = ata(raise, coinMint, SPL_TOKEN);
  const payProgram = pay ? (pay.is2022 ? SPL_TOKEN_2022 : SPL_TOKEN) : SPL_TOKEN;
  const payMint = pay ? pay.mint : SystemProgram.programId; const payVault = pay ? ata(raise, pay.mint, payProgram) : raise;
  const data = Buffer.concat([Buffer.from([1]), fixed(name, 32), fixed(symbol, 8), fixed(restaurant, 24), u64(target), i64(duration)]);
  const keys = [meta(creator, true, true), meta(raise, false, true), meta(coinMint, true, true), meta(coinVault, false, true), meta(payMint), meta(payVault, false, true), meta(payProgram), meta(SPL_TOKEN), meta(ATA_PROGRAM), meta(SystemProgram.programId), meta(SYSVAR_RENT_PUBKEY)];
  return { ix: new TransactionInstruction({ programId, keys, data }), raise, coinVault, payVault };
}
function ixBuy(programId, buyer, r, amount) {
  const raise = new PublicKey(r.address); const [paid] = paidPda(programId, raise, buyer);
  const payProgram = r.payMint ? (r.payIs2022 ? SPL_TOKEN_2022 : SPL_TOKEN) : SPL_TOKEN;
  const payMint = r.payMint ? new PublicKey(r.payMint) : SystemProgram.programId;
  const buyerPay = r.payMint ? ata(buyer, payMint, payProgram) : buyer; const payVault = r.payMint ? ata(raise, payMint, payProgram) : raise;
  return new TransactionInstruction({ programId, keys: [meta(buyer, true, true), meta(raise, false, true), meta(paid, false, true), meta(buyerPay, false, true), meta(payVault, false, true), meta(payMint), meta(payProgram), meta(SystemProgram.programId)], data: Buffer.concat([Buffer.from([2]), u64(amount)]) });
}
function ixFinalize(programId, who, r, feeTo) {
  const raise = new PublicKey(r.address); const [config] = configPda(programId);
  const payProgram = r.payMint ? (r.payIs2022 ? SPL_TOKEN_2022 : SPL_TOKEN) : SPL_TOKEN;
  const payMint = r.payMint ? new PublicKey(r.payMint) : SystemProgram.programId;
  const feeDest = r.payMint ? ata(feeTo, payMint, payProgram) : feeTo; const payVault = r.payMint ? ata(raise, payMint, payProgram) : raise;
  return new TransactionInstruction({ programId, keys: [meta(who, true), meta(raise, false, true), meta(config), meta(feeDest, false, true), meta(payVault, false, true), meta(payMint), meta(payProgram)], data: Buffer.from([3]) });
}
function ixClaim(programId, buyer, r) {
  const raise = new PublicKey(r.address); const [paid] = paidPda(programId, raise, buyer); const coinMint = new PublicKey(r.coinMint);
  return new TransactionInstruction({ programId, keys: [meta(buyer, true, true), meta(raise, false, true), meta(paid, false, true), meta(ata(raise, coinMint), false, true), meta(ata(buyer, coinMint), false, true), meta(coinMint), meta(SPL_TOKEN), meta(ATA_PROGRAM), meta(SystemProgram.programId)], data: Buffer.from([4]) });
}
function ixRefund(programId, buyer, r) {
  const raise = new PublicKey(r.address); const [paid] = paidPda(programId, raise, buyer);
  const payProgram = r.payMint ? (r.payIs2022 ? SPL_TOKEN_2022 : SPL_TOKEN) : SPL_TOKEN; const payMint = r.payMint ? new PublicKey(r.payMint) : SystemProgram.programId;
  const buyerPay = r.payMint ? ata(buyer, payMint, payProgram) : buyer; const payVault = r.payMint ? ata(raise, payMint, payProgram) : raise;
  return new TransactionInstruction({ programId, keys: [meta(buyer, true, true), meta(raise, false, true), meta(paid, false, true), meta(buyerPay, false, true), meta(payVault, false, true), meta(payMint), meta(payProgram)], data: Buffer.from([5]) });
}
function ixSwap(programId, trader, r, amountIn, minOut, coinToPay) {
  const raise = new PublicKey(r.address); const coinMint = new PublicKey(r.coinMint);
  const payProgram = r.payMint ? (r.payIs2022 ? SPL_TOKEN_2022 : SPL_TOKEN) : SPL_TOKEN; const payMint = r.payMint ? new PublicKey(r.payMint) : SystemProgram.programId;
  const traderPay = r.payMint ? ata(trader, payMint, payProgram) : trader; const payVault = r.payMint ? ata(raise, payMint, payProgram) : raise;
  return new TransactionInstruction({ programId, keys: [meta(trader, true, true), meta(raise, false, true), meta(ata(raise, coinMint), false, true), meta(ata(trader, coinMint), false, true), meta(payVault, false, true), meta(traderPay, false, true), meta(coinMint), meta(payMint), meta(SPL_TOKEN), meta(payProgram), meta(ATA_PROGRAM), meta(SystemProgram.programId)], data: Buffer.concat([Buffer.from([6]), u64(amountIn), u64(minOut), Buffer.from([coinToPay ? 1 : 0])]) });
}

/* quote for the built-in pool, same math as the program */
function quoteSwap(r, amountIn, coinToPay) {
  const a = BigInt(amountIn); const feeIn = a - a * SWAP_FEE_BPS / 10000n; const pc = BigInt(r.poolCoin), pp = BigInt(r.poolPay);
  if (coinToPay) return pc + feeIn === 0n ? 0n : pp * feeIn / (pc + feeIn);
  return pp + feeIn === 0n ? 0n : pc * feeIn / (pp + feeIn);
}
const phaseOf = (r, now = Math.floor(Date.now() / 1000)) => r.finalized ? (r.graduated ? 'ok' : 'failed') : (r.closedAt || now >= r.closeAt) ? 'pending' : 'live';
/* serialise an instruction for the browser (it rebuilds a TransactionInstruction) */
const ixJson = (ix) => ({ programId: ix.programId.toBase58(), keys: ix.keys.map((k) => ({ pubkey: k.pubkey.toBase58(), isSigner: k.isSigner, isWritable: k.isWritable })), data: Buffer.from(ix.data).toString('base64') });

module.exports = { SPL_TOKEN, SPL_TOKEN_2022, ATA_PROGRAM, SUPPLY, COIN_DECIMALS, POOL_BPS, FEE_BPS, SWAP_FEE_BPS, RAISE_LEN, ata, configPda, raisePda, paidPda, decodeRaise, decodePaid, decodeConfig, ixInitConfig, ixSetFeeTo, ixCreate, ixBuy, ixFinalize, ixClaim, ixRefund, ixSwap, quoteSwap, phaseOf, ixJson, u64, i64 };
