import { json, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guard";
import { listUsers } from "@/lib/services/users";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  await requireAdmin();
  const params = Object.fromEntries(new URL(req.url).searchParams);
  return json({ users: await listUsers(params) });
});
