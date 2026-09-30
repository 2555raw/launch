import type { ReactNode } from "react";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminShell } from "@/components/admin/AdminShell";
import { currentUser, isAdminWallet } from "@/lib/auth/guard";

export const metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Server-side gate: the admin UI is only rendered for a signed-in wallet with the
 * admin role that is also listed in ADMIN_WALLETS. Every admin API route checks
 * the same thing again on each request.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await currentUser().catch(() => null);
  const allowed = Boolean(user && user.status === "active" && user.role === "admin" && isAdminWallet(user.wallet_address));
  if (!allowed) return <AdminGate signedIn={Boolean(user)} />;
  return <AdminShell>{children}</AdminShell>;
}
