import { json, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guard";
import { readyToPay } from "@/lib/services/payouts";

export const dynamic = "force-dynamic";

/** Walkers with verified rewards waiting to be paid, with their full wallet address. Admins only. */
export const GET = route(async () => {
  await requireAdmin();
  return json({ ready: await readyToPay() });
});
