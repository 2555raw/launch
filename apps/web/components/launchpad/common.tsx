'use client';
import { SolanaIcon } from '@/components/ui/brand-icons';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import clsx from 'clsx';
import type { Chain, ProjectStatus } from '@launch/types';
import { shortAddr } from '@/components/ui/primitives';

export const CHAIN_LABEL: Record<Chain, string> = { SOLANA: 'Solana', ROBINHOOD: 'Robinhood Chain' };

export function networkLabel(chain: Chain, network: string): string {
  if (chain === 'SOLANA') return network === 'mainnet-beta' ? 'Mainnet' : network;
  return network === 'mainnet' ? 'Mainnet' : network;
}

export function ChainBadge({ chain, network, className }: { chain: Chain; network?: string; className?: string }) {
  return (
    <span className={clsx('badge gap-1.5', chain === 'SOLANA' ? 'border-elixir-500/40 text-elixir-400' : 'border-mint-500/40 text-mint-400', className)}>
      {chain === 'SOLANA' ? <SolanaIcon size={10} /> : <span className="h-1.5 w-1.5 rounded-full bg-mint-400" />}
      {CHAIN_LABEL[chain]}
      {network && <span className="text-slate-500">· {networkLabel(chain, network)}</span>}
    </span>
  );
}

const STATUS_STYLE: Record<ProjectStatus, string> = {
  DRAFT: 'border-white/15 text-slate-300',
  AWAITING_SIGNATURE: 'border-gold-500/40 text-gold-300',
  VERIFYING: 'border-elixir-500/40 text-elixir-400 animate-pulseSoft',
  PUBLISHED: 'border-mint-500/40 text-mint-400',
  FAILED: 'border-rose-500/40 text-rose-300',
};
const STATUS_TEXT: Record<ProjectStatus, string> = { DRAFT: 'Draft', AWAITING_SIGNATURE: 'Awaiting signature', VERIFYING: 'Verifying', PUBLISHED: 'Published', FAILED: 'Failed' };

export function StatusPill({ status }: { status: ProjectStatus }) {
  return <span className={clsx('badge', STATUS_STYLE[status])}>{STATUS_TEXT[status]}</span>;
}

export function CopyButton({ value, label = 'Copy', className }: { value: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <button type="button" onClick={() => void copy()} className={clsx('btn-ghost p-1.5', className)} aria-label={label} title={label}>
      {done ? <Check size={14} className="text-mint-400" /> : <Copy size={14} />}
    </button>
  );
}

export function ExtLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={clsx('inline-flex items-center gap-1 text-ember-300 hover:text-ember-200 hover:underline', className)}>
      {children}
      <ExternalLink size={12} />
    </a>
  );
}

/** Address with copy button and optional explorer link. */
export function AddressLine({ address, explorerUrl, chars = 6 }: { address: string; explorerUrl?: string; chars?: number }) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-sm text-slate-200">
      <span title={address}>{shortAddr(address, chars)}</span>
      <CopyButton value={address} label="Copy address" />
      {explorerUrl && (
        <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost p-1.5" aria-label="Open in explorer" title="Open in explorer">
          <ExternalLink size={14} />
        </a>
      )}
    </span>
  );
}

/** Logo image or initials placeholder. */
export function ProjectLogo({ logoUrl, name, symbol, size = 48 }: { logoUrl: string | null; name: string; symbol: string; size?: number }) {
  const initials = (symbol || name).slice(0, 3).toUpperCase();
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt={`${name} logo`} width={size} height={size} className="shrink-0 rounded-xl object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <div className="grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-ember-500/60 to-elixir-500/60 font-display font-bold text-white" style={{ width: size, height: size, fontSize: size / 3.2 }}>
      {initials}
    </div>
  );
}

/** Formats a raw integer amount with the given decimals (no float precision loss). */
export function formatUnits(raw: string | bigint, decimals: number, maxFraction = 4): string {
  let value: bigint;
  try {
    value = typeof raw === 'bigint' ? raw : BigInt(raw);
  } catch {
    return String(raw);
  }
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const frac = value % base;
  const wholeStr = whole.toLocaleString('en-US');
  if (decimals === 0 || frac === 0n) return wholeStr;
  const fracStr = frac.toString().padStart(decimals, '0').slice(0, maxFraction).replace(/0+$/, '');
  return fracStr ? `${wholeStr}.${fracStr}` : wholeStr;
}

export function formatWhole(n: string): string {
  try {
    return BigInt(n).toLocaleString('en-US');
  } catch {
    return n;
  }
}

export function SectionTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="font-display text-lg font-semibold text-white">{children}</h2>
      {actions}
    </div>
  );
}

export function Field({ label, hint, children, error }: { label: string; hint?: string; children: ReactNode; error?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {error ? <div className="mt-1 text-xs text-rose-300">{error}</div> : hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}
