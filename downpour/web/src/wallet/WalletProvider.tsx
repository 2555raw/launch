import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createWalletClient, custom, getAddress, numberToHex, type WalletClient } from 'viem';
import { chainMeta, viemChain } from '../config/chains';
import { onWallets, startDiscovery, walletByRdns } from './discovery';
import type { DiscoveredWallet, Eip1193Provider } from './types';

/* One place that knows who is connected and with what: any EIP-1193 wallet. It
 * signs live transactions and, in the playground, just lends its address. */

const LAST_WALLET = 'starmint:last-wallet';

type Status = 'disconnected' | 'connecting' | 'connected';

interface WalletState {
  status: Status;
  address?: `0x${string}`;
  chainId?: number;
  walletName?: string;
  walletIcon?: string;
  wallets: DiscoveredWallet[];
  error?: string;
  modalOpen: boolean;
  openModal(): void;
  closeModal(): void;
  connect(w: DiscoveredWallet): Promise<void>;
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

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallets, setWallets] = useState<DiscoveredWallet[]>([]);
  const [status, setStatus] = useState<Status>('disconnected');
  const [address, setAddress] = useState<`0x${string}`>();
  const [chainId, setChainId] = useState<number>();
  const [active, setActive] = useState<DiscoveredWallet | null>(null);
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

  const disconnect = useCallback(() => {
    detach.current();
    setActive(null);
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
  }, [wallets, attach]);

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
      walletName: active?.info.name,
      walletIcon: active?.info.icon,
      wallets,
      error,
      modalOpen,
      openModal: () => {
        setError(undefined);
        setModalOpen(true);
      },
      closeModal: () => setModalOpen(false),
      connect,
      disconnect,
      switchChain,
      walletClient,
    }),
    [status, address, chainId, active, wallets, error, modalOpen, connect, disconnect, switchChain, walletClient],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useWallet outside WalletProvider');
  return v;
}
