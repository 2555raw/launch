import type { ReactNode } from "react";
import { requireAuth } from "@/lib/auth/guard";
import { AppShell } from "@/components/app/AppShell";
import { unreadCount } from "@/lib/services/notifications";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user } = requireAuth();
  return (
    <AppShell user={{ name: user.name, handle: user.handle }} unread={unreadCount(user.id)}>
      {children}
    </AppShell>
  );
}
