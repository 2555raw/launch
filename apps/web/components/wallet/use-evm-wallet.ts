'use client';
import { useCallback, useState } from 'react';
import { useConnect, useConnection, useConnectors, useDisconnect, useSwitchChain } from 'wagmi';
import { robinhoodChain } from '@/components/providers';
import { walletErrorMessage } from './encoding';

/** Injected (MetaMask-style) wallet connection scoped to Robinhood Chain. */
export function useEvmWallet() {
  const account = useConnection();
  const connectors = useConnectors();
  const connectMutation = useConnect();
  const switchMutation = useSwitchChain();
  const disconnectMutation = useDisconnect();
  const [error, setError] = useState<string | null>(null);

  const connector = connectors.find((c) => c.id === 'injected') ?? connectors[0];
  const onRobinhood = account.chainId === robinhoodChain.id;

  const connect = useCallback(async () => {
    setError(null);
    if (!connector) {
      setError('No injected wallet found. Install MetaMask, Rabby or another EVM wallet.');
      return;
    }
    try {
      await connectMutation.mutateAsync({ connector, chainId: robinhoodChain.id });
    } catch (e) {
      setError(walletErrorMessage(e));
    }
  }, [connector, connectMutation]);

  const switchToRobinhood = useCallback(async () => {
    setError(null);
    try {
      await switchMutation.mutateAsync({
        chainId: robinhoodChain.id,
        addEthereumChainParameter: { chainName: robinhoodChain.name, nativeCurrency: robinhoodChain.nativeCurrency, rpcUrls: [...robinhoodChain.rpcUrls.default.http], blockExplorerUrls: robinhoodChain.blockExplorers ? [robinhoodChain.blockExplorers.default.url] : undefined },
      });
    } catch (e) {
      setError(walletErrorMessage(e));
    }
  }, [switchMutation]);

  const disconnect = useCallback(async () => {
    try {
      await disconnectMutation.mutateAsync({});
    } catch {
      /* ignore */
    }
  }, [disconnectMutation]);

  return {
    address: account.address ?? null,
    isConnected: account.isConnected,
    chainId: account.chainId,
    onRobinhood,
    hasInjected: !!connector,
    connecting: connectMutation.isPending,
    switching: switchMutation.isPending,
    connect,
    switchToRobinhood,
    disconnect,
    error,
  };
}
