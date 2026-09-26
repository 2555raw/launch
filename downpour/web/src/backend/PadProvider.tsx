import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DEPLOYMENTS, DEFAULT_CHAIN_ID, LIVE_CHAIN_IDS } from '../config/chains';
import { DEFAULT_MODE, type Mode } from '../config/site';
import { makeBook, type Book } from '../lib/route';
import { toUsd } from '../lib/math';
import { agreedRates } from '../lib/fx';
import { useWallet } from '../wallet/WalletProvider';
import { LiveBackend, explainError } from './live';
import { PlaygroundBackend } from './playground';
import type { Address, Backend, Coin, Currency, Snapshot, TxOptions, TxResult, TxStage } from './types';

/* The pad as the pages see it: one snapshot of every currency, coin and fill,
 * the connected account's balances, and `run` for anything that writes. Which
 * backend sits underneath (live chain or playground) is a toggle. */

const MODE_KEY = 'downpour:mode';

export interface Toast {
  id: number;
  title: string;
  stage: TxStage | 'error';
  detail?: string;
  href?: string;
}

interface PadState {
  mode: Mode;
  setMode(m: Mode): void;
  canGoLive: boolean;
  chainId?: number;
  backend: Backend;
  snap: Snapshot | null;
  error?: string;
  refresh(): Promise<void>;
  now(): number;
  book: Book | null;
  currencyByToken: Map<string, Currency>;
  coinByAddress: Map<string, Coin>;
  currencyOf(coin: Coin): Currency | undefined;
  usdValue(token: string, amount: bigint): number;
  balances: Record<string, bigint>;
  refreshBalances(): Promise<void>;
  run(title: string, fn: (account: Address, o: TxOptions) => Promise<TxResult>): Promise<TxResult | null>;
  toasts: Toast[];
  dismiss(id: number): void;
  wrongChain: boolean;
  resetPlayground(): void;
}

const Ctx = createContext<PadState | null>(null);

function initialMode(): Mode {
  try {
    const saved = localStorage.getItem(MODE_KEY) as Mode | null;
    if (saved === 'live' && DEFAULT_CHAIN_ID) return 'live';
    if (saved === 'playground') return 'playground';
  } catch {
    /* ignore */
  }
  if (DEFAULT_MODE === 'playground') return 'playground';
  if (DEFAULT_MODE === 'live' && DEFAULT_CHAIN_ID) return 'live';
  return DEFAULT_CHAIN_ID ? 'live' : 'playground';
}

