import { json, route } from "@/lib/api";
import { leaderboard } from "@/lib/services/stats";

export const dynamic = "force-dynamic";

export const GET = route(async () => json(await leaderboard()));
