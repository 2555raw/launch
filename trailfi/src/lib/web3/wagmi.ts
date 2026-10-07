"use client";

import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  phantomWallet,
  rabbyWallet,
  rainbowWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http, type Config } from "wagmi";
import type { Chain } from "viem";
import { arbitrum, base, mainnet, optimism, polygon } from "viem/chains";
import { getPayoutChain } from "./chains";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";
export const walletConnectEnabled = projectId.length > 0;

export function makeWagmiConfig(): Config {
  // WalletConnect-based wallets (mobile QR, Rainbow…) need a Reown/WalletConnect project id.
  // Without one, the app still works with browser-extension wallets.
  const connectors = connectorsForWallets(
    walletConnectEnabled
      ? [
          { groupName: "Popular", wallets: [phantomWallet, metaMaskWallet, coinbaseWallet, rabbyWallet] },
          { groupName: "More", wallets: [walletConnectWallet, rainbowWallet, injectedWallet] },
        ]
      : [{ groupName: "Browser wallets", wallets: [phantomWallet, metaMaskWallet, coinbaseWallet, rabbyWallet, injectedWallet] }],
    { appName: "Strydo", projectId: projectId || "trailfi-local-no-walletconnect" },
  );

  // Walkers only sign a message, so any common network is fine for connecting. Robinhood Chain
  // comes first: wallets are asked to switch to it, and payouts are always sent there.
  const payout = getPayoutChain();
  const others = [mainnet, base, arbitrum, optimism, polygon].filter((c) => c.id !== payout.id);
  const chains: [Chain, ...Chain[]] = [payout, ...others];
  return createConfig({
    chains,
    connectors,
    transports: Object.fromEntries(chains.map((c) => [c.id, http()])),
    ssr: true,
  });
}
