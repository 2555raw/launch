import { route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guard";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Newsletter list as a CSV download. */
export const GET = route(async () => {
  await requireAdmin();
  const rows = await query<{ email: string; createdAt: string }>(
    `select email, created_at as "createdAt" from newsletter_subscribers order by created_at`,
  );
  const csv = ["email,subscribed_at", ...rows.map((r) => `${r.email},${new Date(r.createdAt).toISOString()}`)].join("\n");
  return new Response(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="strydo-newsletter.csv"' },
  });
});
