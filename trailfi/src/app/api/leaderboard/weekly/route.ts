import { json, route } from "@/lib/api";
import { currentUser } from "@/lib/auth/guard";
import { weeklyRanking } from "@/lib/services/ranking";

export const dynamic = "force-dynamic";

/** Public weekly ranking by verified steps. Wallets are always shortened. */
export const GET = route(async (req) => {
  const which = new URL(req.url).searchParams.get("week") === "last" ? "last" : "this";
  const me = await currentUser();
  return json(await weeklyRanking(which, me?.id ?? null));
});
