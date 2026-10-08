'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { Castle, Coins, FileText, Flag, LayoutDashboard, Rocket, ScrollText, Settings2, Swords, Users, UsersRound } from 'lucide-react';

export const ADMIN_TABS = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/villages', label: 'Villages', icon: Castle },
  { href: '/admin/battles', label: 'Battles', icon: Swords },
  { href: '/admin/clans', label: 'Clans', icon: UsersRound },
  { href: '/admin/projects', label: 'Projects', icon: Rocket },
  { href: '/admin/tokens', label: 'Tokens', icon: Coins },
  { href: '/admin/transactions', label: 'Transactions', icon: FileText },
  { href: '/admin/reports', label: 'Reports', icon: Flag },
  { href: '/admin/config', label: 'Config', icon: Settings2 },
  { href: '/admin/logs', label: 'Audit log', icon: ScrollText },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="scroll-thin -mx-1 flex gap-1 overflow-x-auto px-1 pb-1" aria-label="Admin sections">
      {ADMIN_TABS.map((t) => {
        const active = t.href === '/admin' ? pathname === '/admin' : pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={clsx('flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm transition', active ? 'bg-ember-500/15 text-ember-300' : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100')}>
            <t.icon size={14} /> {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
