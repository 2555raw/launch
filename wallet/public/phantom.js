/* Signing with Phantom instead of with Ward's own key.
 *
 * Ward already links MetaMask and friends, but over EIP-6963, which is an EVM
 * interface Solana does not speak. Phantom's Solana side is a different door:
 * an injected provider at window.phantom.solana, with its own methods. An
 * extension's script is injected into the page rather than fetched by it, so
 * script-src 'self' does not block it and nothing is vendored here.
 *
 * The part worth knowing, because it shapes everything below: Phantom's
 * request() takes a base58 string of the serialized *message*, which is
 * precisely what sol.js buildMessage already produces. So no transaction
 * library is needed on either side of this.
 *
 * And the trap: signAndSendTransaction takes only that message and rejects a
 * transaction that already carries signatures. A coin launch needs two, the
 * creator's and the brand-new mint's, so it cannot go through that method.
 * signTransaction is the one that works: Phantom returns its signature, the
 * mint's is added beside it in the order the message itself declares, and Ward
 * submits the result to its own RPC. Plain transfers, which need only one
 * signature, can still take the simpler road. */

window.WARD_PHANTOM = (function () {
  const SOL = window.WARD_SOL;

  /* Phantom exposes itself twice; window.phantom.solana is the one Phantom
     documents, and the bare window.solana can belong to another wallet that
     claimed the name first. Preferring the namespaced one and checking the
     flag avoids signing through something that merely looks like it. */
  function provider() {
    const p = (window.phantom && window.phantom.solana) || window.solana;
    return p && p.isPhantom ? p : null;
  }

  const available = () => !!provider();

  let account = null;
  const address = () => account;

  async function connect() {
    const p = provider();
    if (!p) throw new Error('phantom-missing');
    const res = await p.connect();
    account = (res && res.publicKey ? res.publicKey : p.publicKey).toString();
    return account;
  }

  async function disconnect() {
    const p = provider();
    account = null;
    if (p && p.disconnect) { try { await p.disconnect(); } catch { /* already gone */ } }
  }

  /* Fires when the person switches account inside Phantom, which otherwise
     leaves Ward showing an address that is no longer the one signing. */
  function onChange(fn) {
    const p = provider();
    if (!p || !p.on) return;
    p.on('accountChanged', pk => { account = pk ? pk.toString() : null; fn(account); });
    p.on('disconnect', () => { account = null; fn(null); });
  }

  /* One signature: hand Phantom the message and let it submit. */
  async function signAndSend(message) {
    const p = provider();
    if (!p) throw new Error('phantom-missing');
    const { signature } = await p.request({
      method: 'signAndSendTransaction',
      params: { message: SOL.b58encode(message) }
    });
    return signature;
  }

  /* Two or more signatures. Phantom signs the message and returns its own
     signature; the rest are added here, in the order the message declares its
     signers, and the assembled transaction goes to Ward's RPC.
     `others` is [{ pub, secret }] for every signer that is not Phantom. */
  async function signWithOthers(message, others) {
    const p = provider();
    if (!p) throw new Error('phantom-missing');
    const P = SOL.parts;

    const res = await p.request({
      method: 'signTransaction',
      params: { message: SOL.b58encode(message) }
    });
    /* Phantom has returned the signature under both names across versions, and
       sometimes the whole signed transaction. Take whichever is there rather
       than assuming one. */
    const raw = res && (res.signature || res.signatures || res.transaction);
    if (!raw) throw new Error('phantom-no-signature');
    const theirs = typeof raw === 'string' ? SOL.b58decode(raw) : new Uint8Array(raw);
    if (theirs.length !== 64) throw new Error('phantom-bad-signature');

    const e = await P.lib();
    const want = P.signersOf(message);
    const mine = account ? SOL.b58decode(account) : null;
    const sigs = [];
    for (const pub of want) {
      if (mine && P.eq(pub, mine)) { sigs.push(theirs); continue; }
      const kp = others.find(k => P.eq(k.pub, pub));
      if (!kp) throw new Error('phantom-missing-signer');
      sigs.push(await e.signAsync(message, kp.secret));
    }
    const tx = P.cat(Uint8Array.from(P.shortvec(sigs.length)), ...sigs, message);
    return P.submit(tx);
  }

  return { available, provider, connect, disconnect, onChange, address, signAndSend, signWithOthers };
})();
