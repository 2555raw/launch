import { prisma } from "@/server/db";
import { clientIp, createSession, publicUser, setSessionCookie, getUser } from "@/server/auth";
import { randomName } from "@/server/names";
import { handler, json, fail } from "@/server/http";
import { rateLimit } from "@/server/redis";

export const dynamic = "force-dynamic";

/**
 * Walk-in play: creates a guest account with a generated name and signs it in.
 * The player can secure it with a name + password or a wallet from Options.
 */
export const POST = handler(async (req) => {
  const existing = await getUser(req);
  if (existing) return json({ user: publicUser(existing), action: "existing" });
  if (!(await rateLimit(`guest:${clientIp(req)}`, 15, 600))) return fail(429, "Too many new foundries from this address, try again in a few minutes");
  let username = randomName();
  for (let i = 0; i < 5 && (await prisma.user.findFirst({ where: { username: { equals: username, mode: "insensitive" } } })); i++) username = randomName();
  if (await prisma.user.findFirst({ where: { username: { equals: username, mode: "insensitive" } } })) username = `${username} ${Math.floor(Math.random() * 9000 + 1000)}`;
  const user = await prisma.user.create({ data: { username }, include: { wallets: true } });
  const s = await createSession(user.id, req.headers.get("user-agent"));
  const res = json({ user: publicUser(user), action: "created" });
  setSessionCookie(res, s.token, s.expiresAt);
  return res;
});
