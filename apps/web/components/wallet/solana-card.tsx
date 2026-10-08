'use client';
import { useQuery } from '@tanstack/react-query';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { CheckCircle2, Link2, LogIn } from 'lucide-react';
import { solanaExplorerAddressUrl } from '@launch/config/chains';
import { SOLANA_NETWORK } from '@/lib/config';
import { useAuth } from '@/lib/auth-store';
import { Spinner } from '@/components/ui/primitives';
import { AddressLine, ChainBadge } from '@/components/launchpad/common';
import { useLinkWallet } from './use-link-wallet';

export function SolanaCard() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { user } = useAuth();
  const { link, signIn, busy, isLinked } = useLinkWallet();
  const address = wallet.publicKey?.toBase58() ?? null;
  const linked = isLinked('SOLANA', address);

  const balance = useQuery({
    queryKey: ['sol-balance', address],
    queryFn: async () => (await connection.getBalance(wallet.publicKey!, 'confirmed')) / LAMPORTS_PER_SOL,
    enabled: !!wallet.publicKey,
    refetchInterval: 30_000,
  });

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-white">Solana</h2>
        <ChainBadge chain="SOLANA" network={SOLANA_NETWORK} />
      </div>
      <p className="mt-1 text-xs text-slate-500">Phantom or Solflare. Used to launch Token-2022 mints and to swap through Jupiter.</p>
      <div className="mt-4">
        <WalletMultiButton />
      </div>
      {address && (
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-slate-500">Address</span>
            <AddressLine address={address} explorerUrl={solanaExplorerAddressUrl(address, SOLANA_NETWORK)} chars={6} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-slate-500">Balance</span>
            {balance.isLoading ? <Spinner /> : balance.isError ? <span className="text-xs text-rose-300">Data unavailable ({balance.error.message})</span> : <span className="font-display font-semibold text-white">{balance.data?.toLocaleString(undefined, { maximumFractionDigits: 6 })} SOL</span>}
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-3">
            {user ? (
              linked ? (
                <span className="flex items-center gap-1.5 text-mint-400">
                  <CheckCircle2 size={15} /> Linked to your account
                </span>
              ) : (
                <>
                  <span className="text-slate-400">Not linked to {user.username}</span>
                  <button className="btn-primary text-xs" disabled={busy !== null} onClick={() => void link('SOLANA', address)}>
                    {busy === 'link' ? <Spinner /> : <Link2 size={14} />} Link to account
                  </button>
                </>
              )
            ) : (
              <button className="btn-primary text-xs" disabled={busy !== null} onClick={() => void signIn('SOLANA', address)}>
                {busy === 'signin' ? <Spinner /> : <LogIn size={14} />} Sign in with this wallet
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
