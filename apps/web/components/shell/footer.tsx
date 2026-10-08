'use client';
import Link from 'next/link';
import { SocialLinks } from '@/components/ui/brand-icons';
import { SolanaIcon } from '@/components/ui/brand-icons';
import { SOLANA_NETWORK, ROBINHOOD_CHAIN_NETWORK } from '@/lib/config';

const COMMUNITY = {
  discord: process.env.NEXT_PUBLIC_DISCORD_URL,
  twitter: process.env.NEXT_PUBLIC_X_URL,
  telegram: process.env.NEXT_PUBLIC_TELEGRAM_URL,
  github: process.env.NEXT_PUBLIC_GITHUB_URL,
  website: process.env.NEXT_PUBLIC_SITE_URL,
};

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-white/[0.06] px-4 py-8 text-sm text-slate-500 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="font-display font-bold text-slate-200">Launch · Emberhold</div>
          <div className="mt-1 flex items-center gap-2 text-xs"><SolanaIcon size={12} /> Solana {SOLANA_NETWORK} · Robinhood Chain {ROBINHOOD_CHAIN_NETWORK}</div>
        </div>
        <SocialLinks links={COMMUNITY} labels />
        <div className="flex gap-4 text-xs">
          <Link href="/projects" className="hover:text-slate-300">Projects</Link>
          <Link href="/leaderboard" className="hover:text-slate-300">Leaderboard</Link>
          <Link href="/settings" className="hover:text-slate-300">Settings</Link>
        </div>
      </div>
    </footer>
  );
}
