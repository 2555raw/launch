'use client';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Star, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import type { WalletDTO } from '@launch/types';
import { robinhoodExplorerAddressUrl, solanaExplorerAddressUrl } from '@launch/config/chains';
import { ROBINHOOD_CHAIN_NETWORK, SOLANA_NETWORK } from '@/lib/config';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { toast } from '@/components/ui/toast';
import { Spinner } from '@/components/ui/primitives';
import { AddressLine, ChainBadge } from '@/components/launchpad/common';

function explorer(w: WalletDTO): string {
  return w.chain === 'SOLANA' ? solanaExplorerAddressUrl(w.address, SOLANA_NETWORK) : robinhoodExplorerAddressUrl(w.address, ROBINHOOD_CHAIN_NETWORK);
}

export function LinkedWallets() {
  const { user, wallets, loadMe } = useAuth();
  const [confirm, setConfirm] = useState<WalletDTO | null>(null);

  const setPrimary = useMutation({
    mutationFn: (id: string) => api(`/wallets/${id}/primary`, { method: 'PATCH' }),
    onSuccess: async () => {
      await loadMe();
      toast.success('Primary wallet updated');
    },
    onError: (e) => toast.error('Could not update wallet', errorMessage(e)),
  });
  const unlink = useMutation({
    mutationFn: (id: string) => api(`/wallets/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await loadMe();
      setConfirm(null);
      toast.success('Wallet unlinked');
    },
    onError: (e) => toast.error('Could not unlink wallet', errorMessage(e)),
  });

  if (!user) return null;
  return (
    <div className="card p-4">
      <h2 className="font-display text-lg font-semibold text-white">Linked wallets</h2>
      <p className="mt-1 text-xs text-slate-500">Wallets that proved ownership by signing a message. The primary wallet per chain is used by default for launches and portfolio.</p>
      {wallets.length === 0 ? (
        <div className="mt-4 text-sm text-slate-500">No wallets linked yet. Connect one above and link it.</div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-3">Chain</th>
                <th className="py-2 pr-3">Address</th>
                <th className="py-2 pr-3">Label</th>
                <th className="py-2 pr-3">Linked</th>
                <th className="py-2 pr-3">Primary</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {wallets.map((w) => (
                <tr key={w.id}>
                  <td className="py-2 pr-3">
                    <ChainBadge chain={w.chain} />
                  </td>
                  <td className="py-2 pr-3">
                    <AddressLine address={w.address} explorerUrl={explorer(w)} chars={5} />
                  </td>
                  <td className="py-2 pr-3 text-slate-400">{w.label ?? '—'}</td>
                  <td className="py-2 pr-3 text-xs text-slate-400">{new Date(w.verifiedAt).toLocaleDateString()}</td>
                  <td className="py-2 pr-3">
                    <button className={clsx('btn-ghost p-1.5', w.isPrimary ? 'text-gold-400' : 'text-slate-500')} title={w.isPrimary ? 'Primary wallet' : 'Make primary'} disabled={w.isPrimary || setPrimary.isPending} onClick={() => setPrimary.mutate(w.id)}>
                      <Star size={15} fill={w.isPrimary ? 'currentColor' : 'none'} />
                    </button>
                  </td>
                  <td className="py-2 text-right">
                    <button className="btn-ghost p-1.5 text-slate-500 hover:text-rose-300" title="Unlink" onClick={() => setConfirm(w)}>
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4" onClick={() => setConfirm(null)}>
          <div className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-semibold text-white">Unlink wallet?</h3>
            <p className="mt-2 text-sm text-slate-300">
              <span className="font-mono">{confirm.address}</span> will no longer be able to sign in to this account, and tokens it launched stay attributed to it on chain. If this is your only sign-in method, set a password first.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button className="btn-danger" disabled={unlink.isPending} onClick={() => unlink.mutate(confirm.id)}>
                {unlink.isPending && <Spinner />} Unlink
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
