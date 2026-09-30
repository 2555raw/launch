"use client";

import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  rabbyWallet,
  rainbowWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http, type Config } from "wagmi";
import type { Chain } from "viem";
import { PAYOUT_CHAIN_ID, SUPPORTED_CHAINS } from "./chains";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";
export const walletConnectEnabled = projectId.length > 0;

function chainList(): [Chain, ...Chain[]] {
  const payout = SUPPORTED_CHAINS[PAYOUT_CHAIN_ID];
  const rest = Object.values(SUPPORTED_CHAINS).filter((c) => c.id !== PAYOUT_CHAIN_ID);
  return [payout, ...rest];
}

export function makeWagmiConfig(): Config {
  // WalletConnect-based wallets (mobile QR, Rainbow…) need a Reown/WalletConnect project id.
  // Without one, the app still works with browser-extension wallets.
  const connectors = connectorsForWallets(
    walletConnectEnabled
      ? [
          { groupName: "Popular", wallets: [metaMaskWallet, walletConnectWallet, coinbaseWallet, rainbowWallet] },
          { groupName: "More", wallets: [rabbyWallet, injectedWallet] },
        ]
      : [{ groupName: "Browser wallets", wallets: [metaMaskWallet, rabbyWallet, coinbaseWallet, injectedWallet] }],
    { appName: "TrailFi", projectId: projectId || "trailfi-local-no-walletconnect" },
  );

  const chains = chainList();
  return createConfig({
    chains,
    connectors,
    transports: Object.fromEntries(chains.map((c) => [c.id, http()])),
    ssr: true,
  });
}