export function PadProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const [mode, setModeState] = useState<Mode>(initialMode);
  const chainId = mode === 'live' ? DEFAULT_CHAIN_ID : undefined;

  const walletRef = useRef(wallet);
  walletRef.current = wallet;

  const backend = useMemo<Backend>(() => {
    if (mode === 'live' && chainId && DEPLOYMENTS[chainId]) {
      return new LiveBackend(DEPLOYMENTS[chainId], async () => {
        const w = walletRef.current;
        if (w.isGuest || !w.address) throw new Error('Connect a wallet to trade on chain. Guests can only use the playground.');
        if (w.chainId !== chainId) await w.switchChain(chainId);
        const client = w.walletClient(chainId);
        if (!client) throw new Error('Connect a wallet first.');
        return client;
      });
    }
    return new PlaygroundBackend();
  }, [mode, chainId]);

  useEffect(() => () => (backend as PlaygroundBackend).dispose?.(), [backend]);

  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string>();
  const loading = useRef(false);

  const refresh = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      const s = await backend.load();
      setSnap(s);
      setError(undefined);
    } catch (e) {
      setError(explainError(e));
    } finally {
      loading.current = false;
    }
  }, [backend]);

  useEffect(() => {
    setSnap(null);
    refresh();
    if (backend.subscribe) {
      let pending: number | undefined;
      const off = backend.subscribe(() => {
        if (pending) return;
        pending = window.setTimeout(() => {
          pending = undefined;
          refresh();
        }, 400);
      });
      return () => {
        off();
        clearTimeout(pending);
      };
    }
    const t = window.setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [backend, refresh]);

  // Playground: start from today's rates if two public feeds agree (quietly skipped offline).
  useEffect(() => {
    if (backend.kind !== 'playground') return;
    let off = false;
    agreedRates().then((r) => {
      if (!off && r) (backend as PlaygroundBackend).applyAgreedRates(r.rates);
    });
    return () => {
      off = true;
    };
  }, [backend]);

  const currencyByToken = useMemo(() => new Map((snap?.currencies ?? []).map((c) => [c.token.toLowerCase(), c])), [snap]);
  const coinByAddress = useMemo(() => new Map((snap?.coins ?? []).map((c) => [c.address.toLowerCase(), c])), [snap]);
  const now = useCallback(() => Date.now() / 1000 + (snap?.clockSkew ?? 0), [snap]);
  const book = useMemo(() => (snap ? makeBook(snap.currencies, snap.coins, snap.params, Date.now() / 1000 + snap.clockSkew) : null), [snap]);

  const currencyOf = useCallback((coin: Coin) => currencyByToken.get(coin.currency.toLowerCase()), [currencyByToken]);

  /** USD value of an amount of a currency or a coin (coins at their current price). */
  const usdValue = useCallback(
    (token: string, amount: bigint) => {
      const c = currencyByToken.get(token.toLowerCase());
      if (c) return Number(toUsd(c, amount)) / 1e18;
      const coin = coinByAddress.get(token.toLowerCase());
      if (!coin) return 0;
      const cur = currencyByToken.get(coin.currency.toLowerCase());
      if (!cur || coin.reserveToken === 0n) return 0;
      const quote = (amount * coin.reserveQuote) / coin.reserveToken;
      return Number(toUsd(cur, quote)) / 1e18;
    },
    [currencyByToken, coinByAddress],
  );

  // Balances of every currency and coin for whoever is connected.
  const [balances, setBalances] = useState<Record<string, bigint>>({});
  const account = wallet.address;
  const usable = account && (mode === 'playground' || !wallet.isGuest);
  const refreshBalances = useCallback(async () => {
    if (!usable || !snap || !account) {
      setBalances({});
      return;
    }
    const tokens = [...snap.currencies.map((c) => c.token), ...snap.coins.map((c) => c.address)];
    try {
      setBalances(await backend.balances(account, tokens));
    } catch {
      /* keep the last balances; the next refresh will try again */
    }
  }, [usable, snap, account, backend]);
  useEffect(() => {
    refreshBalances();
  }, [refreshBalances]);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(1);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const run = useCallback(
    async (title: string, fn: (account: Address, o: TxOptions) => Promise<TxResult>) => {
      const w = walletRef.current;
      if (!w.address) {
        w.openModal();
        return null;
      }
      if (mode === 'live' && w.isGuest) {
        w.openModal();
        return null;
      }
      const id = toastId.current++;
      const update = (patch: Partial<Toast>) => setToasts((all) => all.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      setToasts((all) => [...all.slice(-3), { id, title, stage: 'sign' }]);
      try {
        const result = await fn(w.address, {
          onStage: (stage, detail) => update({ stage, detail }),
        });
        update({ stage: 'done', detail: result.hash });
        setTimeout(() => dismiss(id), 5000);
        await refresh();
        await refreshBalances();
        return result;
      } catch (e) {
        update({ stage: 'error', detail: explainError(e) });
        setTimeout(() => dismiss(id), 9000);
        return null;
      }
    },
    [mode, refresh, refreshBalances, dismiss],
  );

  const setMode = useCallback((m: Mode) => {
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* ignore */
    }
    setModeState(m);
  }, []);

  const resetPlayground = useCallback(() => {
    if (backend.kind === 'playground') (backend as PlaygroundBackend).reset();
  }, [backend]);

  const wrongChain = mode === 'live' && !!wallet.address && !wallet.isGuest && wallet.chainId !== chainId;

  const value: PadState = {
    mode,
    setMode,
    canGoLive: LIVE_CHAIN_IDS.length > 0,
    chainId,
    backend,
    snap,
    error,
    refresh,
    now,
    book,
    currencyByToken,
    coinByAddress,
    currencyOf,
    usdValue,
    balances,
    refreshBalances,
    run,
    toasts,
    dismiss,
    wrongChain,
    resetPlayground,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePad() {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePad outside PadProvider');
  return v;
}
