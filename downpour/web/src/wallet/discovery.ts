/* EIP-6963 wallet discovery: every installed extension (MetaMask, Rabby, Coinbase,
 * Phantom, OKX, Brave, Trust...) announces itself, so the modal can list them all
 * instead of fighting over window.ethereum. Older wallets that only inject
 * window.ethereum still show up, as "Browser wallet". */
import type { DiscoveredWallet, Eip1193Provider } from './types';

type Listener = (wallets: DiscoveredWallet[]) => void;

const found = new Map<string, DiscoveredWallet>();
const listeners = new Set<Listener>();
let started = false;

function emit() {
  const list = [...found.values()];
  listeners.forEach((l) => l(list));
}

function legacy() {
  const eth = typeof window !== 'undefined' ? (window.ethereum as (Eip1193Provider & Record<string, unknown>) | undefined) : undefined;
  if (!eth || found.size) return;
  const name = eth.isMetaMask ? 'MetaMask' : eth.isCoinbaseWallet ? 'Coinbase Wallet' : eth.isRabby ? 'Rabby' : 'Browser wallet';
  found.set('legacy', {
    info: { uuid: 'legacy', name, icon: '', rdns: 'injected.legacy' },
    provider: eth,
  });
  emit();
}

export function startDiscovery() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('eip6963:announceProvider', (event: Event) => {
    const detail = (event as CustomEvent<DiscoveredWallet>).detail;
    if (!detail?.info?.uuid || !detail.provider) return;
    found.delete('legacy');
    found.set(detail.info.uuid, detail);
    emit();
  });
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  // Give 6963 wallets a moment before falling back to window.ethereum.
  setTimeout(legacy, 350);
}

export function onWallets(l: Listener) {
  listeners.add(l);
  l([...found.values()]);
  return () => {
    listeners.delete(l);
  };
}

export function walletByRdns(rdns: string): DiscoveredWallet | undefined {
  return [...found.values()].find((w) => w.info.rdns === rdns);
}

export function isMobile() {
  return typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** Opens this page inside a wallet app's browser, for phones without an extension. */
export function mobileDeepLinks(): Array<{ name: string; href: string }> {
  const url = typeof location !== 'undefined' ? location.href : '';
  const bare = url.replace(/^https?:\/\//, '');
  const enc = encodeURIComponent(url);
  return [
    { name: 'MetaMask', href: `https://metamask.app.link/dapp/${bare}` },
    { name: 'Coinbase Wallet', href: `https://go.cb-w.com/dapp?cb_url=${enc}` },
    { name: 'Trust Wallet', href: `https://link.trustwallet.com/open_url?coin_id=60&url=${enc}` },
    { name: 'Phantom', href: `https://phantom.app/ul/browse/${enc}?ref=${enc}` },
  ];
}
