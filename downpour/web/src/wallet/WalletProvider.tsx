import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createWalletClient, custom, getAddress, numberToHex, type WalletClient } from 'viem';
import { chainMeta, viemChain } from '../config/chains';
import { onWallets, startDiscovery, walletByRdns } from './discovery';
import type { DiscoveredWallet, Eip1193Provider } from './types';

/* One place that knows who is connected and with what.
 *
 * Two kinds of session:
 *  - a real wallet (any EIP-1193 provider): signs live transactions and, in the
 *    playground, just lends its address;
 *  - a guest: a random address kept in this browser, for trying the playground
 *    without installing anything. Guests can never sign, so live mode ignores them. */

const LAST_WALLET = 'starmint:last-wallet';
const GUEST_KEY = 'starmint:guest';

type Status = 'disconnected' | 'connecting' | 'connected';

interface WalletState {
  status: Status;
  address?: `0x${string}`;
  chainId?: number;
  walletName?: string;
  walletIcon?: string;
  isGuest: boolean;
  wallets: DiscoveredWallet[];
  error?: string;
  modalOpen: boolean;
  openModal(): void;
  closeModal(): void;
  connect(w: DiscoveredWallet): Promise<void>;
  connectGuest(): void;
  disconnect(): void;
  switchChain(chainId: number): Promise<void>;
  walletClient(chainId: number): WalletClient | null;
}

const Ctx = createContext<WalletState | null>(null);

function store(key: string, value?: string) {
  try {
    if (value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* private mode: the session just won't be remembered */
  }
}
function load(key: string) {
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function randomAddress(): `0x${string}` {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return getAddress(`0x${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`);
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallets, setWallets] = useState<DiscoveredWallet[]>([]);
  const [status, setStatus] = useState<Status>('disconnected');
  const [address, setAddress] = useState<`0x${string}`>();
  const [chainId, setChainId] = useState<number>();
  const [active, setActive] = useState<DiscoveredWallet | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [error, setError] = useState<string>();
  const [modalOpen, setModalOpen] = useState(false);
  const detach = useRef<() => void>(() => {});

  useEffect(() => {
    startDiscovery();
    return onWallets(setWallets);
  }, []);

  const attach = useCallback((provider: Eip1193Provider) => {
    detach.current();
    const onAccounts = (accs: string[]) => {
      if (!accs?.length) {
        setStatus('disconnected');
        setAddress(undefined);
        setActive(null);
        store(LAST_WALLET);
      } else setAddress(getAddress(accs[0]));
    };
    const onChain = (id: string) => setChainId(Number(id));
    const onDisconnect = () => {
      setStatus('disconnected');
      setAddress(undefined);
    };
    provider.on?.('accountsChanged', onAccounts);
    provider.on?.('chainChanged', onChain);
    provider.on?.('disconnect', onDisconnect);
    detach.current = () => {
      provider.removeListener?.('accountsChanged', onAccounts);
      provider.removeListener?.('chainChanged', onChain);
      provider.removeListener?.('disconnect', onDisconnect);
    };
  }, []);

  const connect = useCallback(
    async (w: DiscoveredWallet) => {
      setError(undefined);
      setStatus('connecting');
      try {
        const accs = (await w.provider.request({ method: 'eth_requestAccounts' })) as string[];
        const id = (await w.provider.request({ method: 'eth_chainId' })) as string;
        if (!accs?.length) throw new Error('The wallet returned no account.');
        attach(w.provider);
        setActive(w);
        setIsGuest(false);
        setAddress(getAddress(accs[0]));
        setChainId(Number(id));
        setStatus('connected');
        setModalOpen(false);
        store(LAST_WALLET, w.info.rdns);
      } catch (e: any) {
        setStatus('disconnected');
        setError(e?.code === 4001 ? 'Connection request was rejected in the wallet.' : e?.message || 'Could not connect.');
      }
    },
    [attach],
  );

  const connectGuest = useCallback(() => {
    let guest = load(GUEST_KEY) as `0x${string}` | undefined;
    if (!guest) {
      guest = randomAddress();
      store(GUEST_KEY, guest);
    }
    detach.current();
    setActive(null);
    setIsGuest(true);
    setAddress(guest);
    setChainId(undefined);
    setStatus('connected');
    setModalOpen(false);
    store(LAST_WALLET, 'guest');
  }, []);

  const disconnect = useCallback(() => {
    detach.current();
    setActive(null);
    setIsGuest(false);
    setAddress(undefined);
    setStatus('disconnected');
    store(LAST_WALLET);
  }, []);

  // Quietly restore the last session (no popup: eth_accounts, not eth_requestAccounts).
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    const last = load(LAST_WALLET);
    if (!last) {
      restored.current = true;
      return;
    }
    if (last === 'guest') {
      restored.current = true;
      connectGuest();
      return;
    }
    const w = walletByRdns(last) || wallets.find((x) => x.info.rdns === last);
    if (!w) return; // wait for discovery to find it
    restored.current = true;
    (async () => {
      try {
        const accs = (await w.provider.request({ method: 'eth_accounts' })) as string[];
        if (!accs?.length) return;
        const id = (await w.provider.request({ method: 'eth_chainId' })) as string;
        attach(w.provider);
        setActive(w);
        setAddress(getAddress(accs[0]));
        setChainId(Number(id));
        setStatus('connected');
      } catch {
        /* the wallet is locked; stay disconnected */
      }
    })();
  }, [wallets, attach, connectGuest]);

  const switchChain = useCallback(
    async (target: number) => {
      if (!active) return;
      const hex = numberToHex(target);
      try {
        await active.provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
      } catch (e: any) {
        if (e?.code !== 4902 && e?.data?.originalError?.code !== 4902) throw e;
        const m = chainMeta(target);
        await active.provider.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: hex,
              chainName: m.name,
              nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
              rpcUrls: [m.rpc],
              blockExplorerUrls: m.explorer ? [m.explorer] : undefined,
            },
          ],
        });
      }
      const id = (await active.provider.request({ method: 'eth_chainId' })) as string;
      setChainId(Number(id));
    },
    [active],
  );

  const walletClient = useCallback(
    (target: number) => {
      if (!active || !address) return null;
      return createWalletClient({ account: address, chain: viemChain(target), transport: custom(active.provider) });
    },
    [active, address],
  );

  const value = useMemo<WalletState>(
    () => ({
      status,
      address,
      chainId,
      walletName: isGuest ? 'Guest' : active?.info.name,
      walletIcon: active?.info.icon,
      isGuest,
      wallets,
      error,
      modalOpen,
      openModal: () => {
        setError(undefined);
        setModalOpen(true);
      },
      closeModal: () => setModalOpen(false),
      connect,
      connectGuest,
      disconnect,
      switchChain,
      walletClient,
    }),
    [status, address, chainId, isGuest, active, wallets, error, modalOpen, connect, connectGuest, disconnect, switchChain, walletClient],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useWallet outside WalletProvider');
  return v;
}
