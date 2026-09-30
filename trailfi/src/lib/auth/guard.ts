import "server-only";
import { HttpError } from "@/lib/api";
import { one } from "@/lib/db";
import { env } from "@/lib/env";
import { readSession } from "./session";

export interface AuthUser {
  id: string;
  wallet_address: `0x${string}`;
  role: "user" | "admin";
  status: "active" | "suspended";
}

/** Loads the signed-in user fresh from the database (so role/suspension changes apply immediately). */
export async function currentUser(): Promise<AuthUser | null> {
  const session = await readSession();
  if (!session) return null;
  const user = await one<AuthUser>("select id, wallet_address, role, status from users where id = $1", [session.userId]);
  if (!user || user.wallet_address !== session.address.toLowerCase()) return null;
  return user;
}

export async function requireUser(): Promise<AuthUser> {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Connect and verify your wallet first.", "unauthenticated");
  if (user.status !== "active") throw new HttpError(403, "This account is suspended.", "suspended");
  return user;
}

export function isAdminWallet(address: string) {
  return env.adminWallets.includes(address.toLowerCase());
}

/**
 * Admin access needs both: the database role and the wallet being listed in
 * ADMIN_WALLETS on the server. Removing a wallet from the env revokes access
 * at once, even for live sessions.
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  if (user.role !== "admin" || !isAdminWallet(user.wallet_address)) {
    throw new HttpError(403, "Administrator access required.", "forbidden");
  }
  return user;
}
