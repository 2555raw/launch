"use client";

import type { PublicKey, VersionedTransaction } from "@solana/web3.js";

/**
 * Injected Solana wallets (Phantom, Solflare, Backpack and anything that
 * exposes window.solana). Each one connects, then signs the transaction the
 * server prepared; the site never sees a private key.
 */
export interface SolanaProvider {
  publicKey: PublicKey | null;
  connect(): Promise<unknown>;
  signTransaction(tx: VersionedTransaction): Promise<VersionedTransaction>;
  /** Phantom's recommended path: the wallet signs and submits in one step. */
  signAndSendTransaction?(tx: VersionedTransaction): Promise<{ signature: string } | string>;
}

export interface WalletOption {
  id: "phantom" | "solflare" | "backpack" | "injected";
  name: string;
  provider: SolanaProvider;
}

type Injected = SolanaProvider & { isPhantom?: boolean; isSolflare?: boolean; isBackpack?: boolean };

export function detectWallets(): WalletOption[] {
  if (typeof window === "undefined") return [];
  const w = window as unknown as {
    phantom?: { solana?: Injected };
    solflare?: Injected;
    backpack?: Injected;
    solana?: Injected;
  };
  const out: WalletOption[] = [];
  const seen = new Set<unknown>();
  const add = (id: WalletOption["id"], name: string, p?: Injected) => {
    if (!p || seen.has(p) || typeof p.signTransaction !== "function") return;
    seen.add(p);
    out.push({ id, name, provider: p });
  };
  add("phantom", "Phantom", w.phantom?.solana?.isPhantom ? w.phantom.solana : undefined);
  add("solflare", "Solflare", w.solflare?.isSolflare ? w.solflare : undefined);
  add("backpack", "Backpack", w.backpack);
  add("injected", "Browser wallet", w.solana);
  return out;
}

export async function connectWallet(option: WalletOption): Promise<string> {
  await option.provider.connect();
  const key = option.provider.publicKey?.toBase58();
  if (!key) throw new Error(`${option.name} did not share an address.`);
  return key;
}

/** Deep link that reopens this page inside Phantom's in-app browser (for phones). */
export function phantomBrowseLink(url: string) {
  return `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(new URL(url).origin)}`;
}

/** Wallets reject with varied shapes; turn them into one readable line. */
export function walletErrorMessage(err: unknown): string {
  const e = err as { code?: number; message?: string } | undefined;
  if (e?.code === 4001 || /reject|denied|cancel/i.test(e?.message ?? "")) return "You cancelled the request in your wallet.";
  return e?.message || "The wallet could not complete the request.";
}
