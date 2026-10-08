'use client';
import { useBalance } from 'wagmi';
import { formatUnits } from 'viem';
import { AlertTriangle, CheckCircle2, Link2, LogIn } from 'lucide-react';
import { robinhoodExplorerAddressUrl } from '@launch/config/chains';
import { ROBINHOOD_CHAIN_NETWORK } from '@/lib/config';
import { useAuth } from '@/lib/auth-store';
import { robinhoodChain } from '@/components/providers';
import { Spinner } from '@/components/ui/primitives';
import { AddressLine, ChainBadge } from '@/components/launchpad/common';
import { useEvmWallet } from './use-evm-wallet';
import { useLinkWallet } from './use-link-wallet';

export function RobinhoodCard() {
  const evm = useEvmWallet();
  const { user } = useAuth();
  const { link, signIn, busy, isLinked } = useLinkWallet();
  const linked = isLinked('ROBINHOOD', evm.address);
  const balance = useBalance({ address: evm.address ?? undefined, chainId: robinhoodChain.id, query: { enabled: !!evm.address, refetchInterval: 30_000 } });

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-white">Robinhood Chain</h2>
        <ChainBadge chain="ROBINHOOD" network={ROBINHOOD_CHAIN_NETWORK} />
      </div>
      <p className="mt-1 text-xs text-slate-500">
        EVM L2 (chain id {robinhoodChain.id}). Any injected wallet such as MetaMask or Rabby. Used to deploy ERC-20 tokens.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {evm.isConnected ? (
          <>
            <button className="btn-ghost text-xs" onClick={() => void evm.disconnect()}>
              Disconnect
            </button>
            {!evm.onRobinhood && (
              <button className="btn-secondary text-xs" onClick={() => void evm.switchToRobinhood()} disabled={evm.switching}>
                {evm.switching && <Spinner />} Switch network
              </button>
            )}
          </>
        ) : (
          <button className="btn-secondary" onClick={() => void evm.connect()} disabled={evm.connecting}>
            {evm.connecting && <Spinner />} Connect EVM wallet
          </button>
        )}
        {!evm.hasInjected && <span className="text-xs text-slate-500">No injected wallet detected.</span>}
      </div>
      {evm.error && <div className="mt-2 text-xs text-rose-300">{evm.error}</div>}
      {evm.address && (
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-slate-500">Address</span>
            <AddressLine address={evm.address} explorerUrl={robinhoodExplorerAddressUrl(evm.address, ROBINHOOD_CHAIN_NETWORK)} chars={6} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-slate-500">Network</span>
            {evm.onRobinhood ? (
              <span className="flex items-center gap-1.5 text-mint-400">
                <CheckCircle2 size={15} /> {robinhoodChain.name}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-gold-300">
                <AlertTriangle size={15} /> Wallet is on chain {evm.chainId ?? '?'} — switch to {robinhoodChain.name}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-slate-500">Balance</span>
            {balance.isLoading ? <Spinner /> : balance.isError ? <span className="text-xs text-rose-300">Data unavailable ({balance.error.message})</span> : balance.data ? <span className="font-display font-semibold text-white">{Number(formatUnits(balance.data.value, balance.data.decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 })} {balance.data.symbol}</span> : <span className="text-slate-500">Data unavailable</span>}
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
                  <button className="btn-primary text-xs" disabled={busy !== null} onClick={() => evm.address && void link('ROBINHOOD', evm.address)}>
                    {busy === 'link' ? <Spinner /> : <Link2 size={14} />} Link to account
                  </button>
                </>
              )
            ) : (
              <button className="btn-primary text-xs" disabled={busy !== null} onClick={() => evm.address && void signIn('ROBINHOOD', evm.address)}>
                {busy === 'signin' ? <Spinner /> : <LogIn size={14} />} Sign in with this wallet
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
