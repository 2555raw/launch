/* Accounts without email.
 *
 * An account is an access key (seek_…). Keep the key, keep the account. A
 * wallet can sign in too: it signs a one-time message and the signature maps
 * to the account bound to that address (created on first sign-in). The
 * access key is sent as `Authorization: Bearer seek_…`. */
const crypto = require('crypto');
const { verifyMessage, isAddress, getAddress } = require('ethers');
const store = require('./store');
const config = require('./config');

const KEY_PREFIX = 'seek_';

function newId(prefix) { return prefix + crypto.randomBytes(8).toString('hex'); }
function hashKey(key) { return crypto.createHash('sha256').update(key).digest('hex'); }

function createAccount(extra = {}) {
  const key = KEY_PREFIX + crypto.randomBytes(24).toString('base64url');
  const account = {
    id: newId('acc_'),
    keyHash: hashKey(key),
    created: new Date().toISOString(),
    balance: config.welcomeCredits,
    deposited: 0,
    spent: 0,
    wallet: null,
    holdingsPct: 0,
    holdingsCheckedAt: null,
    allowance: { day: null, used: 0 },
    prefs: { theme: 'dark' },
    ...extra
  };
  store.put('accounts', account.id, account);
  return { account, key };
}

function findByKey(key) {
  if (!key || !key.startsWith(KEY_PREFIX)) return null;
  const h = hashKey(key);
  return store.find('accounts', (a) => a.keyHash === h || (a.keyHashes || []).includes(h))[0] || null;
}

function findByWallet(address) {
  const a = getAddress(address);
  return store.find('accounts', (x) => x.wallet === a)[0] || null;
}

function fromRequest(req) {
  const h = req.headers.authorization || '';
  const key = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  return findByKey(key);
}

/* --- wallet sign-in (sign a message, no transaction) --- */
function nonceFor(address) {
  if (!isAddress(address)) throw Object.assign(new Error('Not an EVM address'), { status: 400 });
  const a = getAddress(address);
  const nonce = crypto.randomBytes(12).toString('hex');
  store.put('nonces', a, { nonce, at: Date.now() });
  return { address: a, nonce, message: signInMessage(a, nonce) };
}

function signInMessage(address, nonce) {
  return `seekr wants you to sign in with your wallet.\n\nAddress: ${address}\nNonce: ${nonce}\n\nThis signature costs nothing and does not send a transaction.`;
}

function verifyWallet(address, signature) {
  if (!isAddress(address)) throw Object.assign(new Error('Not an EVM address'), { status: 400 });
  const a = getAddress(address);
  const n = store.get('nonces', a);
  if (!n || Date.now() - n.at > 10 * 60 * 1000) throw Object.assign(new Error('Nonce expired, ask for a new one'), { status: 400 });
  let recovered;
  try {
    recovered = verifyMessage(signInMessage(a, n.nonce), signature);
  } catch {
    throw Object.assign(new Error('Bad signature'), { status: 400 });
  }
  if (recovered !== a) throw Object.assign(new Error('Signature does not match the address'), { status: 401 });
  store.del('nonces', a);
  return a;
}

/* sign in with a wallet: returns { account, key } — key is fresh only when the account is new */
function walletSignIn(address, signature) {
  const a = verifyWallet(address, signature);
  const existing = findByWallet(a);
  if (existing) {
    /* rotate a key the browser can hold; the old one keeps working */
    const key = KEY_PREFIX + crypto.randomBytes(24).toString('base64url');
    existing.keyHashes = [...(existing.keyHashes || []), existing.keyHash];
    existing.keyHash = hashKey(key);
    store.put('accounts', existing.id, existing);
    return { account: existing, key, created: false };
  }
  const made = createAccount({ wallet: a });
  return { ...made, created: true };
}

/* link a wallet to the signed-in account */
function linkWallet(account, address, signature) {
  const a = verifyWallet(address, signature);
  const other = findByWallet(a);
  if (other && other.id !== account.id) throw Object.assign(new Error('That wallet already has an account. Sign in with it instead.'), { status: 409 });
  account.wallet = a;
  store.put('accounts', account.id, account);
  return account;
}

/* public view of an account (never the key hash) */
function publicAccount(account) {
  const { keyHash, keyHashes, ...rest } = account;
  return rest;
}

module.exports = { createAccount, findByKey, findByWallet, fromRequest, nonceFor, walletSignIn, linkWallet, publicAccount, newId };
