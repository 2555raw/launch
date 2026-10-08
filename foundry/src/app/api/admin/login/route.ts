import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/server/db";
import { clientIp, publicUser, requireUser } from "@/server/auth";
import { env } from "@/server/env";
import { handler, json, parseBody, fail } from "@/server/http";
import { rateLimit } from "@/server/redis";

export const dynamic = "force-dynamic";

/** Elevates the signed-in account to ADMIN when the configured admin password matches. */
export const POST = handler(async (req) => {
  const user = await requireUser(req);
  if (!(await rateLimit(`adminlogin:${clientIp(req)}`, 5, 300))) return fail(429, "Too many attempts");
  const { password } = await parseBody(req, z.object({ password: z.string().min(1).max(200) }));
  if (!env.adminPassword) return fail(500, "ADMIN_PASSWORD is not configured on the server");
  const a = Buffer.from(password);
  const b = Buffer.from(env.adminPassword);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return fail(401, "Wrong admin password");
  const u = await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" }, include: { wallets: true } });
  return json({ user: publicUser(u) });
});
