/* Base58 (Bitcoin alphabet), which is how Solana writes addresses and
   signatures. Decoding is all the server needs: an address comes in as text and
   has to become the 32 raw bytes of an ed25519 public key before node:crypto
   will look at it. Encoding is here too, for the one place a hash goes back out
   as text. No dependency does this for us and it is forty lines. */

'use strict';

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const MAP = new Map([...ALPHABET].map((c, i) => [c, i]));

/** Decodes base58 text to a Buffer, or null if the text is not base58. */
function decode(str) {
  if (typeof str !== 'string' || str.length === 0 || str.length > 128) return null;
  const bytes = [0];
  for (const ch of str) {
    const val = MAP.get(ch);
    if (val === undefined) return null;
    let carry = val;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  /* every leading '1' is a leading zero byte */
  for (let k = 0; k < str.length && str[k] === '1'; k++) bytes.push(0);
  return Buffer.from(bytes.reverse());
}

function encode(buf) {
  const bytes = Buffer.from(buf);
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = '';
  for (let k = 0; k < bytes.length && bytes[k] === 0; k++) out += '1';
  for (let i = digits.length - 1; i >= 0; i--) out += ALPHABET[digits[i]];
  return out;
}

/** True when the text decodes to the 32 bytes of a Solana address. */
function isAddress(str) {
  const b = decode(str);
  return b !== null && b.length === 32;
}

module.exports = { decode, encode, isAddress };
