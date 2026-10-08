// HeldAt core: cloak, prove, seal and open bonds with the Web Crypto API.
//
// Runs unchanged in the browser and in Node 20+ (globalThis.crypto). Nothing
// here talks to a network; every byte stays on the machine that calls it.
//
//   commitment = SHA-256( utf8(canonical asset) || salt[16] || key[32] )
//
// A receipt is the asset, the salt, the key and the commitment. Whoever holds
// the receipt can recompute the hash; whoever holds only the hash learns nothing.

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();

export const SALT_BYTES = 16;
export const KEY_BYTES = 32;
export const RECEIPT_PREFIX = "obx1_";
export const PACKAGE_PREFIX = "obxpkg1_";
export const BACKUP_PREFIX = "obxbak1_";
export const PBKDF2_ITERATIONS = 310000;

export function randomBytes(n) {
  return globalThis.crypto.getRandomValues(new Uint8Array(n));
}

export function toHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function fromHex(hex) {
  const clean = String(hex).trim().replace(/^0x/i, "");
  if (!/^([0-9a-f]{2})*$/i.test(clean)) throw new Error("Not valid hex");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

export function toBase64Url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(text) {
  const b64 = String(text).trim().replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

// The asset is hashed as JSON with a fixed key order, so the same asset always
// produces the same bytes no matter how the object was built.
export function canonicalAsset(asset) {
  const symbol = String(asset.symbol || "").trim().toUpperCase();
  const amount = String(asset.amount || "").trim();
  const chain = String(asset.chain || "").trim().toLowerCase();
  const note = String(asset.note || "").trim();
  if (!symbol) throw new Error("Asset needs a symbol");
  if (!/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0) throw new Error("Amount must be a positive number");
  if (!chain) throw new Error("Asset needs a chain");
  const out = { chain, symbol, amount, note };
  // Optional expiry, in Unix seconds. It is hashed with the asset, so it cannot
  // be pushed back without breaking the seal.
  if (asset.expires != null && asset.expires !== "") {
    const expires = Number(asset.expires);
    if (!Number.isInteger(expires) || expires <= 0) throw new Error("Expiry must be a date");
    out.expires = expires;
  }
  return out;
}

function assetBytes(asset) {
  const a = canonicalAsset(asset);
  const fields = [a.chain, a.symbol, a.amount, a.note];
  if (a.expires) fields.push(a.expires); // receipts without expiry hash exactly as before
  return enc.encode(JSON.stringify(fields));
}

// Seconds left before a receipt expires: null when it never does, 0 once it has.
export function secondsLeft(asset, now = Date.now()) {
  if (!asset?.expires) return null;
  return Math.max(0, asset.expires - Math.floor(now / 1000));
}

export async function commit(asset, salt, key) {
  if (salt.length !== SALT_BYTES) throw new Error(`Salt must be ${SALT_BYTES} bytes`);
  if (key.length !== KEY_BYTES) throw new Error(`Key must be ${KEY_BYTES} bytes`);
  const digest = await subtle.digest("SHA-256", concat(assetBytes(asset), salt, key));
  return toHex(new Uint8Array(digest));
}

// Cloak an asset under a fresh salt and a key used once.
export async function cloak(asset, { prev = null } = {}) {
  const a = canonicalAsset(asset);
  const salt = randomBytes(SALT_BYTES);
  const key = randomBytes(KEY_BYTES);
  return {
    v: 1,
    asset: a,
    salt: toHex(salt),
    key: toHex(key),
    commitment: await commit(a, salt, key),
    created: new Date().toISOString(),
    prev,
  };
}

// Recompute the hash from a receipt. With `expected`, the commitment must also
// match the one the verifier got on their own (from the chain, or the holder).
// The answer is one bit.
export async function verify(receipt, expected = null) {
  try {
    const r = typeof receipt === "string" ? decodeReceipt(receipt) : receipt;
    const actual = await commit(r.asset, fromHex(r.salt), fromHex(r.key));
    if (actual !== String(r.commitment).toLowerCase()) return false;
    if (expected && actual !== String(expected).trim().replace(/^0x/i, "").toLowerCase()) return false;
    return true;
  } catch {
    return false;
  }
}

export function encodeReceipt(receipt) {
  const { v, asset, salt, key, commitment, proof, anchor } = receipt;
  const body = { v, asset, salt, key, commitment };
  if (proof) body.proof = proof;
  // Only anchors that name their chain can be checked, so only those travel.
  if (anchor && typeof anchor === "object" && anchor.chainId && anchor.tx) body.anchor = { chainId: anchor.chainId, tx: anchor.tx };
  return RECEIPT_PREFIX + toBase64Url(enc.encode(JSON.stringify(body)));
}

export function decodeReceipt(text) {
  const t = String(text).trim();
  if (!t.startsWith(RECEIPT_PREFIX)) throw new Error("Not a HeldAt receipt");
  const r = JSON.parse(dec.decode(fromBase64Url(t.slice(RECEIPT_PREFIX.length))));
  if (r.v !== 1 || !r.asset || !r.salt || !r.key || !r.commitment) throw new Error("Receipt is incomplete");
  return r;
}

async function passphraseKey(passphrase, salt) {
  const base = await subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

// Seal text behind a passphrase: PBKDF2-SHA-256 into AES-256-GCM.
async function sealText(text, passphrase, prefix) {
  if (!passphrase || passphrase.length < 8) throw new Error("Passphrase needs at least 8 characters");
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const aesKey = await passphraseKey(passphrase, salt);
  const ct = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv }, aesKey, enc.encode(text)));
  return prefix + toBase64Url(concat(salt, iv, ct));
}

async function openText(sealed, passphrase, prefix, what) {
  const t = String(sealed).trim();
  if (!t.startsWith(prefix)) throw new Error(`Not a HeldAt ${what}`);
  const raw = fromBase64Url(t.slice(prefix.length));
  try {
    const aesKey = await passphraseKey(passphrase, raw.slice(0, 16));
    return dec.decode(await subtle.decrypt({ name: "AES-GCM", iv: raw.slice(16, 28) }, aesKey, raw.slice(28)));
  } catch {
    throw new Error(`Wrong passphrase, or the ${what} was altered`);
  }
}

// Seal a receipt for transfer.
export function seal(receipt, passphrase) {
  return sealText(encodeReceipt(receipt), passphrase, PACKAGE_PREFIX);
}

// Seal a whole vault for backup. Receipts are keys: a backup in the clear is a
// copy of every bond for whoever finds the file.
export function sealBackup(bonds, passphrase) {
  return sealText(JSON.stringify({ app: "obscura", v: 1, exported: new Date().toISOString(), bonds }), passphrase, BACKUP_PREFIX);
}

export async function openBackup(text, passphrase) {
  const data = JSON.parse(await openText(text, passphrase, BACKUP_PREFIX, "backup"));
  if (!Array.isArray(data.bonds)) throw new Error("The backup holds no bonds");
  return data.bonds;
}

// Open a package, check the receipt inside, and re-cloak the same asset under
// a new salt and key. The sender's old receipt keeps verifying; the new one
// is the recipient's alone.
export async function receive(pkg, passphrase) {
  const incoming = decodeReceipt(await openText(pkg, passphrase, PACKAGE_PREFIX, "transfer package"));
  if (!(await verify(incoming))) throw new Error("The receipt inside does not verify");
  return cloak(incoming.asset, { prev: incoming.commitment });
}
