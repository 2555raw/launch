import { json, route } from "@/lib/api";
import { currentUser, isAdminWallet } from "@/lib/auth/guard";
import { clearSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = await currentUser();
  if (!user) return json({ user: null });
  return json({
    user: {
      id: user.id,
      walletAddress: user.wallet_address,
      role: user.role === "admin" && isAdminWallet(user.wallet_address) ? "admin" : "user",
      status: user.status,
    },
  });
});

export const DELETE = route(async () => {
  await clearSession();
  return json({ ok: true });
});
