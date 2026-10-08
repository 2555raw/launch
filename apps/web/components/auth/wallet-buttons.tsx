'use client';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnect, useConnection, useSignMessage } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { KeyRound, Wallet } from 'lucide-react';
import type { AuthUser } from '@launch/types';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { signChallenge, walletSignIn } from '@/lib/wallet-auth';
import { Spinner, shortAddr } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toast';

// The wallet picker button renders differently on the server and the client; load it client-side only.
const WalletMultiButton = dynamic(async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton, { ssr: false });

type Session = { user: AuthUser; accessToken: string; refreshToken?: string };

function finishSignIn(session: Session, router: ReturnType<typeof useRouter>) {
  useAuth.getState().setSession(session);
  toast.success(`Welcome, ${session.user.username}`);
  router.push('/village');
}

/** "Continue with Solana wallet": connect through the wallet picker, then sign the API challenge. */
export function SolanaSignIn() {
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
      toast.error('Solana sign-in failed', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!wallet.connected || !wallet.publicKey) {
    return (
      <div className="[&>button]:w-full [&>button]:justify-center">
        <WalletMultiButton>
          <Wallet size={16} className="mr-2" /> Continue with Solana wallet
        </WalletMultiButton>
      </div>
    );
  }
  if (!wallet.signMessage) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-200">
        {wallet.wallet?.adapter.name ?? 'This wallet'} does not support message signing. Choose another wallet.
        <button className="btn-ghost mt-2 w-full py-1 text-xs" onClick={() => void wallet.disconnect()}>
          Disconnect
        </button>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <button className="btn-secondary flex-1" onClick={() => void sign()} disabled={busy}>
        {busy ? <Spinner /> : <KeyRound size={16} />}
        Sign in as {shortAddr(wallet.publicKey.toBase58())}
      </button>
      <button className="btn-ghost" onClick={() => void wallet.disconnect()} disabled={busy} title="Use a different wallet">
        Change
      </button>
    </div>
  );
}

/** "Continue with Robinhood Chain wallet": injected EVM wallet (MetaMask etc.) + EIP-191 signature. */
export function EvmSignIn() {
  const router = useRouter();
  const connection = useConnection();
  const { connectAsync } = useConnect();
  const { signMessageAsync } = useSignMessage();
  const [busy, setBusy] = useState(false);

  const sign = async () => {
    setBusy(true);
    try {
      if (typeof window !== 'undefined' && !(window as { ethereum?: unknown }).ethereum) {
        toast.error('No EVM wallet found', 'Install MetaMask or another browser wallet to continue with Robinhood Chain.');
        return;
      }
      let address: string | undefined = connection.address;
      if (!address) {
        const res = await connectAsync({ connector: injected() });
        address = res.accounts[0];
      }
      if (!address) throw new Error('Wallet returned no account');
      const challenge = await signChallenge('ROBINHOOD', address, (m) => signMessageAsync({ message: m }));
      finishSignIn(await walletSignIn(challenge), router);
    } catch (e) {
      toast.error('Robinhood Chain sign-in failed', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button className="btn-secondary w-full" onClick={() => void sign()} disabled={busy}>
      {busy ? <Spinner /> : <Wallet size={16} />}
      {connection.address ? `Continue as ${shortAddr(connection.address)} (Robinhood Chain)` : 'Continue with Robinhood Chain wallet'}
    </button>
  );
}

export function WalletSignInOptions() {
  return (
    <div className="space-y-2">
      <SolanaSignIn />
      <EvmSignIn />
      <p className="text-center text-[11px] text-slate-500">Wallet sign-in asks for a signature only. No transaction is sent.</p>
    </div>
  );
}
