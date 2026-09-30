import { z } from "zod";
import { json, readJson, route, serialize } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guard";
import { getUserProfile, updateUser } from "@/lib/services/users";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
const id = z.string().uuid();

export const GET = route<Ctx>(async (_req, ctx) => {
  await requireAdmin();
  return json(serialize(await getUserProfile(id.parse((await ctx.params).id))));
});

export const PATCH = route<Ctx>(async (req, ctx) => {
  const admin = await requireAdmin();
  return json({ user: await updateUser(id.parse((await ctx.params).id), await readJson(req), admin.wallet_address) });
});
