/* The wallet, shared by every page.

   Two halves, and the line between them matters.

   The REAL half: if the browser has an injected EIP-1193 wallet, connecting
   asks it for an account and reads, from the chain, the address, the network
   and the native balance. Those three figures are true.

   The PLAY half: everything else. USDG, the vault shares, the stock tokens —
   none of those contracts exist on any chain, so their balances are invented
   and kept in this browser. Depositing, redeeming and swapping move those
   invented numbers and nothing else.

   What this file never does, in either half: request a signature, request a
   transaction, or ask for a private key. There is no eth_sendTransaction and
   no personal_sign anywhere in this site, and there is nothing deployed for
   one to be sent to. */

const WALLET_KEY = 'vesica-demo';
const SEED_USDG = 25000;
const SEED_BAL = { ETH: 2.5, WBTC: 0.05, xNVDA: 0, xTSLA: 0 };

let wallet = null;   // { addr, usdg, bal: { ETH: … }, pos: { NVDA: shares } }

function newAddress() {
  const hex = '0123456789abcdef';
  let a = '0x';
  for (let i = 0; i < 40; i++) a += hex[Math.floor(Math.random() * 16)];
  return a;
}

const shortAddr = a => a.slice(0, 6) + '…' + a.slice(-4);

function walletLoad() {
  try {
    const raw = localStorage.getItem(WALLET_KEY);
    if (!raw) return null;
    const w = JSON.parse(raw);
    if (!w || typeof w.addr !== 'string') return null;
    // spread first: a page that does not know a field must not drop it
    wallet = { ...w, usdg: Number(w.usdg) || 0, bal: { ...SEED_BAL, ...(w.bal || {}) }, pos: w.pos || {} };
    return wallet;
  } catch (_) { return null; }
}

function walletSave() {
  try { localStorage.setItem(WALLET_KEY, JSON.stringify(wallet)); } catch (_) {}
}

const CHAINS = {
  '0x1': 'Ethereum', '0xa': 'Optimism', '0x38': 'BNB Chain', '0x89': 'Polygon',
  '0xa4b1': 'Arbitrum One', '0x2105': 'Base', '0xaa36a7': 'Sepolia',
};

const hasInjectedWallet = () =>
  typeof window !== 'undefined' && !!window.ethereum && typeof window.ethereum.request === 'function';

/* Read-only, all three of these: eth_requestAccounts asks permission, the
   other two ask questions. None of them moves anything. */
async function readChain() {
  const [addr] = await window.ethereum.request({ method: 'eth_requestAccounts' });
  if (!addr) throw new Error('no account');
  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  let native = 0;
  try {
    const wei = await window.ethereum.request({ method: 'eth_getBalance', params: [addr, 'latest'] });
    native = Number(BigInt(wei)) / 1e18;
  } catch (_) { /* some wallets refuse this; the address and chain still stand */ }
  return { addr, chainId, chain: CHAINS[chainId] || ('chain ' + parseInt(chainId, 16)), native };
}

/* Resolves to the wallet either way. `real` says whether the address on it is
   a real one, which is the only thing the pages should branch on. */
async function walletConnect() {
  let real = null;
  if (hasInjectedWallet()) {
    try { real = await readChain(); }
    catch (_) { real = null; }          // declined, locked, or no account: fall back
  }
  wallet = real
    ? { addr: real.addr, real: true, chainId: real.chainId, chain: real.chain,
        native: real.native, usdg: SEED_USDG, bal: { ...SEED_BAL }, pos: {} }
    : { addr: newAddress(), real: false, usdg: SEED_USDG, bal: { ...SEED_BAL }, pos: {} };
  walletSave();
  return wallet;
}

function walletForget() {
  wallet = null;
  try { localStorage.removeItem(WALLET_KEY); } catch (_) {}
}

function balanceOf(sym) {
  if (!wallet) return 0;
  return sym === 'USDG' ? wallet.usdg : (wallet.bal[sym] || 0);
}

function setBalance(sym, n) {
  if (!wallet) return;
  if (sym === 'USDG') wallet.usdg = n; else wallet.bal[sym] = n;
}
