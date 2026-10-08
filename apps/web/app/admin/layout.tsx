'use client';
import { Wrench } from 'lucide-react';
import { useRequireAuth } from '@/lib/hooks';
import { AdminNav } from '@/components/admin/admin-nav';
import { STAFF_ROLES } from '@/components/admin/permissions';
import { Spinner } from '@/components/ui/primitives';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = useRequireAuth({ roles: STAFF_ROLES });
  if (!user) {
    return (
      <div className="flex items-center gap-2 py-20 text-sm text-slate-400">
        <Spinner /> Checking access…
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-ember-500/15 text-ember-300"><Wrench size={18} /></span>
          <div>
            <div className="font-display text-lg font-bold text-white">Admin</div>
            <div className="text-[11px] text-slate-500">
              Signed in as {user.username} · <span className="uppercase">{user.role}</span>
            </div>
          </div>
        </div>
      </div>
      <AdminNav />
      <div className="mt-4">{children}</div>
    </div>
  );
}
