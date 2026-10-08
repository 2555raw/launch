'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from './auth-store';

/** Redirects to /login when the session is known to be absent. Returns the user (or null while loading). */
export function useRequireAuth(opts: { player?: boolean; roles?: string[] } = {}) {
  const { user, ready } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace('/login');
    else if (opts.player && !user.playerId) router.replace('/');
    else if (opts.roles && !opts.roles.includes(user.role)) router.replace('/');
  }, [ready, user, router, opts.player, opts.roles]);
  return ready ? user : null;
}

/** Re-renders every `ms` so countdown timers tick. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
