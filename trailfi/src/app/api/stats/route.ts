import { json, route } from "@/lib/api";
import { publicStats } from "@/lib/services/stats";

export const dynamic = "force-dynamic";

/** Live community totals for the landing page. */
export const GET = route(async () => json(await publicStats()));
