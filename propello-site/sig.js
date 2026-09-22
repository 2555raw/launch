/* ===========================================================================
   Propello — checking a wallet signature, in the browser, with nothing
   installed. Two pieces of arithmetic and no dependencies:

     · keccak256, the hash Ethereum uses (not SHA-3's padding: 0x01, not 0x06);
     · secp256k1 public-key recovery, which turns a signature back into the
       address that made it.

   That is enough to prove, on the page, that a signature really came from
   the address it claims. Nothing here can sign or spend: there is no private
   key in this file, only the maths that reads one's work.

   window.PROPELLO_SIG = { keccak256, hashMessage, recover, verify, selfTest }
   =========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------ keccak --- */
  var RC = [
    0x00000001, 0x00000000, 0x00008082, 0x00000000, 0x0000808a, 0x80000000,
    0x80008000, 0x80000000, 0x0000808b, 0x00000000, 0x80000001, 0x00000000,
    0x80008081, 0x80000000, 0x00008009, 0x80000000, 0x0000008a, 0x00000000,
    0x00000088, 0x00000000, 0x80008009, 0x00000000, 0x8000000a, 0x00000000,
    0x8000808b, 0x00000000, 0x0000008b, 0x80000000, 0x00008089, 0x80000000,
    0x00008003, 0x80000000, 0x00008002, 0x80000000, 0x00000080, 0x80000000,
    0x0000800a, 0x00000000, 0x8000000a, 0x80000000, 0x80008081, 0x80000000,
    0x00008080, 0x80000000, 0x80000001, 0x00000000, 0x80008008, 0x80000000
  ];
  /* how far each lane turns, in the order rho and pi walk them */
  var ROT = [1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14, 27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44];

  /* the state is 25 lanes of 64 bits, each held as a low and a high word */
  function keccakF(lo, hi) {
    var C = new Int32Array(10), D = new Int32Array(10);
    for (var round = 0; round < 24; round++) {
      var x, y, i, j;
      for (x = 0; x < 5; x++) {
        C[x * 2] = lo[x] ^ lo[x + 5] ^ lo[x + 10] ^ lo[x + 15] ^ lo[x + 20];
        C[x * 2 + 1] = hi[x] ^ hi[x + 5] ^ hi[x + 10] ^ hi[x + 15] ^ hi[x + 20];
      }
      for (x = 0; x < 5; x++) {
        var px = (x + 4) % 5, nx = (x + 1) % 5;
        var rl = (C[nx * 2] << 1) | (C[nx * 2 + 1] >>> 31);
        var rh = (C[nx * 2 + 1] << 1) | (C[nx * 2] >>> 31);
        D[x * 2] = C[px * 2] ^ rl;
        D[x * 2 + 1] = C[px * 2 + 1] ^ rh;
        for (y = 0; y < 25; y += 5) { lo[x + y] ^= D[x * 2]; hi[x + y] ^= D[x * 2 + 1]; }
      }
      /* rho and pi */
      var tl = lo[1], th = hi[1];
      for (i = 0; i < 24; i++) {
        j = PI[i];
        var bl = lo[j], bh = hi[j];
        var n = ROT[i];
        var nl, nh;
        if (n < 32) { nl = (tl << n) | (th >>> (32 - n)); nh = (th << n) | (tl >>> (32 - n)); }
        else if (n === 32) { nl = th; nh = tl; }
        else { var m = n - 32; nl = (th << m) | (tl >>> (32 - m)); nh = (tl << m) | (th >>> (32 - m)); }
        lo[j] = nl; hi[j] = nh;
        tl = bl; th = bh;
      }
      /* chi */
      for (y = 0; y < 25; y += 5) {
        var l0 = lo[y], l1 = lo[y + 1], l2 = lo[y + 2], l3 = lo[y + 3], l4 = lo[y + 4];
        var h0 = hi[y], h1 = hi[y + 1], h2 = hi[y + 2], h3 = hi[y + 3], h4 = hi[y + 4];
        lo[y] = l0 ^ (~l1 & l2); hi[y] = h0 ^ (~h1 & h2);
        lo[y + 1] = l1 ^ (~l2 & l3); hi[y + 1] = h1 ^ (~h2 & h3);
        lo[y + 2] = l2 ^ (~l3 & l4); hi[y + 2] = h2 ^ (~h3 & h4);
        lo[y + 3] = l3 ^ (~l4 & l0); hi[y + 3] = h3 ^ (~h4 & h0);
        lo[y + 4] = l4 ^ (~l0 & l1); hi[y + 4] = h4 ^ (~h0 & h1);
      }
      /* iota */
      lo[0] ^= RC[round * 2]; hi[0] ^= RC[round * 2 + 1];
    }
  }
  /* where rho/pi sends each lane */
  var PI = [10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4, 15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1];

  function keccak256(bytes) {
    var lo = new Int32Array(25), hi = new Int32Array(25);
    var rate = 136, len = bytes.length, off = 0;

    function absorb(block) {
      for (var i = 0; i < rate; i += 8) {
        var j = i >> 3;
        lo[j] ^= (block[i]) | (block[i + 1] << 8) | (block[i + 2] << 16) | (block[i + 3] << 24);
        hi[j] ^= (block[i + 4]) | (block[i + 5] << 8) | (block[i + 6] << 16) | (block[i + 7] << 24);
      }
      keccakF(lo, hi);
    }

    while (len - off >= rate) { absorb(bytes.subarray(off, off + rate)); off += rate; }

    var last = new Uint8Array(rate);
    last.set(bytes.subarray(off));
    last[len - off] = 0x01;          /* keccak padding, not SHA-3's 0x06 */
    last[rate - 1] |= 0x80;
    absorb(last);

    var out = new Uint8Array(32);
    for (var i = 0; i < 4; i++) {
      var l = lo[i], h = hi[i];
      out[i * 8] = l & 255; out[i * 8 + 1] = (l >>> 8) & 255; out[i * 8 + 2] = (l >>> 16) & 255; out[i * 8 + 3] = (l >>> 24) & 255;
      out[i * 8 + 4] = h & 255; out[i * 8 + 5] = (h >>> 8) & 255; out[i * 8 + 6] = (h >>> 16) & 255; out[i * 8 + 7] = (h >>> 24) & 255;
    }
    return out;
  }

  /* ---------------------------------------------------------- secp256k1 -- */
  var P = BigInt('0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f');
  var N = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');
  var Gx = BigInt('0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798');
  var Gy = BigInt('0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8');
  var A = 0n, B = 7n;

  function mod(a, m) { var r = a % m; return r < 0n ? r + m : r; }
  function inv(a, m) {
    var g = m, x = 0n, x1 = 1n, r = mod(a, m);
    while (r !== 0n) { var q = g / r; var t = g - q * r; g = r; r = t; var t2 = x - q * x1; x = x1; x1 = t2; }
    return mod(x, m);
  }
  /* points as {x, y} in affine, null for infinity — slow but short and clear */
  function add(p1, p2) {
    if (!p1) return p2;
    if (!p2) return p1;
    if (p1.x === p2.x && mod(p1.y + p2.y, P) === 0n) return null;
    var l;
    if (p1.x === p2.x && p1.y === p2.y) l = mod((3n * p1.x * p1.x + A) * inv(2n * p1.y, P), P);
    else l = mod((p2.y - p1.y) * inv(mod(p2.x - p1.x, P), P), P);
    var x = mod(l * l - p1.x - p2.x, P);
    return { x: x, y: mod(l * (p1.x - x) - p1.y, P) };
  }
  function mul(p, k) {
    var r = null, q = p;
    while (k > 0n) { if (k & 1n) r = add(r, q); q = add(q, q); k >>= 1n; }
    return r;
  }
  var G = { x: Gx, y: Gy };

  /* ------------------------------------------------------------ helpers -- */
  function toBytes(hex) {
    hex = hex.replace(/^0x/, '');
    var out = new Uint8Array(hex.length >> 1);
    for (var i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
  }
  function toHex(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
    return s;
  }
  function big(bytes) { return BigInt('0x' + (toHex(bytes) || '0')); }
  function pad32(n) { return toBytes(n.toString(16).padStart(64, '0')); }
  function utf8(s) { return new TextEncoder().encode(s); }
  function concat(a, b) { var out = new Uint8Array(a.length + b.length); out.set(a); out.set(b, a.length); return out; }

  /* what a wallet actually signs when it signs a message (EIP-191) */
  function hashMessage(message) {
    var msg = typeof message === 'string' ? utf8(message) : message;
    return keccak256(concat(utf8('\u0019Ethereum Signed Message:\n' + msg.length), msg));
  }

  function addressOf(point) {
    var pub = concat(pad32(point.x), pad32(point.y));
    return '0x' + toHex(keccak256(pub).subarray(12));
  }

  /* recover the address that produced a signature over a hash */
  function recover(hash, signature) {
    var sig = toBytes(signature);
    if (sig.length !== 65) throw new Error('a signature is 65 bytes');
    var r = big(sig.subarray(0, 32)), s = big(sig.subarray(32, 64)), v = sig[64];
    if (v >= 27) v -= 27;
    if (v > 1) throw new Error('recovery id out of range');
    if (r <= 0n || r >= N || s <= 0n || s >= N) throw new Error('signature out of range');

    /* the x of the ephemeral point is r; solve the curve for its y */
    var x = r;
    var y2 = mod(x * x * x + B, P);
    var y = powMod(y2, (P + 1n) / 4n, P);
    if (mod(y * y, P) !== y2) throw new Error('no point for this signature');
    if ((y & 1n) !== BigInt(v)) y = P - y;

    var R = { x: x, y: y };
    var e = big(typeof hash === 'string' ? toBytes(hash) : hash);
    var rInv = inv(r, N);
    /* Q = r⁻¹ (sR − eG) */
    var Q = add(mul(R, mod(s, N)), mul(G, mod(-e, N)));
    Q = mul(Q, rInv);
    if (!Q) throw new Error('recovery failed');
    return addressOf(Q);
  }
  function powMod(b, e, m) {
    var r = 1n; b = mod(b, m);
    while (e > 0n) { if (e & 1n) r = mod(r * b, m); b = mod(b * b, m); e >>= 1n; }
    return r;
  }

  /* did `address` sign `message`? */
  function verify(message, signature, address) {
    try {
      return recover(hashMessage(message), signature).toLowerCase() === String(address).toLowerCase();
    } catch (e) { return false; }
  }

  /* ----------------------------------------------------------- self test -- */
  /* Signing lives here only so the maths can be checked against itself: a key
     is made, a message signed, and the signature recovered back to the same
     address. Nothing in the page calls it. */
  function sign(hash, priv) {
    var e = big(hash), d = BigInt(priv);
    for (var attempt = 1n; ; attempt++) {
      var k = mod(big(keccak256(concat(pad32(d), concat(hash, pad32(attempt))))), N);
      if (k === 0n) continue;
      var R = mul(G, k);
      var r = mod(R.x, N);
      if (r === 0n) continue;
      var s = mod(inv(k, N) * (e + r * d), N);
      if (s === 0n) continue;
      var v = (R.y & 1n) === 1n ? 1 : 0;
      if (s > N / 2n) { s = N - s; v ^= 1; }      /* the low-s form wallets use */
      return '0x' + toHex(pad32(r)) + toHex(pad32(s)) + (v + 27).toString(16).padStart(2, '0');
    }
  }

  function selfTest() {
    var out = [];
    /* the one hash everyone knows */
    out.push(['keccak256("")', toHex(keccak256(new Uint8Array(0))) ===
      'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470']);
    /* a long input, to exercise more than one block */
    var long = utf8(new Array(400).join('propello '));
    out.push(['keccak256 of a multi-block input runs', keccak256(long).length === 32]);
    /* sign, recover, and land back on the same address */
    var priv = BigInt('0x4c0883a69102937d6231471b5dbb6204fe512961708279f2b3c9b1e4d7bde1a1');
    var addr = addressOf(mul(G, priv));
    var msg = 'Propello — a message to sign, with an accent and a €.';
    var h = hashMessage(msg);
    var sig = sign(h, priv);
    out.push(['a signature recovers to the address that made it', recover(h, sig) === addr]);
    out.push(['verify() agrees', verify(msg, sig, addr) === true]);
    out.push(['verify() refuses another address', verify(msg, sig, '0x' + '11'.repeat(20)) === false]);
    out.push(['verify() refuses a changed message', verify(msg + '.', sig, addr) === false]);
    return out;
  }

  window.PROPELLO_SIG = {
    keccak256: keccak256, hashMessage: hashMessage, recover: recover, verify: verify,
    toHex: toHex, selfTest: selfTest, _sign: sign, _addressOf: addressOf, _mul: mul, _G: G
  };
})();
