'use client';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { defineChain } from 'viem';
import { ROBINHOOD_CHAIN_NETWORKS } from '@launch/config/chains';
import { ROBINHOOD_CHAIN_NETWORK, ROBINHOOD_CHAIN_RPC_URL, SOLANA_RPC_URL } from '@/lib/config';
import { useAuth } from '@/lib/auth-store';
import { ToastHost } from '@/components/ui/toast';
import '@solana/wallet-adapter-react-ui/styles.css';

function chainFor<N extends 'mainnet' | 'testnet'>(network: N) {
  const rh = ROBINHOOD_CHAIN_NETWORKS[network];
  return defineChain({
    id: rh.chainId as (typeof ROBINHOOD_CHAIN_NETWORKS)[N]['chainId'],
    name: rh.name,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [network === ROBINHOOD_CHAIN_NETWORK ? ROBINHOOD_CHAIN_RPC_URL : rh.rpc] } },
    blockExplorers: { default: { name: 'Explorer', url: rh.explorer } },
    testnet: network === 'testnet',
  });
}

export const robinhoodMainnet = chainFor('mainnet');
export const robinhoodTestnet = chainFor('testnet');
/** The network this deployment targets (NEXT_PUBLIC_ROBINHOOD_CHAIN_NETWORK). */
export const robinhoodChain = ROBINHOOD_CHAIN_NETWORK === 'mainnet' ? robinhoodMainnet : robinhoodTestnet;

export const wagmiConfig = createConfig({
  chains: [robinhoodMainnet, robinhoodTestnet],
  connectors: [injected()],
  transports: { 4663: http(robinhoodMainnet.rpcUrls.default.http[0]), 46630: http(robinhoodTestnet.rpcUrls.default.http[0]) },
  ssr: true,
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 10_000 } } }));
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);
  const bootstrap = useAuth((s) => s.bootstrap);
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <ConnectionProvider endpoint={SOLANA_RPC_URL}>
          <WalletProvider wallets={wallets} autoConnect>
            <WalletModalProvider>
              {children}
              <ToastHost />
            </WalletModalProvider>
          </WalletProvider>
        </ConnectionProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}
