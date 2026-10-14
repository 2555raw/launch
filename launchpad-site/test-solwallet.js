/* A tiny Solana wallet for tests: ed25519 keypair with Node's crypto, base58 address, signMessage like Phantom. */
'use strict';
const crypto = require('crypto');
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58encode(buf) { let n = BigInt('0x' + (Buffer.from(buf).toString('hex') || '0')); let s = ''; while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; } for (const b of buf) { if (b === 0) s = '1' + s; else break; } return s; }
function createWallet() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const raw = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32);
  return { address: b58encode(raw), publicKey: raw, signMessage: async (msg) => b58encode(crypto.sign(null, Buffer.from(msg, 'utf8'), privateKey)) };
}
module.exports = { createWallet, b58encode };
