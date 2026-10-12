'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnect, useConnection, useSignMessage } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { KeyRound, Wallet } from 'lucide-react';
import type { AuthUser } from '@launch/types';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { tGlobal, useT } from '@/lib/i18n';
import { signChallenge, walletSignIn } from '@/lib/wallet-auth';
import { Spinner, shortAddr } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toast';

// The wallet picker button renders differently on the server and the client; load it client-side only.
import { SolanaWalletButton } from '@/components/wallet/solana-wallet-button';

type Session = { user: AuthUser; accessToken: string; refreshToken?: string };

function finishSignIn(session: Session, router: ReturnType<typeof useRouter>) {
  useAuth.getState().setSession(session);
  toast.success(tGlobal('Welcome, {name}', { name: session.user.username }));
  router.push('/village');
}

/** "Continue with Solana wallet": connect through the wallet picker, then sign the API challenge. */
export function SolanaSignIn() {
  const t = useT();
  const router = useRouter();
  const wallet = useWallet();
  const [busy, setBusy] = useState(false);

  const sign = async () => {
    if (!wallet.publicKey || !wallet.signMessage) return;
    const signMessage = wallet.signMessage;
    setBusy(true);
    try {
      const challenge = await signChallenge('SOLANA', wallet.publicKey.toBase58(), (m) => signMessage(new TextEncoder().encode(m)));
      finishSignIn(await walletSignIn(challenge), router);
    } catch (e) {
      toast.error(t('Solana sign-in failed'), errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!wallet.connected || !wallet.publicKey) {
    return (
      <div className="[&>button]:w-full [&>button]:justify-center">
        <SolanaWalletButton>
          <Wallet size={16} className="mr-2" /> {t('Continue with Solana wallet')}
        </SolanaWalletButton>
      </div>
    );
  }
  if (!wallet.signMessage) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-200">
        {t('{wallet} does not support message signing. Choose another wallet.', { wallet: wallet.wallet?.adapter.name ?? t('This wallet') })}
        <button className="btn-ghost mt-2 w-full py-1 text-xs" onClick={() => void wallet.disconnect()}>
          {t('Disconnect')}
        </button>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <button className="btn-secondary flex-1" onClick={() => void sign()} disabled={busy}>
        {busy ? <Spinner /> : <KeyRound size={16} />}
        {t('Sign in as {address}', { address: shortAddr(wallet.publicKey.toBase58()) })}
      </button>
      <button className="btn-ghost" onClick={() => void wallet.disconnect()} disabled={busy} title={t('Use a different wallet')}>
        {t('Change')}
      </button>
    </div>
  );
}

/** "Continue with Robinhood Chain wallet": injected EVM wallet (MetaMask etc.) + EIP-191 signature. */
export function EvmSignIn() {
  const t = useT();
  const router = useRouter();
  const connection = useConnection();
  const { connectAsync } = useConnect();
  const { signMessageAsync } = useSignMessage();
  const [busy, setBusy] = useState(false);

  const sign = async () => {
    setBusy(true);
    try {
      if (typeof window !== 'undefined' && !(window as { ethereum?: unknown }).ethereum) {
        toast.error(t('No EVM wallet found'), t('Install MetaMask or another browser wallet to continue with Robinhood Chain.'));
        return;
      }
      let address: string | undefined = connection.address;
      if (!address) {
        const res = await connectAsync({ connector: injected() });
        address = res.accounts[0];
      }
      if (!address) throw new Error(t('Wallet returned no account'));
      const challenge = await signChallenge('ROBINHOOD', address, (m) => signMessageAsync({ message: m }));
      finishSignIn(await walletSignIn(challenge), router);
    } catch (e) {
      toast.error(t('Robinhood Chain sign-in failed'), errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button className="btn-secondary w-full" onClick={() => void sign()} disabled={busy}>
      {busy ? <Spinner /> : <Wallet size={16} />}
      {connection.address ? t('Continue as {address} (Robinhood Chain)', { address: shortAddr(connection.address) }) : t('Continue with Robinhood Chain wallet')}
    </button>
  );
}

export function WalletSignInOptions() {
  const t = useT();
  return (
    <div className="space-y-2">
      <SolanaSignIn />
      <EvmSignIn />
      <p className="text-center text-[11px] text-slate-500">{t('Wallet sign-in asks for a signature only. No transaction is sent.')}</p>
    </div>
  );
}
