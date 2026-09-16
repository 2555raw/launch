/* Opening a wallet without a password, without leaving the key lying about.
 *
 * Ward's normal wallet is a scrypt keystore: the password is the key, nothing
 * is stored that can open it, and forgetting the password means the twelve
 * words or nothing. That is the right shape for money, and it is also a wall
 * in front of someone who arrived to launch a coin and has not decided yet
 * whether they care.
 *
 * The obvious shortcut is to generate a passphrase and keep it beside the
 * keystore. That is not encryption. Anything that can read localStorage reads
 * both halves and walks off with the wallet, and calling the result
 * "encrypted" would be a lie told in the interface.
 *
 * So the key here is a non-extractable AES-GCM key: created by the browser,
 * stored in IndexedDB as a key object rather than as bytes, and marked so that
 * `exportKey` refuses. Script can ask it to decrypt while the page is open. No
 * script can read the key itself, copy it, or send it anywhere, which is the
 * property that matters when the attack is an injected <script> rather than
 * someone holding the laptop.
 *
 * What it does NOT do, said plainly because the screen has to say it too:
 *
 *   - There is no password, so anyone who can use this browser can spend.
 *   - Clearing site data destroys the key, and the wallet with it. The twelve
 *     words are the only way back, exactly as they always were.
 *   - It is one device. Nothing syncs.
 *
 * It is a wallet for getting started, and the interface should keep saying so
 * until the phrase is written down. */

window.WARD_VAULT = (function () {
  const DB = 'ward.vault';
  const STORE = 'keys';
  const ID = 'wrap';

  const supported = () =>
    typeof indexedDB !== 'undefined' && !!(window.crypto && window.crypto.subtle);

  function open() {
    return new Promise((res, rej) => {
      let r;
      try { r = indexedDB.open(DB, 1); } catch (e) { return rej(e); }
      r.onupgradeneeded = () => {
        if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE);
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error || new Error('indexeddb refused to open'));
    });
  }

  function tx(mode, run) {
    return open().then(db => new Promise((res, rej) => {
      const t = db.transaction(STORE, mode);
      const out = run(t.objectStore(STORE));
      t.oncomplete = () => { db.close(); res(out.result); };
      t.onerror = () => { db.close(); rej(t.error); };
      t.onabort = () => { db.close(); rej(t.error || new Error('aborted')); };
    }));
  }

  /* extractable: false is the whole point. The browser will use this key and
     will not hand its bytes to anything, including us. */
  async function makeKey() {
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await tx('readwrite', s => s.put(key, ID));
    return key;
  }

  const getKey = () => tx('readonly', s => s.get(ID));
  const dropKey = () => tx('readwrite', s => s.delete(ID));

  const b64 = u8 => btoa(String.fromCharCode(...u8));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

  /* A fresh 96-bit nonce per sealing, which is what GCM requires: reusing one
     with the same key is what breaks it. */
  async function seal(text) {
    const key = (await getKey()) || (await makeKey());
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, key, new TextEncoder().encode(text)));
    return { v: 1, iv: b64(iv), ct: b64(ct) };
  }

  /* Returns null rather than throwing when there is simply no key: a browser
     that cleared its storage is an ordinary situation, not an error. A key
     that is present but cannot open the envelope is a real failure and throws,
     because silently treating it as "no wallet" would look like the wallet
     vanished. */
  async function unseal(env) {
    if (!env || !env.ct) return null;
    const key = await getKey();
    if (!key) return null;
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(env.iv) }, key, unb64(env.ct));
    return new TextDecoder().decode(pt);
  }

  return { supported, seal, unseal, getKey, makeKey, dropKey };
})();
