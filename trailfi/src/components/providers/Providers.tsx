"use client";

import "@rainbow-me/rainbowkit/styles.css";
import {
  RainbowKitAuthenticationProvider,
  RainbowKitProvider,
  createAuthenticationAdapter,
  darkTheme,
  type DisclaimerComponent,
} from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { Toaster, toast } from "sonner";
import { createSiweMessage } from "viem/siwe";
import { WagmiProvider } from "wagmi";
import { SIWE_STATEMENT } from "@/lib/auth/constants";
import { makeWagmiConfig } from "@/lib/web3/wagmi";
import { PAYOUT_CHAIN_ID, SUPPORTED_CHAINS } from "@/lib/web3/chains";
import { SessionProvider, useSession } from "./SessionProvider";

const Disclaimer: DisclaimerComponent = ({ Text }) => (
  <Text>
    Stepit only reads your <strong>public address</strong>, which is used to identify you and to send your rewards.
    You will sign a free message to verify ownership. No transaction, no gas, no token approvals. We will never ask
    for your seed phrase or private key.
  </Text>
);

const theme = darkTheme({
  accentColor: "#c4fb6d",
  accentColorForeground: "#06140c",
  borderRadius: "large",
  overlayBlur: "small",
  fontStack: "system",
});
theme.colors.modalBackground = "#0b100d";
theme.colors.modalBorder = "rgba(255,255,255,0.08)";
theme.colors.profileForeground = "#0b100d";
theme.colors.connectButtonBackground = "#0b100d";

function AuthBridge({ children }: { children: ReactNode }) {
  const session = useSession();
  const adapter = useMemo(
    () =>
      createAuthenticationAdapter({
        getNonce: async () => {
          const res = await fetch("/api/auth/nonce", { cache: "no-store" });
          if (!res.ok) throw new Error("Could not start login");
          return (await res.json()).nonce as string;
        },
        createMessage: ({ nonce, address, chainId }) =>
          createSiweMessage({
            domain: window.location.host,
            address,
            statement: SIWE_STATEMENT,
            uri: window.location.origin,
            version: "1",
            chainId: SUPPORTED_CHAINS[chainId] ? chainId : PAYOUT_CHAIN_ID,
            nonce,
            issuedAt: new Date(),
            expirationTime: new Date(Date.now() + 10 * 60_000),
          }),
        verify: async ({ message, signature }) => {
          const res = await fetch("/api/auth/verify", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ message, signature }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            toast.error(err.error ?? "Wallet verification failed");
            return false;
          }
          await session.refresh();
          toast.success("Wallet connected", { description: "Your public address is verified and registered." });
          return true;
        },
        signOut: async () => {
          await session.signOut();
        },
      }),
    [session],
  );

  return (
    <RainbowKitAuthenticationProvider adapter={adapter} status={session.status}>
      <RainbowKitProvider
        theme={theme}
        modalSize="compact"
        initialChain={PAYOUT_CHAIN_ID}
        appInfo={{ appName: "Stepit", disclaimer: Disclaimer, learnMoreUrl: "/docs" }}
      >
        {children}
      </RainbowKitProvider>
    </RainbowKitAuthenticationProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const [config] = useState(makeWagmiConfig);
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } }),
  );
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <AuthBridge>{children}</AuthBridge>
        </SessionProvider>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: "!bg-ink-900/95 !border !border-white/10 !backdrop-blur-xl !text-white !rounded-2xl",
              description: "!text-white/60",
            },
          }}
        />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
