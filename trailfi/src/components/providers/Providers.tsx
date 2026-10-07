"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, darkTheme, type DisclaimerComponent } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Toaster, toast } from "sonner";
import { createSiweMessage } from "viem/siwe";
import { WagmiProvider, useAccount, useSignMessage } from "wagmi";
import { SIWE_STATEMENT } from "@/lib/auth/constants";
import { makeWagmiConfig } from "@/lib/web3/wagmi";
import { PAYOUT_CHAIN_ID, SUPPORTED_CHAINS } from "@/lib/web3/chains";
import { Notices } from "./Notices";
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

interface SignInState {
  /** Asks the wallet for the one free sign-in signature and opens a session. */
  signIn: () => Promise<void>;
  signing: boolean;
}
const SignInContext = createContext<SignInState>({ signIn: async () => {}, signing: false });
export const useSignIn = () => useContext(SignInContext);

/**
 * Sign-In With Ethereum without an extra step: as soon as a wallet connects, the signature
 * request opens in the wallet. The session then lasts 30 days, so it is a one time thing per device.
 */
function AuthBridge({ children }: { children: ReactNode }) {
  const session = useSession();
  const { address, chainId, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [signing, setSigning] = useState(false);
  const busy = useRef(false);

  const signIn = useCallback(async () => {
    if (!address || busy.current) return;
    busy.current = true;
    setSigning(true);
    try {
      const nonceRes = await fetch("/api/auth/nonce", { cache: "no-store" });
      if (!nonceRes.ok) throw new Error("Could not start login");
      const { nonce } = (await nonceRes.json()) as { nonce: string };
      const message = createSiweMessage({
        domain: window.location.host,
        address,
        statement: SIWE_STATEMENT,
        uri: window.location.origin,
        version: "1",
        chainId: chainId && SUPPORTED_CHAINS[chainId] ? chainId : PAYOUT_CHAIN_ID,
        nonce,
        issuedAt: new Date(),
        expirationTime: new Date(Date.now() + 10 * 60_000),
      });
      const signature = await signMessageAsync({ message });
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, signature }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Wallet verification failed");
        return;
      }
      await session.refresh();
      toast.success("Wallet connected", { description: "Your public address is verified and registered." });
    } catch (e) {
      const rejected = /reject|denied|cancel/i.test(String((e as Error)?.message ?? e));
      toast.error(rejected ? "Signature cancelled" : "Wallet verification failed", {
        description: rejected ? "Sign the free message to finish connecting. It moves no money." : undefined,
      });
    } finally {
      busy.current = false;
      setSigning(false);
    }
  }, [address, chainId, signMessageAsync, session]);

  // Open the signature request right after the wallet connects (once per address per visit).
  const autoTried = useRef<string | null>(null);
  useEffect(() => {
    if (!isConnected || !address || session.status !== "unauthenticated") return;
    if (autoTried.current === address.toLowerCase()) return;
    autoTried.current = address.toLowerCase();
    void signIn();
  }, [isConnected, address, session.status, signIn]);

  const value = useMemo(() => ({ signIn, signing }), [signIn, signing]);
  return (
    <SignInContext.Provider value={value}>
      <RainbowKitProvider
        theme={theme}
        modalSize="compact"
        locale="en-US"
        initialChain={PAYOUT_CHAIN_ID}
        appInfo={{ appName: "Stepit", disclaimer: Disclaimer, learnMoreUrl: "/docs" }}
      >
        {children}
        <Notices />
      </RainbowKitProvider>
    </SignInContext.Provider>
  );
}

/** Keeps the invite code from a ?ref= link for 30 days, so the first sign-in can credit the referrer. */
function useReferralCapture() {
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("ref")?.trim().toUpperCase();
    if (!code || !/^[A-Z2-9]{7}$/.test(code) || document.cookie.includes("stepit_ref=")) return;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `stepit_ref=${code}; Max-Age=${60 * 60 * 24 * 30}; Path=/; SameSite=Lax${secure}`;
  }, []);
}

export function Providers({ children }: { children: ReactNode }) {
  useReferralCapture();
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
