import { z } from "zod";
import { prisma } from "@/server/db";
import { clientIp, createSession, hashPassword, publicUser, setSessionCookie } from "@/server/auth";
import { handler, json, parseBody, fail } from "@/server/http";
import { rateLimit } from "@/server/redis";

export const dynamic = "force-dynamic";

const schema = z.object({
  username: z.string().trim().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, "letters, numbers and _ only"),
  password: z.string().min(8).max(200),
});

export const POST = handler(async (req) => {
  if (!(await rateLimit(`register:${clientIp(req)}`, 10, 600))) return fail(429, "Too many sign-ups from this address, try later");
  const { username, password } = await parseBody(req, schema);
  const exists = await prisma.user.findFirst({ where: { username: { equals: username, mode: "insensitive" } } });
  if (exists) return fail(409, "That name is taken");
  const user = await prisma.user.create({ data: { username, passwordHash: await hashPassword(password) }, include: { wallets: true } });
  const s = await createSession(user.id, req.headers.get("user-agent"));
  const res = json({ user: publicUser(user) });
  setSessionCookie(res, s.token, s.expiresAt);
  return res;
});
