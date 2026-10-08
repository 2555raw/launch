import { getUser, publicUser } from "@/server/auth";
import { handler, json } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = handler(async (req) => {
  const u = await getUser(req);
  return json({ user: u ? publicUser(u) : null });
});
