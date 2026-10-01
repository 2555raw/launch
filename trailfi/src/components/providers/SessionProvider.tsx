"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useSwitchChain } from "wagmi";
import { PAYOUT_CHAIN_ID } from "@/lib/web3/chains";

export interface SessionUser {
  id: string;
  walletAddress: `0x${string}`;
  role: "user" | "admin";
  status: "active" | "suspended";
}

interface SessionState {
  user: SessionUser | null;
  status: "loading" | "authenticated" | "unauthenticated";
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { address, chainId, status: accountStatus } = useAccount();
  const { switchChain } = useSwitchChain();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["session"],
    queryFn: async (): Promise<SessionUser | null> => {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      if (!res.ok) return null;
      return (await res.json()).user ?? null;
    },
    staleTime: 60_000,
  });

  const signOut = useCallback(async () => {
    await fetch("/api/auth/session", { method: "DELETE" });
    qc.setQueryData(["session"], null);
    qc.removeQueries({ queryKey: ["me"] });
    qc.removeQueries({ queryKey: ["admin"] });
  }, [qc]);

  // Switching accounts in the wallet ends the session of the previous address.
  const mismatch = Boolean(data && address && data.walletAddress.toLowerCase() !== address.toLowerCase());
  useEffect(() => {
    if (mismatch) void signOut();
  }, [mismatch, signOut]);

  // Once signed in, ask the wallet one time per visit to move to Robinhood Chain (adding it if
  // needed). Wallets that can't, like Phantom, simply stay where they are: signing in works anywhere.
  const askedChain = useRef(false);
  useEffect(() => {
    if (!data || mismatch || accountStatus !== "connected" || !chainId || chainId === PAYOUT_CHAIN_ID || askedChain.current) return;
    askedChain.current = true;
    try {
      if (sessionStorage.getItem("stepit:chain-asked")) return;
      sessionStorage.setItem("stepit:chain-asked", "1");
    } catch {
      /* storage unavailable: ask anyway */
    }
    switchChain({ chainId: PAYOUT_CHAIN_ID }, { onError: () => undefined });
  }, [data, mismatch, accountStatus, chainId, switchChain]);

  const value = useMemo<SessionState>(() => {
    const connected = accountStatus === "connected";
    const status =
      isLoading || accountStatus === "reconnecting" || accountStatus === "connecting"
        ? "loading"
        : data && connected && !mismatch
          ? "authenticated"
          : "unauthenticated";
    return {
      user: status === "authenticated" ? data ?? null : null,
      status,
      refresh: async () => {
        await refetch();
      },
      signOut,
    };
  }, [accountStatus, data, isLoading, mismatch, refetch, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
