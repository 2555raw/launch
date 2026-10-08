'use client';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSignMessage } from 'wagmi';
import type { Chain } from '@launch/types';
import { useAuth } from '@/lib/auth-store';
import { errorMessage } from '@/lib/api';
import { signChallenge, walletLink, walletSignIn } from '@/lib/wallet-auth';
import { toast } from '@/components/ui/toast';
import { walletErrorMessage } from './encoding';

export function isWalletLinked(wallets: { chain: Chain; address: string }[], chain: Chain, address: string | null | undefined): boolean {
  if (!address) return false;
  return wallets.some((w) => w.chain === chain && (chain === 'ROBINHOOD' ? w.address.toLowerCase() === address.toLowerCase() : w.address === address));
}

/**
 * Link-to-account and sign-in flows for both chains. The nonce challenge is signed by the
 * connected wallet (Solana: wallet adapter signMessage; EVM: wagmi signMessage / EIP-191).
 */
export function useLinkWallet() {
  const router = useRouter();
  const solana = useWallet();
  const { signMessageAsync } = useSignMessage();
  const { wallets, setSession, loadMe } = useAuth();
  const [busy, setBusy] = useState<'link' | 'signin' | null>(null);

  const signerFor = useCallback(
    (chain: Chain, address: string) => {
      if (chain === 'SOLANA') {
        if (!solana.signMessage) throw new Error('This Solana wallet cannot sign messages');
        const sign = solana.signMessage;
        return (m: string) => sign(new TextEncoder().encode(m));
      }
      return (m: string) => signMessageAsync({ message: m, account: address as `0x${string}` });
    },
    [solana.signMessage, signMessageAsync],
  );

  const link = useCallback(
    async (chain: Chain, address: string, label?: string): Promise<boolean> => {
      setBusy('link');
      try {
        const challenge = await signChallenge(chain, address, signerFor(chain, address));
        await walletLink(challenge, label);
        await loadMe();
        toast.success('Wallet linked', `${chain === 'SOLANA' ? 'Solana' : 'Robinhood Chain'} wallet is now linked to your account.`);
        return true;
      } catch (e) {
        toast.error('Could not link wallet', walletErrorMessage(e) || errorMessage(e));
        return false;
      } finally {
        setBusy(null);
      }
    },
    [signerFor, loadMe],
  );

  const signIn = useCallback(
    async (chain: Chain, address: string): Promise<boolean> => {
      setBusy('signin');
      try {
        const challenge = await signChallenge(chain, address, signerFor(chain, address));
        const session = await walletSignIn(challenge);
        setSession(session);
        toast.success('Signed in', `Welcome, ${session.user.username}.`);
        router.push('/village');
        return true;
      } catch (e) {
        toast.error('Wallet sign-in failed', walletErrorMessage(e) || errorMessage(e));
        return false;
      } finally {
        setBusy(null);
      }
    },
    [signerFor, setSession, router],
  );

  return { link, signIn, busy, isLinked: (chain: Chain, address: string | null | undefined) => isWalletLinked(wallets, chain, address) };
}
