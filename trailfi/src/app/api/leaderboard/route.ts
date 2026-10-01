import { json, route } from "@/lib/api";
import { publicPayouts } from "@/lib/services/payouts";

export const dynamic = "force-dynamic";

/** Public list of recent payouts. Wallets are always shortened. */
export const GET = route(async () => json({ payouts: await publicPayouts(12) }));
