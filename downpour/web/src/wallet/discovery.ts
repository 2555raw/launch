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
  // many wallets also call themselves MetaMask, so it is checked last
  const name = eth.isPhantom ? 'Phantom' : eth.isCoinbaseWallet ? 'Coinbase Wallet' : eth.isRabby ? 'Rabby' : eth.isMetaMask ? 'MetaMask' : 'Browser wallet';
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

/** The wallets the connect dialog always offers first: connected straight away when
 *  installed, otherwise opened in their app (phones) or installed (computers). */
export const FEATURED = [
  {
    name: 'MetaMask',
    rdns: ['io.metamask', 'io.metamask.flask'],
    icon: 'wallets/metamask.svg',
    install: 'https://metamask.io/download/',
    // opens this page inside the app's browser
    open: (url: string) => `https://metamask.app.link/dapp/${url.replace(/^https?:\/\//, '')}`,
  },
  {
    name: 'Coinbase Wallet',
    rdns: ['com.coinbase.wallet'],
    icon: 'wallets/coinbase.svg',
    install: 'https://www.coinbase.com/wallet/downloads',
    open: (url: string) => `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}`,
  },
  {
    name: 'Phantom',
    rdns: ['app.phantom'],
    icon: 'wallets/phantom.svg',
    install: 'https://phantom.com/download',
    open: (url: string) => `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(new URL(url).origin)}`,
  },
];

export type Featured = (typeof FEATURED)[number];

/** The installed wallet behind a featured one, found by its EIP-6963 id or, for older
 *  wallets that only inject window.ethereum, by the name they go by. */
export function installedAs(f: Featured, wallets: DiscoveredWallet[]): DiscoveredWallet | undefined {
  return wallets.find((w) => f.rdns.includes(w.info.rdns)) ?? wallets.find((w) => w.info.rdns === 'injected.legacy' && w.info.name === f.name);
}
