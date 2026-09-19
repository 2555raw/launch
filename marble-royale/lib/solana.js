/* The two things this game needs from a chain.

   One: proof that whoever typed an address actually holds its key. A marble can
   win money, so entering someone else's wallet has to be impossible - the
   browser signs a one-time sentence and node:crypto checks the signature
   against the address. Solana addresses are ed25519 public keys, which is
   exactly what crypto.verify wants, once the 32 raw bytes are wrapped in the
   twelve-byte DER header every ed25519 key starts with.

   Two: how much the round is worth. Creator fees land in a wallet; the balance
   of that wallet at the start of a round and again at the end, and the
   difference is what that five minutes earned. Set FEE_WALLET to turn it on. No
   key ever leaves the browser and this server never holds one: it reads
   balances and it pays nobody. */

'use strict';

const crypto = require('crypto');
const b58 = require('./base58');

const RPC = process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
const SPKI = Buffer.from('302a300506032b6570032100', 'hex');
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

/** True when `signature` really is `message` signed by `address`. */
function verifySignature(address, message, signature) {
  try {
    const pub = b58.decode(address);
    const sig = b58.decode(signature);
    if (!pub || pub.length !== 32 || !sig || sig.length !== 64) return false;
    const key = crypto.createPublicKey({
      key: Buffer.concat([SPKI, pub]),
      format: 'der',
      type: 'spki'
    });
    return crypto.verify(null, Buffer.from(message, 'utf8'), key, sig);
  } catch {
    return false;
  }
}

async function rpc(method, params) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: ctl.signal
    });
    if (!res.ok) throw new Error('rpc ' + res.status);
    const json = await res.json();
    if (json.error) throw new Error(json.error.message || 'rpc error');
    return json.result;
  } finally {
    clearTimeout(timer);
  }
}

/** Lamports held by an address, or null when the call did not come back. */
async function balance(address) {
  try {
    const r = await rpc('getBalance', [address, { commitment: 'confirmed' }]);
    return typeof r?.value === 'number' ? r.value : null;
  } catch (err) {
    console.error('[solana] getBalance:', err.message);
    return null;
  }
}

/** How much of one mint an owner holds, in whole tokens. */
async function tokenBalance(owner, mint) {
  let total = 0, seen = false;
  for (const programId of [TOKEN_PROGRAM, TOKEN_2022]) {
    try {
      const r = await rpc('getTokenAccountsByOwner', [
        owner, { mint, programId }, { encoding: 'jsonParsed', commitment: 'confirmed' }
      ]);
      for (const acc of r?.value || []) {
        const amt = acc?.account?.data?.parsed?.info?.tokenAmount;
        if (amt && typeof amt.uiAmount === 'number') { total += amt.uiAmount; seen = true; }
      }
    } catch (err) {
      if (!/could not find account|not found/i.test(err.message)) {
        console.error('[solana] getTokenAccountsByOwner:', err.message);
      }
    }
  }
  return seen ? total : 0;
}

const LAMPORTS = 1e9;
const toSol = (lamports) => Math.round((lamports / LAMPORTS) * 1e6) / 1e6;

module.exports = { verifySignature, balance, tokenBalance, rpc, toSol, LAMPORTS, RPC };
