'use client';
import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Link2 } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import type { Chain } from '@launch/types';
import { ROBINHOOD_CHAIN_NETWORK, SOLANA_NETWORK } from '@/lib/config';
import { useAuth } from '@/lib/auth-store';
import { Spinner, shortAddr } from '@/components/ui/primitives';
import { useEvmWallet } from '@/components/wallet/use-evm-wallet';
import { useLinkWallet } from '@/components/wallet/use-link-wallet';
import { ChainBadge, networkLabel } from '../common';

const OPTIONS: { chain: Chain; title: string; body: string; standard: string }[] = [
  { chain: 'SOLANA', title: 'Solana', body: 'Token-2022 mint with on-chain metadata. Fast and cheap; signed with Phantom or Solflare.', standard: 'SPL Token-2022' },
  { chain: 'ROBINHOOD', title: 'Robinhood Chain', body: 'EVM L2. Deploys a verified ERC-20 contract from your injected wallet (MetaMask, Rabby…).', standard: 'ERC-20' },
];

/** Returns the connected + linked wallet address for the chain, or null. Shared with step 5. */
export function useChainWallet(chain: Chain) {
  const solana = useWallet();
  const evm = useEvmWallet();
  const { isLinked } = useLinkWallet();
  const address = chain === 'SOLANA' ? solana.publicKey?.toBase58() ?? null : evm.address;
  return { address, connected: !!address, linked: isLinked(chain, address), evm, solana };
}

export function StepChain({ chain, locked, onChange, onNext }: { chain: Chain; locked: boolean; onChange: (c: Chain) => void; onNext: () => void }) {
  const { wallets } = useAuth();
  const { address, connected, linked, evm } = useChainWallet(chain);
  const { link, busy } = useLinkWallet();
  const linkedOnChain = wallets.filter((w) => w.chain === chain);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-white">Choose a chain</h2>
        <p className="mt-1 text-sm text-slate-400">{locked ? 'The chain is fixed once a project is created. Start a new project to change it.' : 'Where should the token live? This cannot be changed after the project is created.'}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {OPTIONS.map((o) => (
            <button
              key={o.chain}
              type="button"
              disabled={locked && o.chain !== chain}
              onClick={() => onChange(o.chain)}
              className={clsx('card p-4 text-left transition disabled:opacity-40', chain === o.chain ? 'border-ember-500/60 shadow-glow' : 'hover:border-white/20')}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-base font-semibold text-white">{o.title}</span>
                <ChainBadge chain={o.chain} />
              </div>
              <p className="mt-2 text-sm text-slate-400">{o.body}</p>
              <div className="mt-3 text-xs text-slate-500">
                Standard: <span className="font-mono text-slate-300">{o.standard}</span> · Network: <span className="text-slate-300">{networkLabel(o.chain, o.chain === 'SOLANA' ? SOLANA_NETWORK : ROBINHOOD_CHAIN_NETWORK)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="card p-4">
        <h3 className="font-display font-semibold text-white">Creator wallet</h3>
        <p className="mt-1 text-sm text-slate-400">This wallet signs the creation transaction, pays fees and receives the full supply. It must be linked to your account so the launch is attributed to you.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {chain === 'SOLANA' ? (
            <WalletMultiButton />
          ) : evm.isConnected ? (
            <>
              <span className="badge font-mono">{shortAddr(evm.address ?? '', 6)}</span>
              {!evm.onRobinhood && (
                <button className="btn-secondary text-xs" onClick={() => void evm.switchToRobinhood()} disabled={evm.switching}>
                  {evm.switching ? <Spinner /> : null} Switch to Robinhood Chain
                </button>
              )}
              <button className="btn-ghost text-xs" onClick={() => void evm.disconnect()}>
                Disconnect
              </button>
            </>
          ) : (
            <button className="btn-secondary" onClick={() => void evm.connect()} disabled={evm.connecting}>
              {evm.connecting ? <Spinner /> : null} Connect EVM wallet
            </button>
          )}
          {evm.error && chain === 'ROBINHOOD' && <span className="text-xs text-rose-300">{evm.error}</span>}
        </div>

        <div className="mt-4 text-sm">
          {!connected ? (
            <div className="flex items-center gap-2 text-slate-400">
              <AlertTriangle size={16} className="text-gold-400" /> Connect a {chain === 'SOLANA' ? 'Solana' : 'Robinhood Chain'} wallet to continue.
            </div>
          ) : linked ? (
            <div className="flex items-center gap-2 text-mint-400">
              <CheckCircle2 size={16} /> <span className="font-mono">{shortAddr(address ?? '', 6)}</span> is linked to your account.
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-2 text-gold-300">
                <AlertTriangle size={16} /> <span className="font-mono">{shortAddr(address ?? '', 6)}</span> is not linked to your account yet.
              </span>
              <button className="btn-primary text-xs" disabled={busy !== null} onClick={() => address && void link(chain, address)}>
                {busy === 'link' ? <Spinner /> : <Link2 size={14} />} Link this wallet
              </button>
            </div>
          )}
          {linkedOnChain.length > 0 && !linked && (
            <div className="mt-2 text-xs text-slate-500">Linked {chain === 'SOLANA' ? 'Solana' : 'Robinhood Chain'} wallets: {linkedOnChain.map((w) => shortAddr(w.address, 4)).join(', ')} — switch your wallet to one of these or link the current one.</div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button className="btn-primary" disabled={!connected || !linked} onClick={onNext}>
          Continue
        </button>
      </div>
    </div>
  );
}
