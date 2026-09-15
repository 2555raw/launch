/* Solana, kept apart from the rest of the wallet.
 *
 * Everything else here is EVM: one key type, one address format, one way to
 * sign. Solana shares none of that — different curve (ed25519, not secp256k1),
 * different addresses (32 bytes in base58, not 20 in hex), a different
 * transaction format and a different RPC. ethers cannot touch any of it, so
 * none of this leans on ethers; the only thing the two families share is the
 * twelve words, and that is the whole reason Solana is here at all. The same
 * phrase that restores your Ward wallet restores this account in Phantom or
 * Solflare, which means a bug in this file can never strand the money: the
 * seed reaches it from software that is not ours.
 *
 * The derivation below was checked against ed25519-hd-key and @solana/web3.js
 * on fifteen phrase/account pairs, and the transaction bytes against
 * @solana/web3.js as well. */

window.WARD_SOL = (function () {
  const RPC = 'https://api.mainnet-beta.solana.com';
  const EXPLORER = 'https://solscan.io';
  /* The system program, which owns plain SOL transfers. Its id is 32 zero
     bytes, which in base58 is thirty-two ones. */
  const SYSTEM_PROGRAM = new Uint8Array(32);
  const LAMPORTS = 1000000000n;           // 1 SOL
  const enc = new TextEncoder();

  /* ── base58 ─────────────────────────────────────────────────────────── */
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const INDEX = (() => { const m = {}; for (let i = 0; i < ALPHABET.length; i++) m[ALPHABET[i]] = i; return m; })();

  function b58encode(bytes) {
    let n = 0n;
    for (const b of bytes) n = (n << 8n) | BigInt(b);
    let s = '';
    while (n > 0n) { s = ALPHABET[Number(n % 58n)] + s; n /= 58n; }
    /* Leading zero bytes are not a number, they are position, so each one is
       written out as a literal '1' rather than being swallowed by the maths. */
    for (const b of bytes) { if (b === 0) s = '1' + s; else break; }
    return s || '1';
  }

  function b58decode(str) {
    let n = 0n;
    for (const ch of str) {
      const v = INDEX[ch];
      if (v === undefined) throw new Error('not base58');
      n = n * 58n + BigInt(v);
    }
    const out = [];
    while (n > 0n) { out.unshift(Number(n & 255n)); n >>= 8n; }
    for (const ch of str) { if (ch === '1') out.unshift(0); else break; }
    return Uint8Array.from(out);
  }

  /* An address is a 32-byte ed25519 point written in base58. Length alone is
     not enough: a typo'd character can still decode to 32 bytes, but it
     decodes to a different key, which is exactly the failure that loses money.
     Nothing on this side can catch that; only the person reading it can. */
  function isAddress(s) {
    if (typeof s !== 'string' || s.length < 32 || s.length > 44) return false;
    try { return b58decode(s.trim()).length === 32; } catch { return false; }
  }

  /* ── keys ───────────────────────────────────────────────────────────── */
  let ed = null;
  /* The ed25519 library is 39 KB and only Solana needs it, so it is not
     fetched until someone actually selects this network. */
  async function lib() {
    if (!ed) ed = await import('./vendor/noble-ed25519.js');
    return ed;
  }

  async function hmac512(key, msg) {
    const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', k, msg));
  }

  /* SLIP-0010 over ed25519. Every level is hardened — the curve has no public
     derivation — and each step hashes 0x00 || key || index. */
  async function slip10(seed, account) {
    let I = await hmac512(enc.encode('ed25519 seed'), seed);
    let key = I.slice(0, 32), chain = I.slice(32);
    for (const idx of [44, 501, account, 0]) {
      const data = new Uint8Array(37);
      data[0] = 0;
      data.set(key, 1);
      new DataView(data.buffer).setUint32(33, (idx + 0x80000000) >>> 0, false);
      I = await hmac512(chain, data);
      key = I.slice(0, 32); chain = I.slice(32);
    }
    return key;
  }

  const hexToBytes = h => Uint8Array.from(h.replace(/^0x/, '').match(/../g).map(x => parseInt(x, 16)));

  /* m/44'/501'/<account>'/0' — the path Phantom and Solflare use, so the
     address Ward shows is the address those wallets show for the same words. */
  async function fromSeed(seedHex, account) {
    const e = await lib();
    const secret = await slip10(hexToBytes(seedHex), account | 0);
    const pub = await e.getPublicKeyAsync(secret);
    return { secret, pub, address: b58encode(pub) };
  }

  /* ── rpc ────────────────────────────────────────────────────────────── */
  let endpoint = RPC;
  const setRpc = url => { endpoint = url || RPC; };

  let id = 0;
  async function rpc(method, params) {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params })
    });
    if (!r.ok) throw new Error('rpc ' + r.status);
    const j = await r.json();
    if (j.error) throw new Error(j.error.message || 'rpc error');
    return j.result;
  }

  const balance = async address =>
    BigInt((await rpc('getBalance', [address, { commitment: 'confirmed' }])).value);

  /* An SPL balance lives in a token account owned by the address, not in the
     address itself, and there can be more than one, so they are summed. */
  async function tokenBalance(address, mint) {
    const res = await rpc('getTokenAccountsByOwner',
      [address, { mint }, { encoding: 'jsonParsed', commitment: 'confirmed' }]);
    let total = 0n;
    for (const a of (res.value || [])) {
      const amt = a.account?.data?.parsed?.info?.tokenAmount?.amount;
      if (amt) total += BigInt(amt);
    }
    return total;
  }

  /* ── transactions ───────────────────────────────────────────────────── */
  /* Lengths in a Solana message are compact-u16: seven bits at a time, high
     bit set while more follow. */
  function shortvec(n) {
    const out = [];
    for (;;) {
      if (n < 0x80) { out.push(n); break; }
      out.push((n & 0x7f) | 0x80);
      n >>= 7;
    }
    return out;
  }

  const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

  /* A legacy transfer message.
   *
   * The account list has to be deduplicated, and a key that turns up twice
   * takes the stronger of the two roles: paying yourself puts the same key in
   * as both sender and recipient, and it stays one writable signer rather than
   * becoming two accounts. Getting this wrong produces bytes the runtime
   * rejects, so it is done generally rather than by special-casing the pairs
   * that happen to be easy to imagine. */
  function transferMessage(fromPub, toPub, lamports, blockhash) {
    const metas = [];
    const add = (key, signer, writable) => {
      const seen = metas.find(m => eq(m.key, key));
      if (seen) { seen.signer = seen.signer || signer; seen.writable = seen.writable || writable; }
      else metas.push({ key, signer, writable });
    };
    add(fromPub, true, true);            // the sender, who also pays the fee
    add(toPub, false, true);
    add(SYSTEM_PROGRAM, false, false);   // the program that moves the lamports

    /* The runtime fixes the order: signers first, and within each half the
       writable accounts before the read-only ones. The sender is the only
       account that is both, so it lands at index 0, where the fee payer must
       be. */
    const rank = m => (m.signer ? 0 : 2) + (m.writable ? 0 : 1);
    metas.sort((a, b) => rank(a) - rank(b));
    const indexOf = key => metas.findIndex(m => eq(m.key, key));

    const data = new Uint8Array(12);
    const dv = new DataView(data.buffer);
    dv.setUint32(0, 2, true);                       // SystemInstruction::Transfer
    dv.setBigUint64(4, BigInt(lamports), true);

    const out = [];
    out.push(metas.filter(m => m.signer).length);
    out.push(metas.filter(m => m.signer && !m.writable).length);
    out.push(metas.filter(m => !m.signer && !m.writable).length);
    out.push(...shortvec(metas.length));
    metas.forEach(m => out.push(...m.key));
    out.push(...b58decode(blockhash));
    out.push(...shortvec(1));                       // one instruction
    out.push(indexOf(SYSTEM_PROGRAM));
    const accts = [indexOf(fromPub), indexOf(toPub)];
    out.push(...shortvec(accts.length), ...accts);
    out.push(...shortvec(data.length), ...data);
    return Uint8Array.from(out);
  }

  async function signedTransfer(secret, fromPub, to, lamports, blockhash) {
    const e = await lib();
    const msg = transferMessage(fromPub, b58decode(to), lamports, blockhash);
    const sig = await e.signAsync(msg, secret);
    return Uint8Array.from([...shortvec(1), ...sig, ...msg]);
  }

  const b64 = bytes => btoa(String.fromCharCode(...bytes));

  async function send(secret, fromPub, to, lamports) {
    const { value } = await rpc('getLatestBlockhash', [{ commitment: 'finalized' }]);
    const tx = await signedTransfer(secret, fromPub, to, lamports, value.blockhash);
    return rpc('sendTransaction', [b64(tx), { encoding: 'base64', preflightCommitment: 'confirmed' }]);
  }

  async function confirmed(signature) {
    const r = await rpc('getSignatureStatuses', [[signature], { searchTransactionHistory: true }]);
    const s = (r.value || [])[0];
    if (!s) return null;
    if (s.err) throw new Error('the network rejected it');
    return s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized';
  }

  /* ── amounts ────────────────────────────────────────────────────────── */
  /* Parsed by hand rather than with a float: 0.1 SOL is 100000000 lamports and
     a double cannot be trusted to say so. */
  function toLamports(str, decimals) {
    const d = decimals == null ? 9 : decimals;
    const s = String(str).trim();
    if (!/^\d*\.?\d*$/.test(s) || s === '' || s === '.') throw new Error('not a number');
    const [whole, frac = ''] = s.split('.');
    if (frac.length > d) throw new Error('too many decimals');
    return BigInt(whole || '0') * (10n ** BigInt(d)) + BigInt((frac + '0'.repeat(d)).slice(0, d) || '0');
  }

  function fromLamports(v, decimals) {
    const d = BigInt(decimals == null ? 9 : decimals);
    const base = 10n ** d;
    const neg = v < 0n;
    const a = neg ? -v : v;
    const frac = (a % base).toString().padStart(Number(d), '0').replace(/0+$/, '');
    return (neg ? '-' : '') + (a / base) + (frac ? '.' + frac : '');
  }

  return {
    RPC, EXPLORER, LAMPORTS,
    b58encode, b58decode, isAddress,
    fromSeed, setRpc, rpc, balance, tokenBalance,
    transferMessage, signedTransfer, send, confirmed,
    toLamports, fromLamports,
    txUrl: sig => EXPLORER + '/tx/' + sig,
    addrUrl: a => EXPLORER + '/account/' + a
  };
})();
