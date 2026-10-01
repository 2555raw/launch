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
    { appName: "Stepit", projectId: projectId || "trailfi-local-no-walletconnect" },
  );

  // Every wallet connects on the one network Stepit runs on (Robinhood Chain by default).
  const chain = getPayoutChain();
  return createConfig({
    chains: [chain],
    connectors,
    transports: { [chain.id]: http() },
    ssr: true,
  });
}
