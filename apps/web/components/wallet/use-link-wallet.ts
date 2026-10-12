'use client';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSignMessage } from 'wagmi';
import type { Chain } from '@launch/types';
import { useAuth } from '@/lib/auth-store';
import { errorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
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
  const t = useT();
  const router = useRouter();
  const solana = useWallet();
  const { signMessageAsync } = useSignMessage();
  const { wallets, setSession, loadMe } = useAuth();
  const [busy, setBusy] = useState<'link' | 'signin' | null>(null);

  const signerFor = useCallback(
    (chain: Chain, address: string) => {
      if (chain === 'SOLANA') {
        if (!solana.signMessage) throw new Error(t('This Solana wallet cannot sign messages'));
        const sign = solana.signMessage;
        return (m: string) => sign(new TextEncoder().encode(m));
      }
      return (m: string) => signMessageAsync({ message: m, account: address as `0x${string}` });
    },
    [solana.signMessage, signMessageAsync, t],
  );

  const link = useCallback(
    async (chain: Chain, address: string, label?: string): Promise<boolean> => {
      setBusy('link');
      try {
        const challenge = await signChallenge(chain, address, signerFor(chain, address));
        await walletLink(challenge, label);
        await loadMe();
        toast.success(t('Wallet linked'), t('{chain} wallet is now linked to your account.', { chain: chain === 'SOLANA' ? 'Solana' : 'Robinhood Chain' }));
        return true;
      } catch (e) {
        toast.error(t('Could not link wallet'), walletErrorMessage(e) || errorMessage(e));
        return false;
      } finally {
        setBusy(null);
      }
    },
    [signerFor, loadMe, t],
  );

  const signIn = useCallback(
    async (chain: Chain, address: string): Promise<boolean> => {
      setBusy('signin');
      try {
        const challenge = await signChallenge(chain, address, signerFor(chain, address));
        const session = await walletSignIn(challenge);
        setSession(session);
        toast.success(t('Signed in'), t('Welcome, {name}.', { name: session.user.username }));
        router.push('/village');
        return true;
      } catch (e) {
        toast.error(t('Wallet sign-in failed'), walletErrorMessage(e) || errorMessage(e));
        return false;
      } finally {
        setBusy(null);
      }
    },
    [signerFor, setSession, router, t],
  );

  return { link, signIn, busy, isLinked: (chain: Chain, address: string | null | undefined) => isWalletLinked(wallets, chain, address) };
}
