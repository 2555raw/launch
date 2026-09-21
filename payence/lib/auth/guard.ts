import "server-only";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { currentAuth, type Auth } from "./session";

/** Every authenticated page and server action starts here. */
export function requireAuth(next?: string): Auth {
  const auth = currentAuth();
  if (!auth) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  if (auth.user.totpEnabledAt && !auth.session.mfaPassed) redirect("/login/verify");
  return auth;
}

/** Actions that move money additionally require an unfrozen account. */
export function requireActiveUser(): Auth {
  const auth = requireAuth();
  if (auth.user.status !== "active") redirect("/settings?frozen=1");
  return auth;
}

export function requireMerchant(): { auth: Auth; merchant: schema.Merchant } {
  const auth = requireAuth("/merchant");
  const merchant = getDb()
    .select()
    .from(schema.merchants)
    .where(eq(schema.merchants.ownerUserId, auth.user.id))
    .get();
  if (!merchant) redirect("/merchant/onboarding");
  return { auth, merchant };
}

export function optionalMerchant(userId: string): schema.Merchant | undefined {
  return getDb().select().from(schema.merchants).where(eq(schema.merchants.ownerUserId, userId)).get();
}
