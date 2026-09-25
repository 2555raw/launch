/* Accounts, no email required. Three doors in:
 *   username  — a username and a password (scrypt-hashed); the only door
 *               where you create the account first
 *   wallet    — sign a one-time message; the address is the account
 *   email     — a six-digit code sent to the address; first use creates it
 * Every sign-in hands the browser an access key (seek_…), sent as
 * `Authorization: Bearer seek_…`. An account can hold several keys (one per
 * device); only their hashes are stored. */
const crypto = require('crypto');
const { verifyMessage, isAddress, getAddress } = require('ethers');
const store = require('./store');
const config = require('./config');

const KEY_PREFIX = 'seek_';
const USERNAME_RE = /^[a-z0-9_]{3,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CODE_TTL = 10 * 60 * 1000;
const err = (status, message) => Object.assign(new Error(message), { status });

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
  return `wondr wants you to sign in with your wallet.\n\nAddress: ${address}\nNonce: ${nonce}\n\nThis signature costs nothing and does not send a transaction.`;
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
  if (existing) return { account: existing, key: issueKey(existing), created: false };
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
  const { keyHash, keyHashes, password, ...rest } = account;
  return rest;
}

/* a fresh key for this device; older keys keep working */
function issueKey(account) {
  const key = KEY_PREFIX + crypto.randomBytes(24).toString('base64url');
  account.keyHashes = [...(account.keyHashes || []), account.keyHash].filter(Boolean).slice(-20);
  account.keyHash = hashKey(key);
  store.put('accounts', account.id, account);
  return key;
}

/* ---------- username + password ---------- */
const scrypt = (pw, salt) => new Promise((res, rej) => crypto.scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? rej(e) : res(k))));
async function hashPassword(pw) { const salt = crypto.randomBytes(16); return { salt: salt.toString('base64'), hash: (await scrypt(pw, salt)).toString('base64') }; }
async function checkPassword(pw, rec) {
  if (!rec) { await scrypt(pw, crypto.randomBytes(16)); return false; } // same work either way
  const k = await scrypt(pw, Buffer.from(rec.salt, 'base64'));
  const want = Buffer.from(rec.hash, 'base64');
  return k.length === want.length && crypto.timingSafeEqual(k, want);
}
const normUser = (u) => String(u || '').trim().toLowerCase();
const findByUsername = (u) => store.find('accounts', (a) => a.username === normUser(u))[0] || null;

/* ten tries per username per quarter hour, and forty per address */
const tries = new Map();
function throttle(key, max) {
  const now = Date.now(), win = 15 * 60 * 1000;
  const t = (tries.get(key) || []).filter((x) => now - x < win);
  if (t.length >= max) throw err(429, 'Too many attempts. Wait a few minutes and try again.');
  t.push(now); tries.set(key, t);
}

async function registerUsername(username, pw) {
  const u = normUser(username);
  if (!USERNAME_RE.test(u)) throw err(400, 'Usernames are 3 to 32 letters, numbers or underscores.');
  if (String(pw || '').length < 8) throw err(400, 'Passwords need at least 8 characters.');
  if (String(pw).length > 200) throw err(400, 'That password is too long.');
  if (findByUsername(u)) throw err(409, 'That username is taken. Log in, or pick another.');
  const { account, key } = createAccount({ username: u, password: await hashPassword(String(pw)) });
  return { account, key };
}

async function loginUsername(username, pw, ip) {
  const u = normUser(username);
  throttle('u:' + u, 10); throttle('ip:' + ip, 40);
  const a = findByUsername(u);
  const ok = await checkPassword(String(pw || ''), a && a.password);
  if (!a || !ok) throw err(401, 'Wrong username or password.');
  return { account: a, key: issueKey(a) };
}

async function changePassword(account, current, next) {
  if (account.password && !(await checkPassword(String(current || ''), account.password))) throw err(401, 'Your current password is not right.');
  if (String(next || '').length < 8) throw err(400, 'Passwords need at least 8 characters.');
  account.password = await hashPassword(String(next));
  store.put('accounts', account.id, account);
}

async function setUsername(account, username, pw) {
  const u = normUser(username);
  if (!USERNAME_RE.test(u)) throw err(400, 'Usernames are 3 to 32 letters, numbers or underscores.');
  const other = findByUsername(u);
  if (other && other.id !== account.id) throw err(409, 'That username is taken.');
  if (!account.password && String(pw || '').length < 8) throw err(400, 'Pick a password of at least 8 characters to go with it.');
  account.username = u;
  if (!account.password) account.password = await hashPassword(String(pw));
  store.put('accounts', account.id, account);
}

/* ---------- email codes ---------- */
const normEmail = (e) => String(e || '').trim().toLowerCase();
const findByEmail = (e) => store.find('accounts', (a) => a.email === normEmail(e))[0] || null;

function newCode(email, purpose, accountId, ip) {
  const e = normEmail(email);
  if (!EMAIL_RE.test(e) || e.length > 200) throw err(400, 'That does not look like an email address.');
  throttle('e:' + e, 5); throttle('eip:' + ip, 20);
  const code = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
  store.put('codes', purpose + ':' + e, { hash: hashKey(code + ':' + e), at: Date.now(), tries: 0, accountId: accountId || null });
  return { email: e, code };
}

function useCode(email, code, purpose) {
  const e = normEmail(email), id = purpose + ':' + e;
  const rec = store.get('codes', id);
  if (!rec || Date.now() - rec.at > CODE_TTL) throw err(400, 'That code has expired. Ask for a new one.');
  if (rec.tries >= 5) { store.del('codes', id); throw err(429, 'Too many wrong codes. Ask for a new one.'); }
  const want = Buffer.from(rec.hash, 'hex'), got = Buffer.from(hashKey(String(code || '').trim() + ':' + e), 'hex');
  if (!crypto.timingSafeEqual(want, got)) { rec.tries++; store.put('codes', id, rec); throw err(401, 'That code is not right.'); }
  store.del('codes', id);
  return { email: e, accountId: rec.accountId };
}

function emailSignIn(email, code) {
  const { email: e } = useCode(email, code, 'login');
  const existing = findByEmail(e);
  if (existing) return { account: existing, key: issueKey(existing), created: false };
  const made = createAccount({ email: e, emailVerifiedAt: new Date().toISOString() });
  return { ...made, created: true };
}

function linkEmail(account, email, code) {
  const { email: e, accountId } = useCode(email, code, 'link');
  if (accountId !== account.id) throw err(400, 'That code was for another account.');
  const other = findByEmail(e);
  if (other && other.id !== account.id) throw err(409, 'That email already has an account.');
  account.email = e; account.emailVerifiedAt = new Date().toISOString();
  store.put('accounts', account.id, account);
  return account;
}

module.exports = { createAccount, findByKey, findByWallet, fromRequest, nonceFor, walletSignIn, linkWallet, publicAccount, newId, issueKey, registerUsername, loginUsername, changePassword, setUsername, newCode, emailSignIn, linkEmail };
