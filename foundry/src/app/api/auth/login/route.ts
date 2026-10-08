import { z } from "zod";
import { prisma } from "@/server/db";
import { clientIp, createSession, publicUser, setSessionCookie, verifyPassword } from "@/server/auth";
import { handler, json, parseBody, fail } from "@/server/http";
import { rateLimit } from "@/server/redis";

export const dynamic = "force-dynamic";

const schema = z.object({ username: z.string().trim().min(1).max(40), password: z.string().min(1).max(200) });

export const POST = handler(async (req) => {
  if (!(await rateLimit(`login:${clientIp(req)}`, 20, 300))) return fail(429, "Too many attempts, try later");
  const { username, password } = await parseBody(req, schema);
  const user = await prisma.user.findFirst({ where: { username: { equals: username, mode: "insensitive" } }, include: { wallets: true } });
  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) return fail(401, "Wrong name or password");
  const s = await createSession(user.id, req.headers.get("user-agent"));
  await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
  const res = json({ user: publicUser(user) });
  setSessionCookie(res, s.token, s.expiresAt);
  return res;
});
