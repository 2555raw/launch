"use client";

/**
 * EVM wallets (MetaMask, Rabby, Coinbase Wallet, OKX, Trust, …) found through
 * EIP-6963 announcements, with window.ethereum as a fallback. The wallet signs
 * and sends the transaction the server prepared; the site never sees a key.
 */
export interface Eip1193 {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
}

export interface EvmWalletOption {
  id: string;
  name: string;
  icon?: string;
  provider: Eip1193;
}

export interface EvmChainParams {
  chainId: number;
  chainName: string;
  rpcUrls: string[];
  nativeCurrency: { name: string; symbol: string; decimals: number };
  blockExplorerUrls?: string[];
}

export function detectEvmWallets(): Promise<EvmWalletOption[]> {
  if (typeof window === "undefined") return Promise.resolve([]);
  const found = new Map<string, EvmWalletOption>();
  const onAnnounce = (e: Event) => {
    const { info, provider } = (e as CustomEvent<{ info: { uuid: string; name: string; icon?: string; rdns?: string }; provider: Eip1193 }>).detail;
    found.set(info.rdns ?? info.uuid, { id: info.rdns ?? info.uuid, name: info.name, icon: info.icon, provider });
  };
  window.addEventListener("eip6963:announceProvider", onAnnounce);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  return new Promise((resolve) => {
    setTimeout(() => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
      const injected = (window as unknown as { ethereum?: Eip1193 & { isMetaMask?: boolean } }).ethereum;
      if (!found.size && injected) found.set("injected", { id: "injected", name: injected.isMetaMask ? "MetaMask" : "Browser wallet", provider: injected });
      resolve([...found.values()]);
    }, 400);
  });
}

export async function connectEvm(w: EvmWalletOption): Promise<string> {
  const accounts = (await w.provider.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts?.[0]) throw new Error(`${w.name} did not share an address.`);
  return accounts[0];
}

/** Switch the wallet to the chain, adding it first when the wallet does not know it. */
export async function ensureChain(p: Eip1193, chain: EvmChainParams) {
  const hex = `0x${chain.chainId.toString(16)}`;
  const current = (await p.request({ method: "eth_chainId" })) as string;
  if (parseInt(current, 16) === chain.chainId) return;
  try {
    await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
  } catch (err) {
    if ((err as { code?: number }).code !== 4902) throw err;
    await p.request({ method: "wallet_addEthereumChain", params: [{ ...chain, chainId: hex }] });
  }
}

export async function sendEvmTx(p: Eip1193, from: string, tx: { to: string; data: string; value: string }): Promise<string> {
  return (await p.request({ method: "eth_sendTransaction", params: [{ from, to: tx.to, data: tx.data, value: tx.value }] })) as string;
}

export async function signEvmMessage(p: Eip1193, from: string, message: string): Promise<string> {
  return (await p.request({ method: "personal_sign", params: [message, from] })) as string;
}

export function evmMetaMaskLink(url: string) {
  return `https://metamask.app.link/dapp/${url.replace(/^https?:\/\//, "")}`;
}
