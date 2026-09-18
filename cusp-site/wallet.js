/* The demo wallet, shared by every page.
   Play money kept in this browser: a random address, a USDG balance and a few
   token balances. Nothing is signed, no chain is touched, and no address here
   belongs to anyone. It exists so the pages can be used rather than looked at. */

const WALLET_KEY = 'cusp-demo';
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

function walletConnect() {
  wallet = { addr: newAddress(), usdg: SEED_USDG, bal: { ...SEED_BAL }, pos: {} };
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
